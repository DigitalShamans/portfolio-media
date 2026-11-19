"""Meaningful offline checks for the one-gallery staging and immutable release plan."""

from copy import deepcopy
import importlib.util
from io import BytesIO
import json
from pathlib import Path
import struct
from types import SimpleNamespace
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/gallery-import.py"
SPEC = importlib.util.spec_from_file_location("gallery_import", SCRIPT)
tool = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(tool)
try:
    import PIL
    from PIL import Image, ImageOps
    PILLOW_AVAILABLE = PIL.__version__ == "13.0.0"
except ImportError:
    PILLOW_AVAILABLE = False


def box(kind, payload):
    return struct.pack(">I4s", len(payload) + 8, kind) + payload


def mp4():
    movie = box(b"mvhd", b"\0" * 12 + struct.pack(">II", 1000, 18500))
    track = box(b"tkhd", b"\0" * 24 + struct.pack(">II", 2560 * 65536, 1440 * 65536))
    track += box(b"mdia", box(b"hdlr", b"\0" * 8 + b"vide"))
    return box(b"ftyp", b"isom\0\0\0\0isom") + box(b"moov", movie + box(b"trak", track)) + box(b"mdat", b"fixture-only")


def payload(names=("First.jpg", "Second.jpg")):
    return {"schema_version": 1, "slug": "example", "title": "Example",
            "source_project": "https://www.artstation.com/artwork/58QBOJ",
            "media": [{"type": "image", "filename": name,
                       "source_url": "https://cdn.artstation.com/originals/" + name} for name in names]}


class NormalizationTests(unittest.TestCase):
    def test_image_captions_are_filename_keyed_page_metadata_not_editor_rows(self):
        raw = payload()
        raw["media"][0]["caption"] = "Before."
        raw["media"][1]["caption"] = "After <text>."
        source = tool.normalize(raw)
        rows, embeds = tool.manifests(source)
        self.assertEqual(rows, [{"image": "First.jpg"}, {"image": "Second.jpg"}])
        self.assertEqual(embeds, [])
        line = next(line for line in tool.page(source).decode().splitlines()
                    if line.startswith("gallery_captions:"))
        self.assertEqual(json.loads(line.split(": ", 1)[1]),
                         {"First.jpg": "Before.", "Second.jpg": "After <text>."})
        self.assertNotIn(b"gallery_captions:", tool.page(source, personal=True))
        self.assertNotIn(b"gallery_captions:", tool.page(tool.normalize(payload())))
        raw["media"][0]["caption"] = None
        raw["media"][1]["caption"] = ""
        self.assertNotIn(b"gallery_captions:", tool.page(tool.normalize(raw)))

    def test_non_text_image_captions_are_rejected(self):
        for invalid in (5, {}, []):
            raw = payload()
            raw["media"][0]["caption"] = invalid
            with self.subTest(caption=invalid), self.assertRaisesRegex(ValueError, "Image caption"):
                tool.normalize(raw)

    def test_mixed_order_and_historical_fields_preserve_metadata(self):
        raw = payload()
        first, second = raw.pop("media")
        first["downloaded_url"] = first.pop("source_url")
        first.update(dimensions=[20, 40], git_blob_sha1="a" * 40)
        raw["entries"] = [{"type": "embed", "provider": "YouTube", "video_id": "eWHDcWZnTMY"},
                          {"type": "empty", "detail": "observed empty"}, first,
                          {"type": "video", "filename": "clip.mp4", "url": "https://cdn.artstation.com/clip.mp4"},
                          {"type": "sketchfab", "id": "b" * 32, "title": "Model"}, second]
        raw["source_verification"] = {"observed": "rendered browser"}
        normalized = tool.normalize(raw)
        images, embeds = tool.manifests(normalized)
        self.assertEqual(images, [{"image": "First.jpg"}, {"image": "Second.jpg"}])
        self.assertEqual(embeds[0]["before"], "First.jpg")
        self.assertNotIn("after", embeds[0])
        self.assertEqual([(e["after"], e["before"]) for e in embeds[1:]], [("First.jpg", "Second.jpg")] * 2)
        self.assertEqual(normalized["media"][2]["git_blob_sha"], "a" * 40)
        self.assertEqual(normalized["media"][2]["width"], 20)
        self.assertEqual(normalized["source_metadata"]["source_verification"], raw["source_verification"])

    def test_unknown_empty_image_and_unsafe_inputs_fail(self):
        for media in ([{"type": "audio"}], [{"type": "empty"}], []):
            with self.subTest(media=media), self.assertRaises(ValueError):
                tool.normalize({**payload(), "media": media})
        for filename in ("../escape.jpg", "dir/a.jpg", "CON.jpg", "a.jpeg", "bad name.jpg", "a.jpg\n"):
            with self.subTest(filename=filename), self.assertRaises(ValueError):
                tool.normalize(payload((filename,)))
        for slug in ("hb-rzstart", "protected", "../unsafe", "Bad"):
            with self.subTest(slug=slug), self.assertRaises(ValueError):
                tool.normalize({**payload(), "slug": slug})
        for names in (("First.jpg", "first.JPG"), ("First.jpg", "First.jpg")):
            with self.subTest(names=names), self.assertRaises(ValueError):
                tool.normalize(payload(names))

    def test_temporary_signed_urls_and_duplicate_ids_fail(self):
        for url in ("http://cdn.artstation.com/a.jpg", "https://user:secret@example.com/a.jpg",
                    "https://example.com/a.jpg?X-Amz-Signature=signed", "https://example.com/a.jpg?token=secret",
                    "https://example.com/a.jpg#fragment"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                tool.stable_url(url)
        self.assertEqual(tool.stable_url("https://cdn.artstation.com/a.jpg?1629601356"),
                         "https://cdn.artstation.com/a.jpg?1629601356")
        raw = payload()
        raw["media"] += [{"type": "youtube", "id": "eWHDcWZnTMY", "title": "Trailer"}] * 2
        with self.assertRaises(ValueError):
            tool.normalize(raw)
        raw = payload()
        raw["provenance"] = {"capture": {"urls": [{"rendered_url": "https://example.com/asset?signature=secret"}]}}
        with self.assertRaises(ValueError):
            tool.normalize(raw)
        with self.assertRaisesRegex(ValueError, "without credentials") as context:
            tool.stable_url("https://user:never-print-this@example.com/a.jpg")
        self.assertNotIn("never-print-this", str(context.exception))

    def test_mp4_measured_metadata_and_truncation(self):
        self.assertEqual(tool.mp4_metadata(mp4()), {"width": 2560, "height": 1440, "duration_seconds": 18.5})
        for invalid in (b"", b"not mp4", mp4()[:-1]):
            with self.subTest(invalid=invalid[:10]), self.assertRaises(ValueError):
                tool.mp4_metadata(invalid)


@unittest.skipUnless(PILLOW_AVAILABLE, "Requires the pinned Pillow 13.0.0 runtime.")
class PreparationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.originals = self.root / "originals"
        self.originals.mkdir()
        self.cache, self.stage = self.root / "cache", self.root / "stage"

    def jpeg(self, name, size=(40, 20), orientation=6):
        image = Image.new("RGB", size, (35, 76, 112))
        exif = Image.Exif()
        exif[274] = orientation
        image.save(self.originals / name, "JPEG", icc_profile=b"test-icc-profile", exif=exif)
        return (self.originals / name).read_bytes()

    def run_prepare(self, raw, resume=False, directory=True):
        path = self.root / "source.json"
        path.write_bytes(tool.encoded(raw))
        tool.prepare(SimpleNamespace(input=path, slug=None, title=None,
                     source_dir=self.originals if directory else None, cache=self.cache,
                     output=self.stage, resume=resume, jobs=4))

    def test_exact_recipe_no_upscale_exif_and_icc(self):
        for name, size in (("Small.jpg", (40, 20)), ("Large.jpg", (2800, 1600))):
            data = self.jpeg(name, size)
            output, measured, hit = tool.image_asset({"filename": name}, data, tool.facts(data), self.cache)
            with Image.open(BytesIO(data)) as original:
                expected = ImageOps.exif_transpose(original)
                expected.thumbnail((2560, 1440), Image.Resampling.LANCZOS)
                buffer = BytesIO()
                expected.save(buffer, "WEBP", quality=92, method=6, icc_profile=expected.info.get("icc_profile"))
                self.assertEqual(output, buffer.getvalue())
                with Image.open(BytesIO(output)) as webp:
                    self.assertEqual(webp.size, expected.size)
                    self.assertEqual(webp.info["icc_profile"], b"test-icc-profile")
                    if name == "Small.jpg":
                        self.assertEqual(webp.size, (20, 40))
            self.assertFalse(hit)
            self.assertEqual(measured["width"], size[0])

    def test_firearms_twenty_images_and_mp4_golden_resume(self):
        names = [entry["image"] for entry in tool.read_json(SCRIPT.parents[2] / "galleries/firearms/gallery.json")]
        self.assertEqual(len(names), 20)
        raw = payload(names)
        raw["slug"], raw["title"] = "firearms", "Firearms"
        for name in names:
            self.jpeg(name)
        video = {"type": "video", "filename": "phantom-covert-ops-shooting-challenge-gif-gfycat.mp4",
                 "source_url": "https://cdn.artstation.com/clip.mp4", "width": 2560, "height": 1440, "duration": 18.5}
        raw["media"].insert(1, video)
        (self.originals / video["filename"]).write_bytes(mp4())
        self.run_prepare(raw)
        folder = self.stage / "public/galleries/firearms"
        self.assertEqual(tool.read_json(folder / "gallery.json"), [{"image": name} for name in names])
        embed = tool.read_json(folder / "gallery-embeds.json")[0]
        self.assertEqual((embed["after"], embed["before"], embed["file"]), (names[0], names[1], video["filename"]))
        self.assertEqual((folder / video["filename"]).read_bytes(), mp4())
        self.assertIn(b"gallery_embeds: true", (folder / "index.html").read_bytes())
        self.assertTrue((self.stage / "public/artur/galleries/firearms/index.html").is_file())
        artifacts = tool.read_json(self.stage / "artifacts.json")
        mtimes = {path: (self.stage / path).stat().st_mtime_ns for path in artifacts}
        self.run_prepare(raw, resume=True, directory=False)
        self.assertEqual(tool.read_json(self.stage / "artifacts.json"), artifacts)
        self.assertEqual({path: (self.stage / path).stat().st_mtime_ns for path in artifacts}, mtimes)
        self.assertEqual(tool.read_json(self.stage / "report.json")["webp_cache_hits"], 20)
        raw["title"] = "Changed"
        with self.assertRaises(ValueError):
            self.run_prepare(raw, resume=True)

    def test_hash_mismatch_and_tampered_cache_fail(self):
        data = self.jpeg("First.jpg")
        item = {**payload(("First.jpg",))["media"][0], "sha256": "0" * 64}
        with self.assertRaises(ValueError):
            tool.original(item, self.originals, self.cache)
        del item["sha256"]
        tool.original(item, self.originals, self.cache)
        (self.cache / "originals" / tool.digest(data)).write_bytes(b"corrupt")
        with self.assertRaises(ValueError):
            tool.original(item, None, self.cache)

    def test_release_plan_preserves_old_data_without_applying(self):
        self.jpeg("First.jpg")
        self.run_prepare(payload(("First.jpg",)))
        site, service = self.root / "website", self.root / "service"
        old_inventory = {"galleries": {"old": {"excluded.jpg": {"blob": "a" * 40, "size": 100}}}}
        old_delivery = {"revision": "b" * 40, "service_origin": "https://images.example.com",
                        "gallery_revisions": {"old": "c" * 40}}
        old_catalog = {"c" * 40: {"galleries": old_inventory["galleries"]}}
        paths = [site / "_data/public-gallery-originals.json", site / "_data/gallery_delivery.json", service / "worker/public-media.json"]
        for path, value in zip(paths, (old_inventory, old_delivery, old_catalog)):
            tool.write(path, tool.encoded(value))
        before = [path.read_bytes() for path in paths]
        plan_path = self.root / "release.json"
        args = SimpleNamespace(stage=self.stage, revision="d" * 40, website=site, service_source=service, plan=plan_path)
        tool.release_plan(args)
        self.assertEqual([path.read_bytes() for path in paths], before)
        plan = tool.read_json(plan_path)
        patches = [tool.read_json(change["replacement"]) for change in plan["changes"]]
        self.assertEqual(patches[0]["galleries"]["old"], old_inventory["galleries"]["old"])
        self.assertEqual(patches[1]["gallery_revisions"]["old"], "c" * 40)
        self.assertEqual(patches[2]["c" * 40], old_catalog["c" * 40])
        self.assertEqual(set(patches[2]["d" * 40]["galleries"]), {"example"})
        self.assertEqual(len(plan["service_requests"]), 1)
        tool.write(self.stage / "public/galleries/example/gallery.json", b"tampered")
        with self.assertRaises(ValueError):
            tool.release_plan(args)

    def test_private_plan_preserves_inventory_and_blocks_artifact_escape(self):
        self.jpeg("First.jpg")
        self.run_prepare(payload(("First.jpg",)))
        private = self.root / "private"
        old = {"galleries": {"old": {"excluded.jpg": {"blob": "a" * 40, "size": 10}}}}
        tool.write(private / "public-media.json", tool.encoded(old))
        before = (private / "public-media.json").read_bytes()
        args = SimpleNamespace(stage=self.stage, private_source=private, plan=self.root / "private-plan.json")
        tool.private_plan(args)
        plan = tool.read_json(args.plan)
        replacement = tool.read_json(plan["changes"][0]["replacement"])
        self.assertEqual(replacement["galleries"]["old"], old["galleries"]["old"])
        self.assertEqual(set(replacement["galleries"]), {"old", "example"})
        self.assertEqual((private / "public-media.json").read_bytes(), before)
        outside = self.root / "outside.txt"
        outside.write_bytes(b"outside")
        artifacts = tool.read_json(self.stage / "artifacts.json")
        artifacts["../outside.txt"] = tool.facts(b"outside")
        tool.write(self.stage / "artifacts.json", tool.encoded(artifacts))
        with self.assertRaisesRegex(ValueError, "inside the stage"):
            tool.private_plan(args)


if __name__ == "__main__":
    unittest.main()
