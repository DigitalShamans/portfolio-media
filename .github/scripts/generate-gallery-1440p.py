"""Generate the 1440p gallery files from the images in each manifest."""

import argparse
from concurrent.futures import ProcessPoolExecutor
import json
from pathlib import Path

from PIL import Image, ImageOps


def source_images(manifest):
    entries = json.loads(manifest.read_text(encoding='utf-8-sig'))
    for entry in entries:
        names = [entry['image'], entry.get('compare'), *(entry.get('additionalImages') or [])]
        for name in names:
            if name is None:
                continue
            if Path(name).name != name:
                raise ValueError(f'Expected an image filename in {manifest}, got {name!r}.')
            yield manifest.parent / name


def preview_path(source):
    return source.parent / '1440p' / source.with_suffix('.webp').name


def generate_image(source):
    destination = preview_path(source)
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        image.thumbnail((2560, 1440), Image.Resampling.LANCZOS)
        image.save(
            destination, 'WEBP', quality=92, method=6,
            icc_profile=image.info.get('icc_profile'),
        )
    return destination.stat().st_size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifests', nargs='+', type=Path)
    manifests = parser.parse_args().manifests
    for manifest in manifests:
        (manifest.parent / '1440p').mkdir(exist_ok=True)
    images = set(source for manifest in manifests for source in source_images(manifest))
    destinations = {}
    for source in sorted(images):
        destination = preview_path(source)
        previous = destinations.setdefault(destination, source)
        if previous != source:
            raise ValueError(f'{previous} and {source} both generate {destination}; rename one source image.')
    with ProcessPoolExecutor(max_workers=4) as pool:
        output_bytes = sum(pool.map(generate_image, sorted(images)))
    print(f'Generated {len(images)} gallery files at up to 1440p ({output_bytes / 1048576:.1f} MiB).')


if __name__ == '__main__':
    main()
