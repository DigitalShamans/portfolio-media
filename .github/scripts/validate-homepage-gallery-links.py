"""Check Recent Work gallery links in the generated portfolio homepages."""

import argparse
from html.parser import HTMLParser
from pathlib import Path
import sys
from urllib.parse import unquote, urljoin, urlsplit


HOMEPAGES = (Path('index.html'), Path('artur/index.html'))


class RecentGalleryLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag != 'a':
            return
        anchor = dict(attrs)
        if 'recent-gallery' in (anchor.get('class') or '').split():
            self.links.append(anchor.get('href'))


def has_gallery_page(site, homepage, href):
    if not href:
        return False
    try:
        link = urlsplit(urljoin('/' + homepage.as_posix(), href))
        if link.scheme or link.netloc:
            return False
        route = unquote(link.path)
        output = site / route.lstrip('/')
        if not route.endswith('.html'):
            output /= 'index.html'
        page = output.resolve()
        gallery_root = site / homepage.parent / 'galleries'
        return page.is_relative_to(gallery_root) and page.is_file()
    except (OSError, ValueError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('site', type=Path, help='Jekyll output directory')
    site = parser.parse_args().site.resolve()
    checked = failures = 0
    for homepage in HOMEPAGES:
        links = RecentGalleryLinks()
        try:
            links.feed((site / homepage).read_text(encoding='utf-8'))
            links.close()
        except (OSError, UnicodeError) as error:
            print(f'Could not read generated homepage {homepage} ({error}).', file=sys.stderr)
            failures += 1
            continue

        for href in links.links:
            checked += 1
            if not has_gallery_page(site, homepage, href):
                print(
                    f'Gallery link {href!r} on {homepage} has no matching gallery page in the build.',
                    file=sys.stderr,
                )
                failures += 1

    if failures:
        return 1
    print(f'Validated {checked} Recent Work gallery links across both homepages.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
