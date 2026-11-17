"""Write version keys for gallery assets and homepage banners in the published commit."""

import json
from pathlib import Path, PurePosixPath
import subprocess


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
    return {gallery: files for gallery, files in versions.items() if 'gallery.json' in files}


def banner_versions():
    return {
        f'/{path}': digest
        for path, digest in tracked_versions('projects')
        if path.suffix.lower() in IMAGE_SUFFIXES
    }


if __name__ == '__main__':
    for name, versions in (
        ('gallery_asset_versions', gallery_versions()),
        ('portfolio_banner_versions', banner_versions()),
    ):
        destination = ROOT / '_data' / f'{name}.json'
        destination.write_text(json.dumps(versions, sort_keys=True) + '\n', encoding='utf-8')
