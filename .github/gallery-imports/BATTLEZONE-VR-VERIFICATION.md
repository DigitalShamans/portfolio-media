# Battlezone VR verification

Result: published and verified on both portfolio routes. One gallery, one media-service release and one Pages release. No unresolved publication blocker.

- Source: https://www.artstation.com/artwork/9mb0zW
- Studio: https://digitalshamans.co.uk/galleries/battlezone-vr/
- Personal: https://digitalshamans.co.uk/artur/galleries/battlezone-vr/

## Source and preparation - passed

Rendered source contains a leading YouTube accolades trailer (PGp2Fjsuni8), one genuinely empty second container, then 15 JPGs. The empty container is documented and omitted. Actual download links including dl=1, filename case, image order and trailer caption are preserved. All originals are 1920x1080, totaling 6,221,915 bytes. No 4K source was supplied or invented. The public description avoids repeating the source description's unsupported game-history statement.

All 15 original hashes, Git blobs, dimensions and full JPEG decodes passed. Fifteen matching WebPs total 3,391,318 bytes and use Lanczos/q92/method6, EXIF/ICC handling and no crop/upscale. Every published WebP passed hash/blob/full-decode checks. Image-only gallery.json retains original JPG names. A separate companion anchors the trailer before digital-shamans-artur-perzyna-battlezone-cg3d-8.jpg. Production parsers, image order and provider/anchor validation passed. Downloads: 3.883 seconds; preparation: 2.258 seconds.

Private PR 7 merged as 985ce8fac8ea8b23f0acf69489e2fef2735b953c. One immutable Git-tree query matched all 15 approved blobs/sizes. Previous approvals remain. Source checkpoint: cf968dc6f63e59e5ebcb5f1ef32133a79b864d82. Public content checkpoint: d4c639f.

## Actual native editor - passed

DS Gallery Editor v0.11 rendered all 15 individual previews and the leading YouTube row before its filename anchor. Adjacent reorder, explicit Save, reopen and canonical restoration/Save passed. The trailer followed its anchor during reorder. Companion bytes and original hashes stayed unchanged; final scratch manifest bytes match canonical stage. No production UI edits, editor timeout or Chrome use.

## Original service - passed

Catalog-only v11 source: dcfd45f9ea6107ef7adf27e85b2324f525e0f446. Deployment appgdep_6aff1951a6d88191833267cda736d7be succeeded at 15:44:31 UTC, environment 16. The new catalog contains only Battlezone; seven previous catalogs/active revisions remain. Gateway 14/14 tests and build passed. Runtime/access protections were unchanged.

Actual checks passed for all 15 originals: exact size/SHA-256/Git blob/full decode/dimensions/orientation. Three retained NFS/Aircrafts/Phantom samples passed. Unknown revision, missing file, wrong case and video-endpoint probes returned 404. Total22 real GETs (18x200,4x404) in 11.64s, with 10s deadlines and Windows TLS verification.

## Website delivery and build - passed

Public PR 71 merged as741a23ede947971e908c7cc8276bd61a9f33c5b5. Pages run 44558772810 built/deployed successfully at 15:49:21 UTC. Both served route documents report this exact implementation revision. Only the new gallery's approved-original override was added; global fallback and old galleries remain intact.

Thirty-one public GETs passed in 6.45s:15 WebPs, canonical image/companion manifests, both route documents, nine script/style/mobile dependencies, homes and sitemap. Titles, leading trailer, caption, order, immutable original revision and all 17 asset-version entries match. Both routes are noindex and excluded from sitemap/homepage/navigation. External ArtStation cards remain. Maintained browser/resolution/header/prefetch/arrival/embed tests passed 76/76. Ruby/Jekyll checks passed in Pages CI; no local Ruby pass is claimed.

## Actual deployed browser acceptance - passed

Both studio and personal routes were checked in the in-app browser at actual widths 390 and 2800 CSS pixels. At390 both use versioned WebP, the iframe fits its351px content width and there is no horizontal overflow. At2800 both load the approved immutable JPG with its real 1920px natural width. On each route at each width, the image viewer completed1 ->2 ->1 and exited. No 4K natural-width claim is made.

Both live YouTube players decoded and played video, paused, resumed and sought forward. Studio played past 31.79369s, paused at 31.852605 and sought to 41.852605. Personal had readyState4/no error, paused at 0.237054, sought to 10.237054 and resumed past 10.61939. Both actual players changed to Exit full screen after entering fullscreen. Studio iframe geometry expanded to 2785x1600; personal fullscreen exit was separately confirmed. Source playback alone was not substituted for live acceptance.

An earlier test used an inactive tab while viewport changes applied to the selected fallback tab. Acceptance was rebound to selected tab13 and actual widths were read back; both video fullscreen checks then passed. Original attempts remain in BATTLEZONE-VR-BROWSER.json. IAB denied two native image Fullscreen API requests; the existing screen-filling image overlay, navigation and Escape exit worked. Native image Fullscreen API, physical touch devices, iOS and Safari remain unverified.

Policy: in-app first,5s observations, one fresh retry,2s delivery fallback,5s locators and 15s CUA calls. An initial source timeout recovered on a fresh tab in 0.785s. Initial live assertions ran before embeds mounted; waiting for the visible iframe resolved the race. No native Chrome was launched. Desktop/mobile screenshots were visually inspected; viewport overrides were reset.

## Timing and checkpoint

Request:15:28:00.896 UTC. Publication:15:49:21, after 21m20s. Browser/file/visual acceptance:16:02:30, after 34m29s,46.44% below the 64m23s baseline. Final evidence preparation is separately recorded in BATTLEZONE-VR-TIMINGS.json. The 32m11.5s half-time target was missed; publication time is not presented as full acceptance time.

Final evidence and STATUS are pushed on codex/battlezone-vr-20261119 per the established workflow. They can accompany the next requested content release without a second documentation-only Pages deployment. Battlezone is the seventh Full Portfolio conversion. No other gallery was started.
