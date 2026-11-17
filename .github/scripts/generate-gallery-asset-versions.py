"""Write version keys for the gallery assets in the Git commit being published."""

import json
from pathlib import Path, PurePosixPath
import subprocess


IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'}
ROOT = Path(__file__).resolve().parents[2]


def gallery_versions():
    tree = subprocess.check_output(
        ['git', 'ls-tree', '-r', '-z', 'HEAD', '--', 'galleries'], cwd=ROOT,
    )
    versions = {}
    for entry in tree.split(b'\0'):
        if not entry:
            continue
        metadata, _, path = entry.partition(b'\t')
        _, kind, digest = metadata.split()
        parts = PurePosixPath(path.decode('utf-8')).parts
        if kind != b'blob' or len(parts) != 3:
            continue
        _, gallery, filename = parts
        if filename == 'gallery.json' or PurePosixPath(filename).suffix.lower() in IMAGE_SUFFIXES:
            versions.setdefault(gallery, {})[filename] = digest.decode('ascii')
    return {gallery: files for gallery, files in versions.items() if 'gallery.json' in files}


if __name__ == '__main__':
    destination = ROOT / '_data' / 'gallery_asset_versions.json'
    destination.write_text(json.dumps(gallery_versions(), sort_keys=True) + '\n', encoding='utf-8')
