"""Copy published WebP replacements into the GitHub Pages build checkout."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.error import HTTPError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[2]
STATE = 'gallery-webp-state.json'
LIVE_STATE = f'https://digitalshamans.co.uk/{STATE}'
GALLERY = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')
JPG = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]*\.jpg', re.IGNORECASE)
REVISION = re.compile(r'[a-f0-9]{40}')
MAX_INDEX_BYTES = 10_000_000
MAX_WEBP_BYTES = 100_000_000


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def download(url, limit):
    request = Request(url, headers={'User-Agent': 'DigitalShamans-Pages-WebP-Sync'})
    with urlopen(request, timeout=15) as response:
        content = response.read(limit + 1)
        if len(content) > limit:
            raise ValueError(f'Unexpected size for {url}')
        return content, response.headers


def approved_previews(root):
    approved = read_json(root / '_data/public-gallery-originals.json')['galleries']
    previews = {}
    for gallery, originals in approved.items():
        if not GALLERY.fullmatch(gallery) or gallery in ('hb-rzstart', 'protected'):
            raise ValueError(f'Invalid public gallery {gallery}')
        images = {}
        for name in originals:
            if not JPG.fullmatch(name):
                raise ValueError(f'Invalid public gallery image {gallery}/{name}')
            preview = root / 'galleries' / gallery / '1440p' / Path(name).with_suffix('.webp').name
            # A retired or excluded original may still be in the approval inventory.
            if preview.is_file():
                images[name] = preview
        if images:
            previews[gallery] = images
    return previews


def latest_replacements(origin, gallery, previews):
    data, _ = download(f'{origin}/public-replacements/{gallery}.json', MAX_INDEX_BYTES)
    images = json.loads(data).get('images')
    if not isinstance(images, dict) or any(
        not JPG.fullmatch(name) or not isinstance(revision, str) or not REVISION.fullmatch(revision)
        for name, revision in images.items()
    ):
        raise ValueError(f'Invalid replacement index for {gallery}')
    return {name: revision for name, revision in images.items() if name in previews}


def fetch_webp(origin, gallery, name, revision):
    url = f'{origin}/public-replacements/{gallery}/{revision}/1440p/{quote(name, safe="")}'
    data, headers = download(url, MAX_WEBP_BYTES)
    digest = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
    if (headers.get_content_type() != 'image/webp' or data[:4] != b'RIFF' or data[8:12] != b'WEBP'
            or headers.get('ETag') != f'"{digest}"'):
        raise ValueError(f'Invalid replacement WebP for {gallery}/{name}')
    return data, digest


def live_state():
    try:
        data, _ = download(LIVE_STATE, MAX_INDEX_BYTES)
        return json.loads(data)
    except HTTPError as error:
        if error.code != 404:
            raise
        return {}


def sync(root, check_live):
    delivery = read_json(root / '_data/gallery_delivery.json')
    origin = delivery['service_origin'].rstrip('/') if delivery['revision'] else ''
    if origin and (urlsplit(origin).scheme != 'https' or not urlsplit(origin).netloc):
        raise ValueError('The public gallery media service must use HTTPS.')
    source = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    previews = approved_previews(root) if origin else {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        releases = {
            gallery: pending.result()
            for gallery, pending in {
                gallery: pool.submit(latest_replacements, origin, gallery, images)
                for gallery, images in previews.items()
            }.items()
        }
        snapshot = json.dumps(releases, sort_keys=True, separators=(',', ':')).encode()
        state = {'source': source, 'replacement_revision': hashlib.sha256(snapshot).hexdigest()}
        if check_live:
            published = live_state()
            if all(published.get(key) == value for key, value in state.items()):
                print('The site already has the current gallery WebP releases.')
                return False
        state['releases'] = {gallery: images for gallery, images in releases.items() if images}

        # Validate all downloads before replacing any copy in the build checkout.
        tasks = [(gallery, name, revision, previews[gallery][name])
                 for gallery, images in releases.items() for name, revision in images.items()]
        with tempfile.TemporaryDirectory(prefix='gallery-webps-') as staging:
            staging = Path(staging)

            def stage_webp(task):
                gallery, name, revision, preview = task
                data, digest = fetch_webp(origin, gallery, name, revision)
                staged = staging / gallery / preview.name
                staged.parent.mkdir(parents=True, exist_ok=True)
                staged.write_bytes(data)
                return preview, staged, digest

            updates = list(pool.map(stage_webp, tasks))
            state['assets'] = {}
            for preview, staged, digest in updates:
                preview.write_bytes(staged.read_bytes())
                state['assets'][f'/{preview.relative_to(root).as_posix()}'] = digest

    (root / STATE).write_text(json.dumps(state, sort_keys=True) + '\n', encoding='utf-8')
    print(f'Synchronized {len(state["assets"])} published WebP replacements for Pages.')
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check-live', action='store_true')
    changed = sync(ROOT, parser.parse_args().check_live)
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
            output.write(f'publish={str(changed).lower()}\n')
