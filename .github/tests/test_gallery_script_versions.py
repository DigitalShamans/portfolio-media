import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/generate-gallery-asset-versions.py'
spec = importlib.util.spec_from_file_location('gallery_versions', SCRIPT)
versions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(versions)


class GalleryScriptVersionsTests(unittest.TestCase):
    def test_revision_tracks_only_viewer_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            viewer = root / 'galleries/gallery-viewer.js'
            viewer.parent.mkdir()
            viewer.write_bytes(b'first revision')
            with patch.object(versions, 'ROOT', root):
                expected = hashlib.sha256(b'first revision').hexdigest()
                self.assertEqual(versions.gallery_script_versions(), {'viewer': expected})
                (root / 'unrelated.txt').write_text('unrelated edit')
                self.assertEqual(versions.gallery_script_versions(), {'viewer': expected})
                viewer.write_bytes(b'second revision')
                self.assertEqual(versions.gallery_script_versions(), {
                    'viewer': hashlib.sha256(b'second revision').hexdigest()
                })
