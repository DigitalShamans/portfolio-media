# Firearms verification

Scope: Firearms only. Checked 19 November 2026. Website deployment/live acceptance remain pending until recorded below.

## Bounded checkpoints and source

- Baseline `3583b8069a28d2ab3edda4f5590e02a27cf442df`, source/status checkpoint `87caa40`. Existing map/GSAP navigation changes and completed gallery reports are preserved.
- Rendered ArtStation `58QBOJ` contains 20 JPGs and a native MP4 at position 2, after the lead image. Actual source download links, stable image/video IDs, order, dimensions, byte counts, SHA-256 and Git blob hashes are archived in the private source manifest. Temporary signed iframe URLs are not committed.
- Private source checkpoint `5a01cc02634c80aa65f8c60a15f6d942b7e8a730`; private PR #4 merged as approved revision `3b580d05d7955009fb0f9f4138c1df79f486ff10`. Only the 20 JPGs are added to the originals delivery allowlist; the native MP4 is archived privately and delivered as an approved public website file.
- Images are six 2560×1366 and fourteen 1920×1080. No genuine 3840×2160 source image is verified, including files whose source variant is labelled `4k`. Original bytes are preserved without upscaling.
- Native MP4 is 2560×1440, 18.5 seconds, 27,253,962 bytes; SHA-256 `95d6742e969bd380242912f553b8cf834b5d122f25e4d82f2786be0bee80a99a`, Git blob `cc7798d6711514dac3a4a4ec8ddf08e4b79f10e1`. Exact public copy; no transcode. Container metadata was independently parsed.

## Media and original service — passed

- All 20 source JPGs decode and match exact source dimensions, approved bytes, SHA-256 and Git blobs. Twenty corresponding WebPs decode, retain exact filename case/source image order/ICC profiles and match the existing Pillow 13 EXIF-transpose/Lanczos fit-within-2560×1440/quality-92/method-6 recipe without crop/upscale. Total WebP bytes: 6,235,386. Media checkpoint `7a08fa4`.
- Existing public media service v8 source `8f51841777c92bcc2aa69cc9fdab7a5210bb0f28`, deployment `appgdep_6afeeeb85be481918250886d37504e02`, succeeded at `2026-11-19T12:42:45Z`, environment revision 13. All four earlier active revisions remain active; existing audience and protected-media code/secrets are unchanged.
- All 20 anonymous Firearms JPG GETs returned HTTP 200 `image/jpeg` and passed actual decode, dimensions, exact approved SHA-256/Git blob/byte checks (8,737,616 bytes total). Existing NFS, Aircrafts and Phantom samples passed at their retained revisions. Unknown revision, unapproved filename, case mismatch and MP4-through-JPEG-endpoint all returned 404. Windows system HTTPS trust was used without TLS bypass.
- Media-service build and all 14 existing gateway/auth/cache tests passed.

## Page integration and controlled tests — passed

- Both new routes reuse the gallery layout and image fullscreen viewer; noindex/sitemap exclusion and no new homepage/navigation entry. Existing external ArtStation cards are preserved.
- `gallery.json` remains an image-only array of 20 original JPG references. Separate companion metadata anchors the native MP4 after the lead JPG and before the second JPG. Reorder/comparison/exclusion relationships use stable filenames.
- Minimal backward-compatible video support accepts a strict local `.mp4` basename, rejecting URLs, slashes, traversal, queries, encoded and whitespace paths. Native controls, inline playback, metadata preload and existing asset-version URLs are used; no forced autoplay. Existing YouTube/Sketchfab providers and image delivery are retained.
- Twenty-one maintained embed tests and all 17 controlled delivery browser tests passed. Broader maintained tests pass 87 cases; two existing public-route cases are blocked locally by unavailable Ruby and will run in normal Pages CI. Coverage includes native video URLs/controls/responsive layout/fullscreen/failure isolation and existing JPG retry/WebP fallback, previous-image preservation, stale navigation/comparison and protected gallery behavior.
- A separate isolated-browser test loaded the actual MP4, decoded 2560×1440/18.5 seconds, advanced playback, sought to 9.25 seconds and entered/exited native fullscreen with zero page errors. Its fixture honors byte ranges; actual deployed hosting/range/playback remain a separate live check.

## Remaining acceptance

Final tracked-path/version generation, actual native Gallery Editor save/reopen, terminal Pages build/deployment, both real portfolio routes, all public media/range/hash checks, actual live video playback/fullscreen, responsive original/WebP delivery, sitemap/navigation exclusions and existing-gallery smoke checks remain pending. Parser checks are not represented as a native editor UI test; local playback is not represented as deployed playback.
