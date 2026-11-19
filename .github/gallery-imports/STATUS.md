# Gallery publication status

Current task: Props (ArtStation ba253a) — published and verified on both routes. The sixth Full Portfolio gallery is complete; no implementation/publication work remains.

## Completed checkpoints

1. Source: 42 JPGs, no embeds, one empty record at position 2 omitted. Exact image order/case, captions and genuine download links preserved. Originals: 7 at 3840×2160,10 at 2560×1440,6 at 2560×1366,19 at 1920×1080. Original bytes 22,566,756. Downloads 10.333s, preparation 9.836s, Lanczos/q92/m6/EXIF/ICC with no crop/upscale.
2. Private: PR6 merged `de815cfb10a0ab016e63bb93f7cb0da658620b39`; all 42 approved blobs/sizes match the immutable tree. Native Gallery Editor v0.11 individually rendered all 42 previews and passed reorder/save/reopen/canonical restoration, all hashes unchanged. Public guard checkpoint 3a8d9f1, media/pages b676519, metadata 107f7ae.
3. Service: v10 source b2515911703e45c82d32113883e9c2ef4da9b723; deployment appgdep_6aff11b6d8908191a31ed9ec418b386b succeeded 15:12:04Z,environment revision 15. Six old catalogs/active revisions retained. 14 gateway tests+build pass. Actual 42 new originals+3 legacy samples pass integrity/decode; four denial probes 404 (49 GETs).
4. Website: PR70 merged 82e2723b9d21f6d9c7bb01cc76c421c6ccd7a1cb; Pages44552731651 succeeded 15:17:13Z. Both actual HTML builds match. All 55 public HTTP checks pass, including 42 WebPs, canonical manifest, both routes, seven dependencies, homes/nav/sitemap. Noindex/unlisted and external ArtStation cards preserved. Maintained tests 55/55, parser/version/embeds and CI Ruby/Jekyll pass. Concurrent desktop handoff through d7c4604 retained.
5. In-app browser: both routes 390/2800 plus studio 1280, decoded WebP/original selection, 42 images, fullscreen/counters/next/previous/Escape/return pass; actual 3840×2160 sample verified. Finished screenshots inspected; viewport override reset. No native Chrome or prompts. Physical touch/iOS/Safari not tested.

Routes: /galleries/props/ and /artur/galleries/props/. Final reports: PROPS-VERIFICATION.md and PROPS-TIMINGS.json on working branch codex/props-20261119, avoiding another website release.

Future browser rule is committed: in-app first; 5s check, one fresh in-app retry, 2s delivery fallback; 5s locators/15s tool calls. Seven guard tests pass; actual timed-out source open recovered automatically. HTTP fallback never claims interactive success. Dispatch HTTP checks as soon as Pages succeeds.

Full request-to-acceptance: 25.45min, 60.5% below Firearms 64m23s; half-time target met for this JPG-only run. Earlier Full Portfolio conversions: NFS,Aircrafts,Phantom,Firearms,Sniper. No additional gallery starts until requested.
