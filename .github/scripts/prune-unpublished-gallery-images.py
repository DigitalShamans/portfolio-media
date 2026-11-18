"""Prune unused public gallery images from Jekyll output; source files stay intact."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urljoin, urlsplit

IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'}
ORIGIN = 'https://digitalshamans.co.uk/'


def css_urls(css):
    pattern = r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)'''
    for match in re.finditer(pattern, css, re.IGNORECASE):
        yield next(value for value in match.groups() if value is not None).strip()


class References(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.base = ''
        self.urls = []
        self.in_style = False
        self.styles = []

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == 'base':
            self.base = attributes.get('href') or ''
        if tag == 'style':
            self.in_style = True
        if attributes.get('style'):
            self.styles.append(attributes['style'])
        for key in ('src', 'href', 'poster'):
            if attributes.get(key):
                self.urls.append(attributes[key])
        if tag == 'meta' and attributes.get('content'):
            self.urls.append(attributes['content'])
        if attributes.get('srcset'):
            self.urls.extend(part.strip().split()[0]
                             for part in attributes['srcset'].split(',') if part.strip())

    def handle_data(self, data):
        if self.in_style:
            self.styles.append(data)

    def handle_endtag(self, tag):
        if tag == 'style':
            self.in_style = False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('site', type=Path)
    parser.add_argument('--apply', action='store_true')
    options = parser.parse_args()
    site = options.site.resolve(strict=True)
    source = Path(__file__).resolve().parents[2]
    if site == source or (site / '_config.yml').exists() or (site / '.git').exists():
        raise ValueError('Expected Jekyll build output, not a source checkout; refusing to prune.')
    if not (site / 'index.html').is_file():
        raise ValueError('No built homepage found; refusing to prune.')
    required = set()
    manifests = sorted((site / 'galleries').glob('*/gallery.json'))
    if not manifests:
        raise ValueError('No public gallery manifests found; refusing to prune.')
    for folder in ('galleries/hb-rzstart', 'artur/galleries/hb-rzstart'):
        for path in (site / folder).rglob('*'):
            if path.is_file() and (path.name == 'gallery.json' or
                                   path.suffix.lower() in IMAGE_SUFFIXES):
                raise ValueError(f'Protected media found in public output: {path}')
    for manifest in manifests:
        entries = json.loads(manifest.read_text(encoding='utf-8-sig'))
        if not isinstance(entries, list) or not entries:
            raise ValueError(f'Invalid gallery manifest: {manifest}')
        for entry in entries:
            names = [entry['image'], entry.get('compare'),
                     *(entry.get('additionalImages') or [])]
            for name in names:
                if name is None:
                    continue
                if not isinstance(name, str) or Path(name).name != name or \
                        any(ord(c) < 32 for c in name) or chr(92) in name:
                    raise ValueError(f'Invalid image filename: {name!r}')
                if Path(name).suffix.lower() not in IMAGE_SUFFIXES:
                    raise ValueError(f'Unsupported image filename: {name!r}')
                for path in (manifest.parent / name,
                             manifest.parent / '1440p' / Path(name).with_suffix('.webp')):
                    path = path.resolve(strict=True)
                    if not path.is_relative_to(site) or not path.is_file():
                        raise ValueError(f'Invalid public image: {path}')
                    required.add(path)

    def retain_url(value, base):
        url = urlsplit(urljoin(base, value))
        if url.hostname not in ('digitalshamans.co.uk', 'www.digitalshamans.co.uk'):
            return
        path = (site / unquote(url.path).lstrip('/')).resolve()
        if path.is_relative_to(site) and path.is_file():
            required.add(path)

    # Preserve SEO images, fallback pictures, and any explicit page/CSS image links.
    # Asset-version data attributes are metadata, not image references.
    for page in site.rglob('*.html'):
        document = References()
        document.feed(page.read_text(encoding='utf-8'))
        base = urljoin(ORIGIN, page.relative_to(site).as_posix())
        base = urljoin(base, document.base)
        for value in document.urls:
            retain_url(value, base)
        for css in document.styles:
            for value in css_urls(css):
                retain_url(value, base)
    for stylesheet in site.rglob('*.css'):
        base = urljoin(ORIGIN, stylesheet.relative_to(site).as_posix())
        for value in css_urls(stylesheet.read_text(encoding='utf-8')):
            retain_url(value, base)

    candidates = {path.resolve() for manifest in manifests
                  for path in manifest.parent.rglob('*')
                  if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES}
    plan = sorted(candidates - required)
    if any(not path.is_relative_to(site / 'galleries') for path in plan):
        raise ValueError('Removal outside public galleries; refusing to prune.')
    removed_bytes = sum(path.stat().st_size for path in plan)
    print(json.dumps({'apply': options.apply, 'remove_count': len(plan),
                      'remove_bytes': removed_bytes,
                      'paths': [path.relative_to(site).as_posix() for path in plan]}, indent=2))
    if options.apply:
        for path in plan:
            path.unlink()
    files = [path for path in site.rglob('*') if path.is_file()]
    print(json.dumps({'published_files': len(files),
                      'published_payload_bytes': sum(path.stat().st_size for path in files)}))

if __name__ == '__main__':
    main()
