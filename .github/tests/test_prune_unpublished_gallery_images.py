"""Exercise build-only cleanup and the references that must protect an image."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/prune-unpublished-gallery-images.py'


class PublicationCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.site = Path(self.temporary.name) / '_site'
        self.media_config = Path(self.temporary.name) / 'gallery_delivery.json'
        self.media_config.write_text('{"revision": null}', encoding='utf-8')
        self.gallery = self.site / 'galleries/example'
        self.gallery.mkdir(parents=True)
        (self.site / 'index.html').write_text('<!doctype html>', encoding='utf-8')
        self.entries = [{'image': 'Final.jpg', 'compare': 'Wireframe.jpg',
                         'additionalImages': ['Checker.jpg']}]
        self.write_manifest()
        for name in ('Final.jpg', 'Wireframe.jpg', 'Checker.jpg'):
            self.image(name)
            self.image('1440p/' + Path(name).with_suffix('.webp').name)
        self.image('Omitted.jpg')

    def write_manifest(self):
        (self.gallery / 'gallery.json').write_text(json.dumps(self.entries), encoding='utf-8')

    def image(self, name):
        path = self.gallery / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'image fixture')
        return path

    def run_cleanup(self, apply=True):
        args = [sys.executable, str(SCRIPT), str(self.site), '--media-config', str(self.media_config)]
        if apply:
            args.append('--apply')
        return subprocess.run(args, capture_output=True, text=True)

    def assert_safe_failure(self):
        result = self.run_cleanup()
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertTrue((self.gallery / 'Omitted.jpg').exists())
        return result

    def test_keeps_all_selected_variants_and_previews_without_touching_source(self):
        source = Path(self.temporary.name) / 'source/Omitted.jpg'
        source.parent.mkdir()
        source.write_bytes(b'original')
        result = self.run_cleanup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.gallery / 'Omitted.jpg').exists())
        self.assertEqual(source.read_bytes(), b'original')
        for name in ('Final.jpg', 'Wireframe.jpg', 'Checker.jpg'):
            self.assertTrue((self.gallery / name).exists())
            self.assertTrue((self.gallery / '1440p' / Path(name).with_suffix('.webp')).exists())

    def test_dry_run_keeps_files(self):
        result = self.run_cleanup(apply=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"remove_count": 1', result.stdout)

    def test_activated_delivery_excludes_originals_and_preserves_previews_and_public_images(self):
        self.media_config.write_text(json.dumps({'revision': 'a' * 40}), encoding='utf-8')
        (self.gallery / 'Final.jpg').unlink()
        banner = self.site / 'projects/hb-rzstart/hb_rzstart_header_400.jpg'
        banner.parent.mkdir(parents=True)
        banner.write_bytes(b'public fixture')
        (self.site / 'index.html').write_text(
            '<img src="/projects/hb-rzstart/hb_rzstart_header_400.jpg">'
            '<meta property="og:image" content="/galleries/example/1440p/Final.webp">',
            encoding='utf-8')
        result = self.run_cleanup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(banner.exists())
        self.assertEqual(list(self.gallery.glob('*.jpg')), [])
        for name in ('Final', 'Wireframe', 'Checker'):
            self.assertTrue((self.gallery / f'1440p/{name}.webp').exists())

    def test_activated_delivery_rejects_old_local_original_links(self):
        self.media_config.write_text(json.dumps({'revision': 'a' * 40}), encoding='utf-8')
        (self.site / 'index.html').write_text(
            '<meta property="og:image" content="/galleries/example/Final.jpg">',
            encoding='utf-8')
        result = self.assert_safe_failure()
        self.assertIn('Public markup still points to migrated original', result.stderr)
        self.assertTrue((self.gallery / 'Omitted.jpg').exists())

    def test_local_gallery_keeps_the_manifest_images_with_remote_delivery_enabled(self):
        self.media_config.write_text(json.dumps({
            'revision': 'a' * 40,
            'local_galleries': {'example': 'branding'},
        }), encoding='utf-8')
        self.entries = [{'image': 'Logo.png', 'compare': 'Mark.png'}]
        self.write_manifest()
        logo = self.image('Logo.png')
        mark = self.image('Mark.png')
        preview = self.image('1440p/Logo.webp')
        result = self.run_cleanup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(logo.is_file())
        self.assertTrue(mark.is_file())
        self.assertFalse(preview.exists())

    def test_obsolete_double_extension_previews_are_removed(self):
        old = self.image('1440p/Final.jpg.webp')
        result = self.run_cleanup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(old.exists())
        self.assertTrue((self.gallery / '1440p/Final.webp').exists())

    def test_reselecting_an_omitted_image_retains_it_on_next_build(self):
        self.entries.append({'image': 'Omitted.jpg'})
        self.write_manifest()
        self.image('1440p/Omitted.webp')
        result = self.run_cleanup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((self.gallery / 'Omitted.jpg').exists())
        self.assertTrue((self.gallery / '1440p/Omitted.webp').exists())

    def test_page_seo_css_and_personal_base_references_are_preserved(self):
        names = ['SEO.jpg', 'Linked.jpg', 'Stylesheet.jpg', 'Inline.jpg',
                 'StyleBlock.jpg', 'With (parentheses).jpg', 'Picture.jpg']
        for name in names:
            self.image(name)
        personal = self.site / 'artur/galleries/example/index.html'
        personal.parent.mkdir(parents=True)
        personal.write_text('''<base href="/galleries/example/">
            <meta property="og:image" content="https://digitalshamans.co.uk/galleries/example/SEO.jpg?v=abc">
            <a href="Linked.jpg?tracking=1#image">Image</a>
            <div style="background: url('Inline.jpg')"></div>
            <style>.image { background: URL("StyleBlock.jpg"); }</style>
            <img srcset="Picture.jpg 1x, Final.jpg 2x">
            ''', encoding='utf-8')
        css = self.site / 'assets/site.css'
        css.parent.mkdir()
        css.write_text('''.one { background: url(../galleries/example/Stylesheet.jpg); }
            .two { background: url("/galleries/example/With%20(parentheses).jpg"); }''', encoding='utf-8')
        result = self.run_cleanup()
        self.assertEqual(result.returncode, 0, result.stderr)
        for name in names:
            self.assertTrue((self.gallery / name).exists(), name)
        self.assertFalse((self.gallery / 'Omitted.jpg').exists())

    def test_asset_version_metadata_does_not_select_an_omitted_image(self):
        (self.site / 'index.html').write_text(
            '<div data-gallery-asset-versions=\'{"Omitted.jpg":"hash"}\'></div>', encoding='utf-8')
        result = self.run_cleanup()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.gallery / 'Omitted.jpg').exists())

    def test_missing_selected_asset_aborts_before_deletion(self):
        (self.gallery / 'Checker.jpg').unlink()
        self.assert_safe_failure()

    def test_missing_selected_preview_aborts_before_deletion(self):
        (self.gallery / '1440p/Checker.webp').unlink()
        self.assert_safe_failure()

    def test_invalid_manifests_abort_before_deletion(self):
        for value in ('{', '[]', '{}', '[{"image":"../outside.jpg"}]'):
            with self.subTest(value=value):
                (self.gallery / 'gallery.json').write_text(value, encoding='utf-8')
                self.assert_safe_failure()

    def test_protected_media_in_either_portfolio_aborts_before_deletion(self):
        for folder in ('galleries/hb-rzstart', 'artur/galleries/hb-rzstart'):
            with self.subTest(folder=folder):
                path = self.site / folder / 'Private.jpg'
                path.parent.mkdir(parents=True)
                path.write_bytes(b'private fixture')
                result = self.assert_safe_failure()
                self.assertIn('Protected media found', result.stderr)
                path.unlink()

    def test_source_configuration_is_refused(self):
        (self.site / '_config.yml').write_text('url: https://example.test', encoding='utf-8')
        result = self.assert_safe_failure()
        self.assertIn('not a source checkout', result.stderr)

    def test_no_manifest_is_refused(self):
        (self.gallery / 'gallery.json').unlink()
        self.assert_safe_failure()

    def test_no_built_homepage_is_refused(self):
        (self.site / 'index.html').unlink()
        self.assert_safe_failure()


if __name__ == '__main__':
    unittest.main()
