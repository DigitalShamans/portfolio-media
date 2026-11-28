"""Write asset versions and homepage gallery preloads for the published commit."""

import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
from urllib.parse import quote


IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'}
ROOT = Path(__file__).resolve().parents[2]


def tracked_versions(directory):
    tree = subprocess.check_output(
        ['git', 'ls-tree', '-r', '-z', 'HEAD', '--', directory], cwd=ROOT,
    )
    for entry in tree.split(b'\0'):
        if not entry:
            continue
        metadata, _, path = entry.partition(b'\t')
        _, kind, digest = metadata.split()
        if kind == b'blob':
            yield PurePosixPath(path.decode('utf-8')), digest.decode('ascii')


def gallery_webp_versions(tracked, release):
    versions = {f'/{path}': digest for path, digest in tracked.items()
                if len(path.parts) == 4 and path.parts[2] == '1440p' and path.suffix == '.webp'}
    versions.update(release.get('assets', {}))
    return versions


def gallery_versions(tracked, webps):
    delivery = json.loads((ROOT / '_data/gallery_delivery.json').read_text(encoding='utf-8'))
    versions = {}
    for path in tracked:
        if len(path.parts) != 3 or path.name != 'gallery.json':
            continue
        payload = (ROOT / path).read_bytes()
        files = {'gallery.json': hashlib.sha1(f'blob {len(payload)}\0'.encode() + payload).hexdigest()}
        map_path = path.parent / 'gallery-map.json'
        if map_path in tracked:
            files['gallery-map.json'] = tracked[map_path]
        embeds_path = path.parent / 'gallery-embeds.json'
        if embeds_path in tracked:
            files['gallery-embeds.json'] = tracked[embeds_path]
            embeds = json.loads((ROOT / embeds_path).read_text(encoding='utf-8'))
            for embed in embeds:
                if embed['type'] == 'video':
                    files[embed['file']] = tracked[path.parent / embed['file']]
        entries = json.loads(payload.decode('utf-8-sig'))
        for entry in entries:
            for name in (entry['image'], entry.get('compare'), *(entry.get('additionalImages') or [])):
                if name is None:
                    continue
                preview = path.parent / '1440p' / PurePosixPath(name).with_suffix('.webp').name
                asset = preview if delivery['revision'] else path.parent / name
                files[name] = webps[f'/{asset}'] if delivery['revision'] else tracked[asset]
        versions[path.parent.name] = files
    return versions


def generate_personal_vegetation_manifest(galleries):
    """Publish a filtered manifest derived from the shared order, not a second hand-edited list."""
    page = ROOT / 'artur/galleries/vegetation/index.html'
    excluded = set(json.loads(next(line.split(':', 1)[1] for line in
                                  page.read_text(encoding='utf-8').splitlines()
                                  if line.startswith('gallery_exclude:'))))
    folder = ROOT / 'galleries/vegetation'
    entries = json.loads((folder / 'gallery.json').read_text(encoding='utf-8-sig'))
    filtered = [entry for entry in entries if entry['image'] not in excluded]
    if not filtered:
        raise ValueError('Personal Vegetation must retain at least one image.')
    name = 'gallery-personal.json'
    payload = (json.dumps(filtered, indent=2) + '\n').encode('utf-8')
    (folder / name).write_bytes(payload)
    galleries['vegetation'][name] = hashlib.sha256(payload).hexdigest()


def gallery_script_versions():
    return {'viewer': hashlib.sha256((ROOT / 'galleries/gallery-viewer.js').read_bytes()).hexdigest()}


def banner_versions():
    return {
        f'/{path}': digest
        for path, digest in tracked_versions('projects')
        if path.suffix.lower() in IMAGE_SUFFIXES
    }


def portfolio_gallery_preloads(galleries):
    portfolio = json.loads((ROOT / '_data/portfolio.json').read_text(encoding='utf-8'))
    locked_folders = {item['folder'] for item in portfolio['recent'] if item.get('locked')}
    preloads = {}
    # Gallery pages also use the first URL, including galleries no longer on the homepage.
    for folder in galleries:
        if folder in locked_folders:
            continue
        manifest = ROOT / 'galleries' / folder / 'gallery.json'
        try:
            entries = json.loads(manifest.read_text(encoding='utf-8-sig'))
        except json.JSONDecodeError:
            continue
        if not isinstance(entries, list):
            continue

        urls = []
        for entry in entries[:3]:
            image = entry.get('image') if isinstance(entry, dict) else None
            if isinstance(image, str) and image in galleries[folder] and image != 'gallery.json':
                filename = quote(image, safe="~!*'()")
                urls.append(f'/galleries/{folder}/{filename}?v={galleries[folder][image]}')
        preloads[folder] = urls
    return preloads


if __name__ == '__main__':
    state = ROOT / 'gallery-webp-state.json'
    release = json.loads(state.read_text(encoding='utf-8')) if state.is_file() else {}
    tracked = dict(tracked_versions('galleries'))
    webps = gallery_webp_versions(tracked, release)
    galleries = gallery_versions(tracked, webps)
    generate_personal_vegetation_manifest(galleries)
    for name, versions in (
        ('gallery_asset_versions', galleries),
        ('gallery_webp_asset_versions', webps),
        ('gallery_published_replacements', release.get('releases', {})),
        ('gallery_script_versions', gallery_script_versions()),
        ('portfolio_banner_versions', banner_versions()),
        ('portfolio_gallery_preloads', portfolio_gallery_preloads(galleries)),
    ):
        destination = ROOT / '_data' / f'{name}.json'
        destination.write_text(json.dumps(versions, sort_keys=True) + '\n', encoding='utf-8')
