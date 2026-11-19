# Strange Brigade - Environment Art verification

Result: **published and verified**, one gallery per release, no remaining publication blocker. Source: [ArtStation Vd5Vg5](https://www.artstation.com/artwork/Vd5Vg5). This is the tenth converted Full Portfolio gallery. Both [studio](https://digitalshamans.co.uk/galleries/strange-brigade-environment-art/) and [Artur](https://digitalshamans.co.uk/artur/galleries/strange-brigade-environment-art/) routes are live.

## Source and media checkpoint

The rendered source exposed 34 asset containers: 33 real JPGs and a genuinely empty second container. No embeds/video were present. The empty position was omitted without inventing an image. Original filename case and real download URLs including dl=1 are preserved in provenance. Although the source download paths include /4k/, all downloaded originals decode to 2560x1440. No 4K claim or upscale is made.

Originals: 28,815,630 bytes. WebPs: 20,910,770 bytes. All 33 of each passed exact bytes/size, SHA-256, Git blob, full Pillow decode, dimensions and orientation checks. Derivatives use fit within2560x1440, Lanczos, q92/method6, EXIF/ICC preservation and no crop/upscale. Downloads4.691s, preparation10.723s. First image digital-shamans-1-impr-03-srgb.jpg; last digital-shamans-rightwing-room-02-srgb.jpg.

Captions occur as siblings of asset-container inside project-asset. The initial narrower capture missed them; this was corrected before normalization/download/preparation/archive. All 33 filename/text pairs are retained. Sixteen captions read “From a blockout to the production quality.”; seventeen carry the longer exact terrain/set-dressing/material/lighting/technical responsibilities text. The project description is empty in source and retained as such; page metadata description is explicitly derived from source caption text.

## Native editor checkpoint

Actual installed DS Gallery Editor v0.11, in an isolated scratch copy: all 33 individually selected previews rendered. Adjacent reorder, explicit Save, folder reopen and persisted order passed; canonical order was restored and saved. The array remains image-only, exact case/order/resolution was verified, all original hashes are unchanged and immutable stage was untouched. The editor changes JSON formatting, so canonical manifest bytes were restored in scratch after preserving editor output. Final canonical SHA-256: f5b3f6d43333b7d034b9a64f01594d070c6a464adec2425ade7769311c8278da. Full native result/checklist: STRANGE-BRIGADE-EDITOR.md.

## Private and media-service checkpoint

Private source commit2290420f7417a2b22fa4f54fb804c50ce7e2189b; [PR11](https://github.com/DigitalShamans/portfolio-media-private/pull/11) merged at3ea1ff2006349804fde73818e2c16d7e21af0586. All 33 immutable Git tree blobs and sizes matched prepared originals. Previous approvals remain.

Existing Site appgprj_6afbf3a4aa2c81919821379c8fde09df was opened through the supported source helper before editing and at the committed new head before packaging. Public audience/owner/access protections remained unchanged. Source59af59c11926d13128283be854288ccf08d5df14, saved version appgprj_6afbf3a4aa2c81919821379c8fde09df~appgver_d9474d4aa4a081918d26f214f432ce13. Deployment appgdep_6aff4937bf6881918acc91f3b457e903 reached terminal success2026-11-19T19:08:52.912131Z, environment19. This incoming catalog was appended to ten retained prior catalogs/active revisions. Runtime/security/caching behavior was not replaced.

All40 actual service GETs passed in24.86s with Windows TLS and10s/request bounds:33 new originals plus3 retained samples returned200 and exact hashes/full decode/dimensions;4 unknown revision/missing file/wrong case/video-at-JPEG-endpoint requests returned expected404. See STRANGE-BRIGADE-SERVICE.md.

## Website and caption checkpoint

Source/feature checkpointd03dbad; publication head5a53c5b5c2b60a3c1511db64c1565435f44491e4. [PR78](https://github.com/DigitalShamans/portfolio-media/pull/78) merged at154bcdc1cf51be2dad7bc5f52507db5351b054e8 after navigation CI44596427877 succeeded. [Pages run44596596001](https://github.com/DigitalShamans/portfolio-media/actions/runs/44596596001) completed successfully2026-11-19T19:17:52Z. Actual HTML from both routes carries that expected build revision.

All48 public GETs passed in9.97s:33 WebPs with exact bytes/hash/full decode, canonical image-only manifest/order, both HTML documents/noindex/title/lead/revision, exact33 caption template mappings per route,34 asset versions,9 script/style/mobile dependencies, both homes/navigation and sitemap. Both pages are unlisted/noindex/sitemapfalse; existing ArtStation portfolio cards, navigation, old approvals/overrides and global fallback remain intact. See STRANGE-BRIGADE-PUBLIC.md.

Caption support is optional and filename keyed, outside editor-compatible gallery.json. The studio page carries gallery_captions; the personal page uses the same gallery_page metadata. Escaped inert template data is rendered using textContent, with accessible caption identifiers/aria-describedby. A gallery-scoped child-list observer remounts captions after async gallery replacement without observing its own subtree. Existing galleries without metadata do not emit template or load caption assets. The importer now emits this data automatically, including safe omission of null/empty caption text. Current generated page matches after normalizing Windows line endings. Core viewer v43, original-resolution selection, maps, comparisons and service runtime are unchanged.

Meaningful checks passed:58/58 caption plus maintained browser/resolution/prefetch/arrival/embed regressions;11/11 pinned-Pillow13 importer tests;14/14 gateway tests and build. No duplicate test sweep was needed after documentation-only finalization.

## Actual live interaction checkpoint

In-app browser first, background tabs, bounded5s locator/observation calls and15s tool calls. Actual checks passed on both routes at390x844 and2800x1600. All33 captions matched original filenames/text and accessible associations with no horizontal overflow. Small viewports decoded2560-wide WebPs; wide viewports decoded approved original2560-wide JPGs. Actual viewer controls navigated1→2→1 and exit closed the overlay. Overlay dimensions matched the viewport. Survisland smoke showed48 shots, zero captions/template/caption scripts/styles, confirming optional isolation.

One initial cold desktop observation raced image decode; explicit named-image visibility and fresh decoded-image reads passed. An attempted owned-helper update via string code generation was denied; subsequent literal documented API calls completed the checks. IAB produced five native Fullscreen API grant warnings; actual full-viewport overlays/navigation passed. Native fullscreen grant and physical touch/iOS/Safari are not claimed.

Desktop proof was visually inspected. The first mobile screenshot caught placeholders before painting; it was replaced with loaded content and visually inspected. Binding the old tab timed out at15s; one fresh IAB tab succeeded. No Chrome was launched and no user browser/editor prompt was required. Final mobile proof2026-11-19T19:27:36.184Z. Viewport overrides were reset. Evidence: STRANGE-BRIGADE-BROWSER.json and the two user-facing screenshots in outputs.

## Automatic capture release and final checkpoint

After the last screenshots, native/root CUA sessions and root node_repl were reset. Exact saved process name/path/parent/UTC creation identity was verified before stopping original Swift17576. Native child2300 and parent29160 had already exited. One bounded automatic-restart retry stopped Swift48628. Zero original survivors, zero errors. A newly warmed Swift20664 was observed; presence alone does not establish active capture, so no unbounded restart loop was attempted. Main app, other recorders, Chrome, privacy controls and Windows capture-border settings were untouched.

Cleanup finished2026-11-19T19:28:37.0059816Z. No screenshot or capture observation followed. Yellow-border disappearance was not inferred from process counts. See STRANGE-BRIGADE-CAPTURE-CLEANUP.json.

Start18:50:29Z; source complete18:55:55.790785Z; Pages success19:17:52Z; final verified proof19:27:36.184Z; capture release19:28:37.0059816Z. Verification/cleanup duration 2288.006s =38m08s, 40.77% below64m23s Firearms baseline, **not within half-time target32m11.5s**. Final documentation preparation at2026-11-19T19:30:44.781584+00:00, elapsed2415.782s; push/final response add overhead. Caption-feature work and corrected proof contributed; publish time is not substituted for end-to-end completion. See STRANGE-BRIGADE-TIMINGS.json.

Final verification/status/evidence is committed and pushed on codex/strange-brigade-20261119, to be carried into the next gallery release. A second documentation-only Pages release is intentionally avoided. No next gallery has been started.
