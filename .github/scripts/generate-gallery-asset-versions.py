"""Write asset versions and homepage gallery preloads for the published commit."""

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


def gallery_versions():
    versions = {}
    for path, digest in tracked_versions('galleries'):
        if len(path.parts) != 3:
            continue
        _, gallery, filename = path.parts
        if filename == 'gallery.json' or path.suffix.lower() in IMAGE_SUFFIXES:
            versions.setdefault(gallery, {})[filename] = digest
    media = ROOT / '_data/public_gallery_media.json'
    if media.is_file():
        for folder, images in json.loads(media.read_text(encoding='utf-8'))['versions'].items():
            versions[folder] = {'gallery.json': versions[folder]['gallery.json'], **images}
    return {gallery: files for gallery, files in versions.items() if 'gallery.json' in files}


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
    galleries = gallery_versions()
    for name, versions in (
        ('gallery_asset_versions', galleries),
        ('portfolio_banner_versions', banner_versions()),
        ('portfolio_gallery_preloads', portfolio_gallery_preloads(galleries)),
    ):
        destination = ROOT / '_data' / f'{name}.json'
        destination.write_text(json.dumps(versions, sort_keys=True) + '\n', encoding='utf-8')
