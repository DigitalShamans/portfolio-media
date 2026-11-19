# Props verification

Scope: Props only, ArtStation ba253a. One gallery release; final live acceptance remains pending.

Planned routes: /galleries/props/ and /artur/galleries/props/.

## Source and preparation — passed

Rendered source contains43asset containers:42JPGs,one empty record atposition2,no embeds. Empty record is documented and omitted. Exact image order,filename case,source captions and genuine download links including dl=1 are preserved in source evidence. No higher-resolution URLs were invented.

Original dimensions:7×3840×2160,10×2560×1440,6×2560×1366,19×1920×1080;22,566,756original bytes. All42originals and42WebPs match staged hash/size/blob/decode/dimension facts. Derivatives use Lanczos/q92/method6,EXIF/ICC,and no cropping/upscaling. Editable gallery.json retains42original JPG references. No companion manifest is required.

Download10.333s;prepare9.836s. PrivatePR6 merged atde815cfb10a0ab016e63bb93f7cb0da658620b39; all42approved blobs/sizes match that exact tree. Public checkpoints:browserguard3a8d9f1 andmedia/pagesb676519. Previous approved inventories and delivery revisions remain intact.

## Native editor — passed

Actual DS Gallery Editor v0.11 rendered each of42individual previews. Adjacent reorder→Save→reopen persisted; canonical order was restored and explicitly saved. Exact-case references/order and alloriginal SHA-256 values match stage. The final isolated scratch manifest is byte-identical to canonical stage after formatting restoration. No production files were changed by the UI; no embeds generated; no timeouts or blockers.

## Original service — passed

Catalog-only v10 sourceb2515911703e45c82d32113883e9c2ef4da9b723; deploymentappgdep_6aff11b6d8908191a31ed9ec418b386b succeeded15:12:04Z,environment15. OnlyProps is added under a new immutable revision; six prior catalog/active revisions remain. Gateway14/14 tests and build pass.

Live service:42/42newJPGs exactbyte/SHA-256/Gitblob/fullJPEGdecode/dimensions/orientation. Three retained NFS/Aircrafts/Phantom samples pass; four unknown-revision/missing-file/wrong-case/video-endpoint probes return404. Actual49GETs:45HTTP200+4HTTP404,25.95s,10s per-request timeout,Windows certificate validation.

## Website and browser — pending

Record successful Pages revision/run, public file/metadata/unlisted checks and both-route browser results after deployment. No live acceptance claim is made yet.

## Browser timeout policy — tested

In-app browser first. Five-second observation deadlines; one fresh in-app retry; two-second delivery fallback. Inputs use five-second locator timeouts and15-second CUA calls. Native Chrome is not automatically launched. HTTP fallback remains explicitly noninteractive/unverified. The guard bounds in-session checks, but cannot cancel underlying UI input or an unresponsive tool transport.

All7guard tests pass, including never-resolving primary/retry/fallback callbacks and late-result rejection. Actual Props source open exercised a five-second timeout then succeeded on the automatic fresh in-app retry in0.972s. Source inspection and final interactive acceptance remain separate checks. Native Gallery Editor requirement is retained.
