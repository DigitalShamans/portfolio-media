# Gallery publication status

Current task: Props only (ArtStation ba253a), the sixth Full Portfolio gallery. One gallery per release; publish and verify both unlisted routes before completion.

## Bounded checkpoints

1. Source: rendered in-app browser verifies43 containers,42JPGs,noembeds,one empty record atposition2. Exact order/case, source captions and actual download links including dl=1 preserved. No guessed higher-resolution URLs. New browser guard primary timed out at5s; automatic fresh in-app retry succeeded in0.972s, without native Chrome.
2. Prepared:42verified originals and42WebPs, image-only JPG gallery.json and both route stubs from reusable importer. Downloads10.333s; preparation9.836s. Originals:7at3840x2160,10at2560x1440,6at2560x1366,19at1920x1080. Original bytes22,566,756. Native editor v0.11 all42previews and reorder/save/reopen/canonical restore passed; allhashes unchanged.
3. Private:PR6 merged de815cfb10a0ab016e63bb93f7cb0da658620b39. Single Git tree query matches all42approval blob/size records. Source checkpoint c23923c. Existing approval inventories remain unchanged.
4. Publication: new scoped media catalog contains only Props; six prior catalogs retained. Service v10 sourceb2515911703e45c82d32113883e9c2ef4da9b723, deploymentappgdep_6aff11b6d8908191a31ed9ec418b386b succeeded15:12:04Z,env15. Actual42newJPG+3legacy samples and4denial probes pass. Website metadata applied only after this gate. Public branch codex/props-20261119 includes tested browser guard checkpoint3a8d9f1; no shared gallery viewer changes.

Browser policy: in-app first;5s observations, one fresh in-app retry,2s delivery fallback;15s tool calls and5s locators. No automatic native Chrome. Failed interactive checks remain unverified; HTTP success is not UI acceptance. Dispatch delivery checks immediately after Pages succeeds.

Next: one Pages release, then dispatch independent public HTTP checks immediately and verify both routes in-app at mobile/wide sizes. Current main through d7c4604 integrated, preserving seamless desktop handoff updates. Keep original/JPG selection, fallback/caching, navigation, protected media and homepage ArtStation links unchanged. Route conflicts for /galleries/props/ and /artur/galleries/props/ are clear.

Completed Sniper evidence is retained, including its final report/timings now carried forward from its working checkpoint. Prior Full Portfolio conversions: NFS Unbound, Vehicles-Aircrafts, Phantom, Firearms and Sniper Elite4. No other new gallery starts during this release.
