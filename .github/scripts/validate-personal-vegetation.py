"""Verify the exact published HTML, manifest and viewer bytes before deployment."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
from urllib.parse import urljoin, urlsplit, parse_qs


class GalleryPage(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.gallery = None
        self.viewer = None
        self.base = None
        self.versions = {}
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'base':
            self.base = attrs.get('href')
        if tag == 'body':
            self.versions = json.loads(attrs.get('data-gallery-asset-versions', '{}'))
        if tag == 'section' and 'gallery' in attrs.get('class', '').split():
            self.gallery = attrs
        if tag == 'script' and 'gallery-viewer.js?' in attrs.get('src', ''):
            self.viewer = attrs['src']


site = Path(sys.argv[1])
personal = GalleryPage(site / 'artur/galleries/vegetation/index.html')
studio = GalleryPage(site / 'galleries/vegetation/index.html')
folder = site / 'galleries/vegetation'
full = json.loads((folder / 'gallery.json').read_text(encoding='utf-8'))
payload = (folder / 'gallery-personal.json').read_bytes()
filtered = json.loads(payload)
excluded = set(json.loads(personal.gallery['data-gallery-exclude']))
assert personal.gallery['data-gallery-manifest'] == 'gallery-personal.json'
assert urljoin(personal.base, personal.gallery['data-gallery-manifest']) == '/galleries/vegetation/gallery-personal.json'
assert filtered == [entry for entry in full if entry['image'] not in excluded]
assert 'data-gallery-manifest' not in studio.gallery and 'data-gallery-exclude' not in studio.gallery
assert personal.versions['gallery-personal.json'] == hashlib.sha256(payload).hexdigest()
viewer = (site / 'galleries/gallery-viewer.js').read_bytes()
for page in (personal, studio):
    assert parse_qs(urlsplit(page.viewer).query)['v'] == [hashlib.sha256(viewer).hexdigest()]
assert b"galleryAssetUrl(gallery.dataset.galleryManifest || 'gallery.json')" in viewer
print(f'Built Vegetation verified: personal {len(filtered)}, studio {len(full)}; viewer and manifest revisions match.')
