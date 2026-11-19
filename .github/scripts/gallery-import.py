"""Stage one reviewed ArtStation gallery; never commit, publish, or alter repositories.

prepare accepts normalized v1 media or historical entries and optional local originals.
plan binds the prepared files to an immutable private revision and writes reviewable patches.
Requires Pillow 13.0.0. Downloads are deliberately delegated to a TLS-validating downloader.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path, PurePosixPath
import re
import struct
from threading import Lock
import time
from urllib.parse import parse_qsl, urlparse
from uuid import uuid4


ENCODER = {"pillow": "13.0.0", "bounds": [2560, 1440], "quality": 92,
           "method": 6, "resampling": "LANCZOS", "exif_transpose": True, "icc": True}
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
SHA = re.compile(r"[a-f0-9]{40}\Z")
JPG = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\.[jJ][pP][gG]\Z")
MP4 = re.compile(r"[A-Za-z0-9][A-Za-z0-9_-]*\.mp4\Z")
IDS = {"youtube": re.compile(r"[A-Za-z0-9_-]{11}\Z"),
       "sketchfab": re.compile(r"[a-f0-9]{32}\Z")}
RESERVED = {"con", "prn", "aux", "nul", *(f"com{i}" for i in range(1, 10)),
            *(f"lpt{i}" for i in range(1, 10))}
WRITE_LOCK = Lock()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def facts(data):
    return {"bytes": len(data), "sha256": digest(data),
            "git_blob_sha": hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()}


def encoded(value):
    return (json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n").encode()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def write(path, data):
    with WRITE_LOCK:
        path = no_links(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.read_bytes() == data:
            return
        temporary = path.with_name(path.name + f".{uuid4().hex}.tmp")
        temporary.write_bytes(data)
        os.replace(temporary, path)


def stable_url(value):
    require(isinstance(value, str), "Source URL must be a string.")
    parsed = urlparse(value)
    require(parsed.scheme == "https" and parsed.hostname and not parsed.username and
            not parsed.password and not parsed.fragment, "Expected stable HTTPS URL without credentials or fragments.")
    blocked = {"token", "signature", "sig", "expires", "expiry", "policy", "key-pair-id",
               "access_token", "auth", "authorization"}
    require(not any(key.lower() in blocked or key.lower().startswith(("x-amz-", "x-goog-"))
                    for key, _ in parse_qsl(parsed.query)), "Temporary signed source URLs are unsupported.")
    return value


def validate_urls(value, key=""):
    if isinstance(value, dict):
        for name, child in value.items():
            validate_urls(child, name)
    elif isinstance(value, list):
        for child in value:
            validate_urls(child, key)
    elif isinstance(value, str) and (value.lower().startswith(("https://", "http://")) or
                                    key.lower().endswith(("_url", "_uri")) or key.lower() in {"url", "uri"}):
        stable_url(value)


def no_links(path):
    path = Path(path).absolute()
    require(not any(part.is_symlink() or (hasattr(part, "is_junction") and part.is_junction())
                    for part in (path, *path.parents)), "Symlinks/junctions are not supported in staging paths.")
    return path


def safe_name(name, kind):
    pattern = JPG if kind == "image" else MP4
    require(isinstance(name, str) and pattern.fullmatch(name) and
            name.split(".")[0].lower() not in RESERVED, f"Unsafe or unsupported {kind} filename: {name}")
    return name


def normalize(payload, slug=None, title=None):
    require(isinstance(payload, dict), "Input must be a JSON object.")
    validate_urls(payload)
    require(payload.get("schema_version", 1) == 1, "Unsupported input schema version.")
    slug = slug or payload.get("slug")
    title = title or payload.get("title") or payload.get("project")
    require(isinstance(slug, str) and SLUG.fullmatch(slug) and slug not in
            {"hb-rzstart", "protected"}, "Provide a safe public --slug.")
    require(isinstance(title, str) and title.strip() and not any(c in title for c in "\r\n"),
            "Provide a nonempty single-line title.")
    project = payload.get("source_project") or payload.get("project_url")
    stable_url(project)
    require(isinstance(payload.get("description", ""), str), "Description must be a string.")
    source = payload.get("media", payload.get("entries"))
    require(isinstance(source, list) and source, "Input needs an ordered media/entries array.")
    media, filenames, identities = [], set(), set()
    for position, raw in enumerate(source, 1):
        require(isinstance(raw, dict), f"Media {position} must be an object.")
        item = deepcopy(raw)
        kind = str(item.get("type", "")).lower()
        if kind == "embed":
            kind = str(item.get("provider", "")).lower()
        require(kind in {"image", "video", "youtube", "sketchfab", "empty"},
                f"Unsupported media type at position {position}: {kind!r}")
        item.update(type=kind, position=position)
        if kind in {"image", "video"}:
            name = safe_name(item.get("filename"), kind)
            require(name.casefold() not in filenames, f"Duplicate/case-colliding filename: {name}")
            filenames.add(name.casefold())
            item["source_url"] = stable_url(item.get("source_url") or item.get("downloaded_url") or item.get("url"))
            dimensions = item.get("dimensions")
            if dimensions is not None:
                require(isinstance(dimensions, list) and len(dimensions) == 2, "Invalid dimensions.")
                item.setdefault("width", dimensions[0])
                item.setdefault("height", dimensions[1])
            if "git_blob_sha1" in item:
                item.setdefault("git_blob_sha", item["git_blob_sha1"])
            if "duration" in item:
                item.setdefault("duration_seconds", item["duration"])
        elif kind in IDS:
            item["id"] = item.get("id") or item.get("video_id") or item.get("model_id")
            require(isinstance(item["id"], str) and IDS[kind].fullmatch(item["id"]),
                    f"Invalid {kind} provider ID at position {position}.")
            item["title"] = item.get("title") or title
            require(isinstance(item["title"], str) and item["title"].strip(), "Embed title required.")
        identity = (kind, item.get("id"))
        if item.get("id") is not None:
            require(identity not in identities, f"Duplicate media identity at position {position}.")
            identities.add(identity)
        media.append(item)
    images = [item for item in media if item["type"] == "image"]
    require(images, "A gallery must contain at least one image.")
    stems = [Path(item["filename"]).stem.casefold() for item in images]
    require(len(set(stems)) == len(stems), "Image filenames collide as WebPs.")
    return {"schema_version": 1, "slug": slug, "title": title, "source_project": project,
            "description": payload.get("description", ""), "media": media,
            "source_metadata": {key: deepcopy(value) for key, value in payload.items()
                                if key not in {"media", "entries"}}}


def manifests(source):
    media = source["media"]
    images = [{"image": item["filename"]} for item in media if item["type"] == "image"]
    embeds = []
    for index, item in enumerate(media):
        if item["type"] not in {"video", "youtube", "sketchfab"}:
            continue
        embed = {"type": item["type"], "title": item.get("title") or source["title"]}
        embed["file" if item["type"] == "video" else "id"] = item.get("filename") if item["type"] == "video" else item["id"]
        if item.get("caption") is not None:
            require(isinstance(item["caption"], str), "Embed caption must be a string.")
            embed["caption"] = item["caption"]
        before = next((entry["filename"] for entry in media[index + 1:] if entry["type"] == "image"), None)
        after = next((entry["filename"] for entry in reversed(media[:index]) if entry["type"] == "image"), None)
        if after:
            embed["after"] = after
        if before:
            embed["before"] = before
        embeds.append(embed)
    return images, embeds


def mp4_metadata(data):
    def boxes(start, end):
        while start < end:
            require(end - start >= 8, "Truncated MP4 box.")
            size, kind = struct.unpack_from(">I4s", data, start)
            header = 8
            if size == 1:
                require(end - start >= 16, "Truncated extended MP4 box.")
                size, header = struct.unpack_from(">Q", data, start + 8)[0], 16
            if size == 0:
                size = end - start
            require(size >= header and start + size <= end, "Invalid MP4 box extent.")
            yield kind, start + header, start + size
            start += size
    top = list(boxes(0, len(data)))
    require(top and top[0][0] == b"ftyp" and any(box[0] == b"mdat" for box in top), "Invalid MP4 container.")
    moov = next((box for box in top if box[0] == b"moov"), None)
    require(moov, "MP4 needs moov metadata.")
    result = {}
    for kind, start, end in boxes(moov[1], moov[2]):
        if kind == b"mvhd":
            version = data[start]
            require(version in (0, 1), "Unsupported MP4 movie header version.")
            offset, fmt = (12, ">II") if version == 0 else (20, ">IQ")
            require(end - start >= offset + struct.calcsize(fmt), "Truncated MP4 movie header.")
            scale, duration = struct.unpack_from(fmt, data, start + offset)
            require(scale > 0, "Invalid MP4 timescale.")
            result["duration_seconds"] = duration / scale
        if kind == b"trak":
            track = list(boxes(start, end))
            mdia = next((box for box in track if box[0] == b"mdia"), None)
            if not mdia:
                continue
            handler = next((box for box in boxes(mdia[1], mdia[2]) if box[0] == b"hdlr"), None)
            if not handler or data[handler[1] + 8:handler[1] + 12] != b"vide":
                continue
            tkhd = next((box for box in track if box[0] == b"tkhd"), None)
            require(tkhd and tkhd[2] - tkhd[1] >= 8, "Missing MP4 track dimensions.")
            width, height = struct.unpack_from(">II", data, tkhd[2] - 8)
            require(width % 65536 == height % 65536 == 0, "Unsupported fractional MP4 dimensions.")
            result.update(width=width // 65536, height=height // 65536)
    require(all(result.get(key, 0) > 0 for key in ("width", "height", "duration_seconds")), "Invalid MP4 metadata.")
    return result


def original(item, directory, cache):
    name, url = item["filename"], item["source_url"]
    index = cache / "sources" / (digest(url.encode()) + ".json")
    path = directory / name if directory else None
    if path and path.is_file():
        require(not path.is_symlink() and any(p.name == name for p in directory.iterdir()), f"Exact regular filename required: {name}")
        data = path.read_bytes()
    elif index.is_file():
        no_links(index)
        record = read_json(index)
        require(record["source_url"] == url, "Cache source identity mismatch.")
        require(re.fullmatch(r"[a-f0-9]{64}", record["sha256"]), "Invalid cached source digest.")
        blob = cache / "originals" / record["sha256"]
        no_links(blob)
        data = blob.read_bytes()
        require(facts(data) == {key: record[key] for key in facts(data)}, f"Corrupt source cache: {name}")
    else:
        raise ValueError(f"Missing original: {name}. Use download-plan.json and --source-dir; TLS verification is required.")
    result = facts(data)
    require(result["bytes"] > 0, f"Empty original: {name}")
    require(result["bytes"] <= (90_000_000 if item["type"] == "video" else 100_000_000), f"Original too large: {name}")
    for key in result:
        if key in item:
            require(item[key] == result[key], f"Source {key} mismatch: {name}")
    write(cache / "originals" / result["sha256"], data)
    write(index, encoded({**result, "source_url": url}))
    return data, result


def image_asset(item, data, info, cache):
    import PIL
    from PIL import Image, ImageOps
    require(PIL.__version__ == ENCODER["pillow"], f"Pillow {ENCODER['pillow']} required; found {PIL.__version__}.")
    with Image.open(BytesIO(data), formats=["JPEG"]) as source:
        source.load()
        measured = {"width": source.width, "height": source.height, "format": "JPEG"}
        orientation = source.getexif().get(274)
        image = ImageOps.exif_transpose(source)
        image.thumbnail(tuple(ENCODER["bounds"]), Image.Resampling.LANCZOS)
        expected_size, icc = image.size, image.info.get("icc_profile")
        key = digest(encoded({"source": info["sha256"], "encoder": ENCODER}))
        output = cache / "webps" / (key + ".webp")
        metadata = output.with_suffix(".json")
        hit = output.is_file() and metadata.is_file() and not output.is_symlink()
        if hit:
            webp = output.read_bytes()
            hit = read_json(metadata) == facts(webp)
        if not hit:
            buffer = BytesIO()
            image.save(buffer, "WEBP", quality=92, method=6, icc_profile=icc)
            webp = buffer.getvalue()
            write(output, webp)
            write(metadata, encoded(facts(webp)))
    with Image.open(BytesIO(webp), formats=["WEBP"]) as check:
        check.load()
        require(check.size == expected_size and check.info.get("icc_profile") == icc, "Derivative metadata mismatch.")
    return webp, {**measured, "exif_orientation": orientation}, hit


def page(source, personal=False, embeds=False):
    fields = {"layout": "gallery"}
    if personal:
        fields.update(portfolio="personal", gallery=source["slug"])
    fields.update(seo_noindex=True, sitemap=False,
                  seo_title=source["title"] + (" | Artur Perzyna" if personal else " | Digital Shamans"))
    if not personal:
        fields.update(gallery_title=source["title"], gallery_description=source["description"],
                      personal_gallery_description=source["description"], gallery_label=source["title"])
        if embeds:
            fields["gallery_embeds"] = True
    # JSON scalars are valid YAML and prevent front-matter injection.
    return ("---\n" + "".join(f"{key}: {json.dumps(value, ensure_ascii=False)}\n" for key, value in fields.items()) + "---\n").encode()


def prepare(args):
    started = time.perf_counter()
    source = normalize(read_json(args.input), args.slug, args.title)
    output, cache = no_links(args.output).resolve(), no_links(args.cache).resolve()
    if args.source_dir:
        no_links(args.source_dir)
    fingerprint = digest(encoded({"source": source, "encoder": ENCODER}))
    marker = output / "stage.json"
    if output.exists():
        require(args.resume and marker.is_file() and read_json(marker).get("fingerprint") == fingerprint,
                "Output exists; --resume requires the same source and encoder stage.")
    else:
        output.mkdir(parents=True)
    write(marker, encoded({"schema_version": 1, "fingerprint": fingerprint, "encoder": ENCODER}))
    write(output / "normalized-source.json", encoded(source))
    local = [item for item in source["media"] if item["type"] in {"image", "video"}]
    write(output / "download-plan.json", encoded({"schema_version": 1, "source_project": source["source_project"],
          "slug": source["slug"], "entries": [{key: item[key] for key in ("position", "type", "filename", "source_url")} for item in local]}))
    results = []
    slug = source["slug"]

    def process(item):
        data, info = original(item, args.source_dir, cache)
        result = {**deepcopy(item), **info, "path": f"public/{slug}/{item['filename']}"}
        paths = {f"private/public/{slug}/{item['filename']}": data}
        cache_hit = False
        if item["type"] == "image":
            webp, measured, cache_hit = image_asset(item, data, info, cache)
            paths[f"public/galleries/{slug}/1440p/{Path(item['filename']).with_suffix('.webp').name}"] = webp
        else:
            measured = mp4_metadata(data)
            paths[f"public/galleries/{slug}/{item['filename']}"] = data
            result["playback_verification"] = "Pending live browser playback; container metadata only."
        for key in ("width", "height", "duration_seconds"):
            if key in item:
                require(abs(item[key] - measured[key]) < (0.1 if key == "duration_seconds" else 0.001), f"Source {key} mismatch: {item['filename']}")
        result.update(measured)
        artifacts = {}
        for path, content in paths.items():
            write(output / path, content)
            artifacts[path] = facts(content)
        return result, artifacts, cache_hit

    with ThreadPoolExecutor(max_workers=min(args.jobs, 4)) as pool:
        results = list(pool.map(process, local))
    entries = {item[0]["position"]: item[0] for item in results}
    evidence = {**source, "entries": [entries.get(item["position"], item) for item in source["media"]]}
    approved = {item[0]["filename"]: {"blob": item[0]["git_blob_sha"], "size": item[0]["bytes"]}
                for item in results if item[0]["type"] == "image"}
    generated = {f"private/imports/{slug}-artstation.json": encoded(evidence), "approved.json": encoded(approved)}
    images, embeds = manifests(source)
    generated[f"public/galleries/{slug}/gallery.json"] = encoded(images)
    if embeds:
        generated[f"public/galleries/{slug}/gallery-embeds.json"] = encoded(embeds)
    generated[f"public/galleries/{slug}/index.html"] = page(source, embeds=bool(embeds))
    generated[f"public/artur/galleries/{slug}/index.html"] = page(source, personal=True)
    artifacts = {path: info for _, paths, _ in results for path, info in paths.items()}
    for path, content in generated.items():
        write(output / path, content)
        artifacts[path] = facts(content)
    write(output / "artifacts.json", encoded(artifacts))
    report = {"slug": slug, "prepared": len(local), "images": len(images), "embeds": len(embeds),
              "empty_containers": sum(item["type"] == "empty" for item in source["media"]),
              "webp_cache_hits": sum(result[2] for result in results), "encoder": ENCODER,
              "elapsed_seconds": round(time.perf_counter() - started, 3),
              "publication": "Staged only; private checkpoint, service and Pages publication pending."}
    write(output / "report.json", encoded(report))
    print(json.dumps(report))


def checked_stage(directory):
    stage = no_links(directory).resolve()
    for name in ("stage.json", "normalized-source.json", "artifacts.json"):
        no_links(stage / name)
    source, artifacts = read_json(stage / "normalized-source.json"), read_json(stage / "artifacts.json")
    require(read_json(stage / "stage.json").get("fingerprint") == digest(encoded({"source": source, "encoder": ENCODER})),
            "Prepared source or encoder fingerprint changed.")
    require(isinstance(artifacts, dict) and artifacts, "Stage has no verified artifacts.")
    for path, expected in artifacts.items():
        require(isinstance(path, str) and "\\" not in path and ":" not in path and
                not PurePosixPath(path).is_absolute() and all(part not in {"", ".", ".."} for part in path.split("/")),
                "Artifact path must remain inside the stage.")
        target = no_links(stage / path)
        require(target.resolve().is_relative_to(stage) and facts(target.read_bytes()) == expected,
                f"Prepared file changed: {path}")
    return stage, source


def private_plan(args):
    stage, source = checked_stage(args.stage)
    slug = source["slug"]
    target = no_links(Path(args.private_source) / "public-media.json")
    previous = target.read_bytes()
    catalog = json.loads(previous.decode("utf-8-sig"))
    require(slug not in catalog["galleries"], "Private gallery approval already exists; this helper adds NEW galleries only.")
    catalog["galleries"][slug] = read_json(stage / "approved.json")
    replacement = args.plan.parent / (args.plan.stem + ".public-media.json")
    write(replacement, encoded(catalog))
    write(args.plan, encoded({"schema_version": 1, "slug": slug, "staged_private": str(stage / "private"),
          "changes": [{"target": str(target), "expected_sha256": digest(previous),
                       "replacement": str(replacement.resolve()), "replacement_sha256": digest(encoded(catalog))}],
          "boundaries": ["No repository files changed; review target hash and staged originals/evidence before applying.",
                         "Checkpoint originals, evidence and merged approval together; resolve its private SHA afterward."]}))
    print(f"Wrote reviewable private checkpoint plan: {args.plan}")


def release_plan(args):
    stage, source = checked_stage(args.stage)
    slug, revision = source["slug"], args.revision
    require(SHA.fullmatch(revision), "Use a full lowercase 40-character private commit SHA.")
    approved = read_json(stage / "approved.json")
    website, service = args.website.resolve(), args.service_source.resolve()
    require(not (website / "galleries" / slug).exists() and not (website / "artur/galleries" / slug).exists(),
            "This helper prepares NEW galleries only; existing gallery updates require review.")
    targets = [website / "_data/public-gallery-originals.json", website / "_data/gallery_delivery.json",
               service / "worker/public-media.json"]
    old = [path.read_bytes() for path in targets]
    inventory, delivery, catalog = [json.loads(data.decode("utf-8-sig")) for data in old]
    require(slug not in inventory["galleries"] and slug not in delivery.get("gallery_revisions", {}),
            "Gallery already has approval/delivery metadata.")
    require(revision not in catalog, "Service revision already exists; do not replace an immutable catalog.")
    inventory["galleries"][slug] = approved
    delivery.setdefault("gallery_revisions", {})[slug] = revision
    catalog[revision] = {"galleries": {slug: approved}}
    changes = []
    for index, (target, previous, updated) in enumerate(zip(targets, old, (inventory, delivery, catalog))):
        patch = args.plan.parent / (args.plan.stem + f".patch-{index + 1}.json")
        write(patch, encoded(updated))
        changes.append({"target": str(target), "expected_sha256": digest(previous),
                        "replacement": str(patch.resolve()), "replacement_sha256": digest(encoded(updated))})
    requests = [{"type": "jpg", "url": f"{delivery['service_origin']}/public-media/{revision}/{slug}/{name}",
                 "expected": {"bytes": item["size"], "git_blob_sha": item["blob"]}}
                for name, item in approved.items()]
    plan = {"schema_version": 1, "slug": slug, "media_revision": revision, "changes": changes,
            "staged_private": str(stage / "private"), "staged_public": str(stage / "public"),
            "service_catalog_scope": [slug], "required_active_revision_addition": revision,
            "service_requests": requests, "routes": [f"/galleries/{slug}/", f"/artur/galleries/{slug}/"],
            "boundaries": ["No repository files changed and no publication performed.",
                           "Verify full private commit tree matches staged originals and approval before publishing.",
                           "Recheck target hashes before applying patches; review existing dirty changes.",
                           "Retain existing MEDIA_PUBLIC_REVISIONS and add the new private revision.",
                           "Deploy and verify the service before one Pages release; retain rollback revisions.",
                           "Homepage cards, project redirects and sitemap intent require explicit separate review."]}
    write(args.plan, encoded(plan))
    print(f"Wrote reviewable release plan: {args.plan}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    staging = commands.add_parser("prepare", help="Stage exactly one gallery without network or repository changes.")
    staging.add_argument("--input", type=Path, required=True)
    staging.add_argument("--slug")
    staging.add_argument("--title")
    staging.add_argument("--source-dir", type=Path)
    staging.add_argument("--cache", type=Path, required=True)
    staging.add_argument("--output", type=Path, required=True)
    staging.add_argument("--resume", action="store_true")
    staging.add_argument("--jobs", type=int, choices=range(1, 5), default=4)
    planning = commands.add_parser("plan", help="Write concrete replacement metadata and a release plan; never apply.")
    planning.add_argument("--stage", type=Path, required=True)
    planning.add_argument("--revision", required=True)
    planning.add_argument("--website", type=Path, required=True)
    planning.add_argument("--service-source", type=Path, required=True)
    planning.add_argument("--plan", type=Path, required=True)
    checkpoint = commands.add_parser("private-plan", help="Write the private approval merge before its immutable checkpoint; never apply.")
    checkpoint.add_argument("--stage", type=Path, required=True)
    checkpoint.add_argument("--private-source", type=Path, required=True)
    checkpoint.add_argument("--plan", type=Path, required=True)
    args = parser.parse_args()
    try:
        {"prepare": prepare, "private-plan": private_plan, "plan": release_plan}[args.command](args)
    except (ValueError, OSError, KeyError, TypeError, ImportError, struct.error) as error:
        parser.exit(2, f"gallery-import: {error}\n")


if __name__ == "__main__":
    main()
