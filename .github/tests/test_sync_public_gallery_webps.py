from email.message import Message
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    'sync_public_webps', Path(__file__).parents[1] / 'scripts/sync-public-gallery-webps.py')
sync_webps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_webps)


class SyncPublicWebpsTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.origin = 'https://media.example'
        self.revision = 'd' * 40
        data = self.root / '_data'
        data.mkdir()
        (data / 'gallery_delivery.json').write_text(json.dumps({
            'revision': 'a' * 40, 'service_origin': self.origin,
        }), encoding='utf-8')
        (data / 'public-gallery-originals.json').write_text(json.dumps({
            'galleries': {'hb-demo': {'First.jpg': {}, 'Compare.JPG': {}, 'Archived.jpg': {}}},
        }), encoding='utf-8')
        self.previews = self.root / 'galleries/hb-demo/1440p'
        self.previews.mkdir(parents=True)
        for name in ('First.webp', 'Compare.webp', 'Unapproved.webp'):
            (self.previews / name).write_bytes(b'previous bytes')
        head = patch.object(sync_webps.subprocess, 'check_output', return_value='e' * 40)
        head.start()
        self.addCleanup(head.stop)

    def response(self, url, _limit):
        if url.endswith('hb-demo.json'):
            names = ('First.jpg', 'Compare.JPG', 'Archived.jpg', 'Unapproved.jpg')
            return json.dumps({'images': dict.fromkeys(names, self.revision)}).encode(), Message()
        filename = url.split('/')[-1]
        if filename not in ('First.jpg', 'Compare.JPG'):
            self.fail(f'Unexpected derivative requested: {url}')
        data = b'RIFF\x00\x00\x00\x00WEBP' + filename.encode()
        digest = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
        headers = Message()
        headers['Content-Type'] = 'image/webp'
        headers['ETag'] = f'"{digest}"'
        return data, headers

    def test_updates_only_matching_webps_and_skips_an_already_deployed_snapshot(self):
        with patch.object(sync_webps, 'download', side_effect=self.response):
            self.assertTrue(sync_webps.sync(self.root, check_live=False))
            state = json.loads((self.root / sync_webps.STATE).read_text(encoding='utf-8'))
            self.assertEqual(state['releases'], {'hb-demo': {'First.jpg': self.revision, 'Compare.JPG': self.revision}})
            self.assertEqual(len(state['assets']), 2)
            for name in ('First.webp', 'Compare.webp'):
                self.assertEqual((self.previews / name).read_bytes()[8:12], b'WEBP')
            self.assertEqual((self.previews / 'Unapproved.webp').read_bytes(), b'previous bytes')
            with patch.object(sync_webps, 'live_state', return_value=state):
                with patch.object(sync_webps, 'fetch_webp') as fetch:
                    self.assertFalse(sync_webps.sync(self.root, check_live=True))
                    fetch.assert_not_called()

    def test_a_bad_download_leaves_every_existing_webp_intact(self):
        def bad_response(url, limit):
            data, headers = self.response(url, limit)
            return (data + b'corrupt', headers) if url.endswith('Compare.JPG') else (data, headers)

        with patch.object(sync_webps, 'download', side_effect=bad_response):
            with self.assertRaisesRegex(ValueError, 'Invalid replacement WebP'):
                sync_webps.sync(self.root, check_live=False)
        self.assertFalse((self.root / sync_webps.STATE).exists())
        self.assertEqual((self.previews / 'First.webp').read_bytes(), b'previous bytes')
        self.assertEqual((self.previews / 'Compare.webp').read_bytes(), b'previous bytes')
