# Gallery publication status

Current scope: Firearms only — published and verified on both portfolio routes.

## Bounded checkpoints

1. Baseline/source: rendered ArtStation `58QBOJ` verified 20 JPGs plus an 18.5-second native MP4 after the lead image. Baseline/status `87caa40`; private source checkpoint `5a01cc0`; exact assets/provenance archived without signed temporary URLs. Private PR #4 merged as `3b580d05d7955009fb0f9f4138c1df79f486ff10`, approving only the JPGs for original-image delivery.
2. Media: checkpoint `7a08fa4` contains twenty verified WebPs, image-only JPG gallery.json and exact 27,253,962-byte MP4. Six images are 2560×1366, fourteen 1920×1080; no verified 4K source. WebPs preserve EXIF/ICC, exact names/order, Lanczos/q92/method6 and bounds without crop/upscale.
3. Pages/code: `e55a283` integrates both unlisted routes and strict local-MP4 companion support with native controls/inline playback, existing versions and stable anchors. `cf391c2` records actual native editor reorder/save/reopen and exact MP4 version. All 21 media hashes and companion bytes were preserved.
4. Compatibility: current navigation/RZ/map-fullscreen fixes retained in `3a73a5f`; fresh public viewer cache v42. Post-merge checkpoint `901e983`: 71 targeted maintained tests and 17 controlled browser tests pass. Actual local MP4 decode/play/seek/fullscreen passed. Full Ruby/Jekyll checks later passed in Pages CI.
5. Publication: media service v8 source `8f51841777c92bcc2aa69cc9fdab7a5210bb0f28`, deployment `appgdep_6afeeeb85be481918250886d37504e02`, succeeded with all earlier public revisions retained and protected media unchanged; 20 actual originals and legacy samples pass integrity/denial checks. Website PR #56 merged as `87bb41b30d636eb1ecaccd02129be927a927fb69`; Pages run `44529823521` succeeded.
6. Live: both aliases show 20 images and the native clip in exact source order. Public verification: 36 HTTP200 plus two exact HTTP206 ranges; every WebP/MP4 and ten shared assets match approved bytes. Mobile/WebP and wide/original selection, image navigation/fullscreen, actual video playback/pause/resume/seek/fullscreen on BOTH routes, noindex/sitemap/homepage exclusions and existing-gallery smoke checks passed. Native QA used and closed its own window.

Evidence: `FIREARMS-VERIFICATION.md`. Physical touch/iOS/Safari and exhaustive audio/frame-by-frame review were not performed; actual codec/media hashes and both live video interfaces were checked. No further Firearms implementation/publication work is pending. Completed Aircrafts and Phantom evidence remains preserved in their verification reports.
