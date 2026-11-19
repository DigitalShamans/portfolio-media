#!/usr/bin/env python3
"""Probe the source projects from the GitHub runner and record the ordered assets."""
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36', 'Accept': 'application/json,text/html;q=0.9,*/*;q=0.8', 'Referer': 'https://www.artstation.com/'}
report = {}
for code in ['w8LJ5g','A9VRrq','58QBOJ']:
    attempts = []
    for url in [f'https://www.artstation.com/projects/{code}.json', f'https://www.artstation.com/api/v2/projects/{code}.json', f'https://www.artstation.com/artwork/{code}', f'https://digital_shamans.artstation.com/projects/{code}']:
        entry = {'endpoint': url}
        try:
            with urlopen(Request(url, headers=headers), timeout=25) as response:
                body = response.read(15000000)
                entry['status'] = response.status
                entry['content_type'] = response.headers.get('Content-Type', '')
            try:
                parsed = json.loads(body)
                if isinstance(parsed, dict):
                    assets = parsed.get('assets', [])
                    entry['title'] = parsed.get('title')
                    entry['assets_count'] = len(assets)
                    entry['assets'] = [{k: asset.get(k) for k in ['id','asset_type','image_url','image_url_4k','embed_url','video_url','name']} for asset in assets]
                    if assets: entry['success'] = True
                else: entry['error'] = 'JSON root not an object'
            except ValueError:
                entry['response_head'] = body[:1000].decode('utf-8', 'replace')
        except HTTPError as exc:
            entry['status'], entry['error'] = exc.code, str(exc)
        except (URLError,TimeoutError) as exc:
            entry['error'] = str(exc)[:200]
        attempts.append(entry)
        if entry.get('success'): break
    report[code] = attempts
Path('.github/artstation-probe.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
for code,items in report.items():
    print(code, [(x.get('status'),x.get('title'),x.get('assets_count'),x.get('error')) for x in items])
