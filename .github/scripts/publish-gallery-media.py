"""Publish both versions of the public gallery images before updating Pages."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from threading import Lock
from time import monotonic, sleep
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


ROOT = Path(__file__).resolve().parents[2]
MEDIA_DATA = ROOT / '_data/public_gallery_media.json'
AUDIENCE = 'digital-shamans-public-gallery-media'
IMAGE_TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
}
PAGE_SUFFIXES = {'.htm', '.html', '.md', '.markdown', '.mkdown', '.mdown', '.mkdn', '.mkd'}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, url):
        # Publisher credentials belong only at the selected media endpoint.
        return None


opener = build_opener(NoRedirect())


def open_request(request):
    for attempt in range(3):
        try:
            return opener.open(request, timeout=25)
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
            error.close()
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
        sleep(2 ** attempt)


def public_gallery_folders():
    tracked = subprocess.check_output(['git', 'ls-tree', '-r', '-z', '--name-only', 'HEAD'], cwd=ROOT)
    pages = (path for path in tracked.decode('utf-8').split('\0') if Path(path).suffix.lower() in PAGE_SUFFIXES)
    folders = json.loads(subprocess.check_output(
        ['ruby', str(ROOT / '.github/scripts/public-gallery-folders.rb')],
        input='\0'.join(pages), text=True, cwd=ROOT,
    ))
    if not folders or 'hb-rzstart' in folders:
        raise ValueError('The media upload requires public gallery routes only.')
    return folders


def file_digest(path):
    with path.open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()


@dataclass(frozen=True)
class Image:
    path: Path
    version: str
    digest: str

    @property
    def url_path(self):
        return '/' + quote(self.path.relative_to(ROOT).as_posix(), safe="/~!*'()") + '?v=' + self.version

    @property
    def content_type(self):
        return IMAGE_TYPES[self.path.suffix.lower()]


def media_inventory(origin):
    images = []
    versions = {}
    for folder in public_gallery_folders():
        gallery = ROOT / 'galleries' / folder
        entries = json.loads((gallery / 'gallery.json').read_text(encoding='utf-8-sig'))
        versions[folder] = {}
        for entry in entries:
            filenames = [entry['image'], entry.get('compare'), *(entry.get('additionalImages') or [])]
            for name in (filename for filename in filenames if filename is not None):
                if Path(name).name != name:
                    raise ValueError(f'{folder}: Expected an image filename, got {name!r}.')
                original = gallery / name
                webp = gallery / '1440p' / (name + '.webp')
                original_digest = file_digest(original)
                webp_digest = file_digest(webp)
                # Both URLs change only when the content in this pair changes.
                version = hashlib.sha256(bytes.fromhex(original_digest + webp_digest)).hexdigest()
                images.extend((Image(original, version, original_digest), Image(webp, version, webp_digest)))
                versions[folder][name] = version
    return images, {'origin': origin, 'versions': versions}


class Publisher:
    def __init__(self, origin):
        self.origin = origin
        self.identity_url = os.environ['ACTIONS_ID_TOKEN_REQUEST_URL']
        self.identity_credential = os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']
        self.token = None
        self.refresh_at = 0
        self.token_lock = Lock()

    def authorization(self):
        with self.token_lock:
            if monotonic() >= self.refresh_at:
                separator = '&' if '?' in self.identity_url else '?'
                request = Request(self.identity_url + separator + urlencode({'audience': AUDIENCE}))
                request.add_unredirected_header('Authorization', 'Bearer ' + self.identity_credential)
                with open_request(request) as response:
                    self.token = json.load(response)['value']
                self.refresh_at = monotonic() + 180
            return 'Bearer ' + self.token

    @staticmethod
    def media_request(url, image=None, authorization=None):
        # The media host accepts curl's HTTP client. Keep the bearer token in stdin.
        command = [
            'curl', '--silent', '--show-error', '--proto', '=https', '--max-time', '30',
            '--retry', '2', '--retry-delay', '1', '--output', os.devnull,
            '--write-out', '%{http_code}\n%header{content-type}\n%header{content-length}\n%header{x-media-sha256}',
        ]
        config = ''
        if image is None:
            command.append('--head')
        else:
            command.extend((
                '--config', '-', '--upload-file', str(image.path),
                '--header', 'Content-Type: ' + image.content_type,
                '--header', 'X-Media-SHA256: ' + image.digest,
            ))
            config = 'header = "Authorization: ' + authorization + '"\n'
        result = subprocess.run([*command, url], input=config, capture_output=True, text=True)
        if result.returncode:
            raise OSError(f'Media request failed: {result.stderr.strip()}')
        status, mime, size, digest = result.stdout.split('\n', 3)
        return int(status), mime.split(';', 1)[0], size, digest

    @staticmethod
    def verified(url, image):
        status, content_type, size, digest = Publisher.media_request(url)
        if status == 404:
            return False
        if status != 200:
            raise ValueError(f'{image.path.relative_to(ROOT)}: Media host returned HTTP {status}.')
        if (content_type != image.content_type or digest != image.digest or
                size != str(image.path.stat().st_size)):
            raise ValueError(f'{image.path.relative_to(ROOT)}: Published file metadata differs from the build.')
        return True

    def publish(self, image):
        url = self.origin + image.url_path
        if self.verified(url, image):
            return False
        status, _, _, _ = self.media_request(url, image, self.authorization())
        if status != 204:
            raise ValueError(f'{image.path.relative_to(ROOT)}: Media upload returned HTTP {status}.')
        if not self.verified(url, image):
            raise ValueError(f'{image.path.relative_to(ROOT)}: Image unavailable after upload.')
        return True


def publish_media(origin):
    url = urlsplit(origin)
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.path or url.query or url.fragment:
        raise ValueError('Set the public media origin to a bare HTTPS origin.')
    images, metadata = media_inventory(origin)
    publisher = Publisher(origin)
    uploaded = 0
    with ThreadPoolExecutor(max_workers=12) as pool:
        for checked, new in enumerate(pool.map(publisher.publish, images), start=1):
            uploaded += new
            if checked % 100 == 0:
                print(f'Verified {checked}/{len(images)} media files.', flush=True)
    temporary = MEDIA_DATA.with_suffix('.tmp')
    temporary.write_text(json.dumps(metadata, sort_keys=True) + '\n', encoding='utf-8')
    temporary.replace(MEDIA_DATA)
    print(f'Verified {len(images)} public media files across {len(metadata["versions"])} galleries. Uploaded {uploaded} new images.')


def strip_pages_site(site):
    if site.resolve() == ROOT or not (site / 'index.html').is_file():
        raise ValueError('Point --strip-pages at the built Pages folder.')
    metadata = json.loads(MEDIA_DATA.read_text(encoding='utf-8'))
    # A sharing image deliberately kept outside the gallery manifest stays on Pages.
    seo_images = json.loads(subprocess.check_output(
        ['ruby', '-ryaml', '-rjson', '-e', 'puts JSON.generate(YAML.safe_load_file(ARGV[0]))',
         str(ROOT / '_data/seo_images.yml')], text=True,
    ))
    sharing_paths = {image['path'] for image in seo_images.values() if image.get('path')}
    removed_bytes = 0
    for folder, versions in metadata['versions'].items():
        gallery = site / 'galleries' / folder
        for directory in (gallery, gallery / '1440p'):
            for path in directory.glob('*'):
                if not path.is_file() or path.suffix.lower() not in IMAGE_TYPES:
                    continue
                local_url = '/' + path.relative_to(site).as_posix()
                if directory == gallery and local_url in sharing_paths and path.name not in versions:
                    continue
                removed_bytes += path.stat().st_size
                path.unlink()

    bytes_left = sum(path.stat().st_size for path in site.rglob('*') if path.is_file())
    print(f'Excluded {removed_bytes / 1_000_000:.2f} MB of gallery images. Pages payload: {bytes_left / 1_000_000:.2f} MB.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument('--origin', help='Upload gallery images to this HTTPS media origin.')
    modes.add_argument('--strip-pages', type=Path, help='Remove gallery media copies from the built Pages output.')
    args = parser.parse_args()
    try:
        if args.origin:
            publish_media(args.origin)
        else:
            strip_pages_site(args.strip_pages)
    except KeyError as error:
        print(f'Gallery media publishing configuration is missing {error}.', file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError) as error:
        print(f'Gallery media publishing failed: {error}.', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
