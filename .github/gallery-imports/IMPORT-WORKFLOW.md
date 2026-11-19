# One gallery per release

Use this workflow for a **new** ArtStation gallery using JPG originals, native MP4,
YouTube or Sketchfab. Existing galleries, comparisons, maps and unsupported media
need their own bounded change; these helpers deliberately refuse to overwrite a
published gallery. This is preparation tooling, not a new viewer or hosting system.

## Four bounded checkpoints

1. **Source**: inspect current main/instructions and route conflicts once. Open the
   rendered ArtStation project through the supported browser. Capture its exact
   mixed-media sequence, real download links, identifiers, captions and dimensions
   in one JSON. Prefer the actual original download links, retaining `dl=1` when
   present; do not invent a 4K URL or discard download parameters.
   Stop and isolate a feature task for an unsupported media type. Keep acquisition
   to the established three materially different legitimate approaches if blocked.
2. **Prepared**: download once, verify every file, run the importer below, review its
   generated manifests/pages and private approval patch. Perform the native editor
   reorder/save/reopen/restore cycle on a scratch copy; check image order and unchanged
   companion bytes. Commit/push source, originals and the reviewed private approval
   inventory together. Record the immutable private revision after that commit.
3. **Published**: generate the release plan against current website/service metadata.
   Review and apply only patches whose expected hashes still match; integrate once.
   Use the existing Sites release process, retain old active revisions, and verify
   all new JPGs at the approved immutable revision before updating the website.
   Commit generated pages/media and website metadata together. Run required CI and
   publish **one** gallery through **one** Pages release. Verify terminal deployment.
4. **Verified**: run file/HTTP checks and native acceptance in parallel independent
   lanes after publication. Test both portfolio routes. Run the mandatory capture
   cleanup below after the last screenshot. Commit/push final evidence and STATUS
   on the working branch; it can be included with the next content release rather
   than immediately merging a documentation-only second deployment.

Use at most two independent workers. Shared metadata, integrations and deployments
have one owner. Checkpoint after each gate; resume files rather than reacquiring
source or rebuilding reviewed code. Keep STATUS concise; put detailed results in
separate evidence files. Do not treat checkpoints as a chat-length reset.

## Browser deadlines and automatic fallback

Use the in-app browser first for source capture and both-route acceptance. Do not
automatically launch native Chrome: its API stalled for 24 minutes on the Sniper
import. Start independent HTTP/decode/hash verification as soon as Pages succeeds.

Import `.github/scripts/gallery-browser-check.mjs` into the supported CUA JavaScript
session and call `runGalleryBrowserCheck` with `inApp`, optional `retryInApp`
(a fresh in-app tab) and `deliveryFallback` observation callbacks. Each callback
returns `{passed: true, ...evidence}` only after its assertions pass. Defaults are
5 seconds per in-app attempt and 2 seconds for the delivery fallback, with at most
one in-app retry. Both thrown errors and expired deadlines trigger fallback.

Use `withBrowserCheckTimeout` for individual read-only observations, 5-second
Playwright locator timeouts, and `timeout_ms: 15000` on each CUA tool call. Keep
calls small. The in-session guard discards late results; it cannot cancel a pending
UI input or force an unresponsive tool transport to return. Do not race input
callbacks against further input. After an unknown action outcome, obtain fresh
state before continuing; reset/rebind the CUA session once if needed.

After a fresh-tab fallback, bind acceptance to the selected tab before applying
viewport overrides. Read back `innerWidth` after each change; a successful viewport
API response alone does not prove that the tab being checked changed size. Wait
for the visible embed after navigation before asserting its asynchronously mounted
content. Confirm fullscreen through visible player state and geometry.

Delivery fallback can consume independently verified HTTP results. Its status is
`delivery-only`, with interactive acceptance still unverified. If both in-app
attempts fail, continue independent work and record the exact missing interaction
check; do not claim gallery acceptance from HTTP alone. This policy does not remove
the native Gallery Editor round-trip requirement.

Guard verification: `node --test .github/tests/gallery-browser-check.test.mjs`.

## Image captions

Inspect each `project-asset` wrapper for `.asset-caption`; it can be a sibling of
`.asset-container`, so reading the image container alone misses source text. Keep
each exact caption on its image record and preserve an empty project description
separately from any caption-derived metadata description.

The importer emits optional `gallery_captions` in studio-page frontmatter, keyed
by original filename. Both portfolio layouts use that same map through escaped
inert template data and the optional caption script/style. The native editor's
image-only manifest stays unchanged; image order is never a caption identifier.
Run `.github/tests/gallery-captions.test.cjs` and the importer tests when changing
this feature. Verify template mappings and actual visible captions on both live
routes, including after asynchronous gallery replacement and viewer navigation.

## Mandatory automatic screen-capture cleanup

The user has authorized this cleanup after **every** gallery transfer. Run it
without another prompt, on success, failure and early exit. Treat it as a
finalization/finally step owned by the release owner. It is not a scheduled job.

1. Finish all UI acceptance and save required screenshots/evidence first. Stop
   outstanding UI work; each capture owner resets its native editor/browser tool
   session. Reset the `node_repl` and `cua_repl` sessions that were used. Do not
   initialize a fresh capture client just to perform cleanup.
   Record helper IDs, exact paths, parent identities and UTC creation times while
   the checks are active. Compare normalized timestamps during cleanup: PowerShell
   may deserialize JSON ISO dates as DateTime objects rather than literal strings.
2. Inspect current running helper process identities using the authorized native
   process tools. The known helpers are `codex-computer-use.exe` and
   `codex-computer-use-swift.exe`. Verify exact executable path belongs to the
   current official Codex installation, parent identity and current process ID
   before stopping a helper used by these checks. Do not hard-code an earlier
   run's process IDs. Do not stop the main ChatGPT/Codex app, unrelated sharing or
   recording apps, generic Node/Chrome processes, or helpers belonging to other
   ongoing work. If identity cannot be established, record a cleanup blocker.
3. Stop those verified capture helpers and confirm the original processes exited.
   A parent app may automatically restart an idle helper. Allow one bounded stop
   retry for that same verified parent/path, then stop retrying. A replacement
   helper's presence is not proof of ongoing capture and is not a zero-process
   acceptance requirement. Never hide the Windows privacy border or change
   capture/privacy settings to make the frame disappear.
4. Record session resets, terminated original processes, any automatic restart
   and unresolved cleanup errors in the gallery acceptance report. Do not take a
   new desktop screenshot or invoke editor screenshot APIs after this gate: that
   can start capture again. Do not claim visual disappearance from process counts
   alone. Ask for a visual check only when an actual unresolved capture issue
   remains; routine transfers need no extra user prompt.

Battlezone follow-up established the recovery: both original capture helpers were
terminated, tool sessions reset, one automatic helper restart received a bounded
retry, and the user confirmed the yellow frame had disappeared. Session resets
alone did not establish release. Preserve this cleanup in subsequent imports and
handoffs, even when browser acceptance has a reported limitation.

## Input and commands

Requires Python with **Pillow 13.0.0**, including WebP support, and Windows PowerShell
5.1 or later for the TLS-validating downloader. The bundled Codex Python used for
the benchmark provides Pillow 13. Discover that runtime through the workspace
dependencies tool instead of assuming the system Python has it.

Example normalized input (replace every sample value with verified source data):

```json
{
  "schema_version": 1,
  "slug": "example",
  "title": "Game - Gallery",
  "description": "Reviewed portfolio description.",
  "source_project": "https://www.artstation.com/artwork/PROJECT_ID",
  "media": [
    {"type": "image", "id": 123, "filename": "Exact-Name.jpg",
     "source_url": "https://cdnb.artstation.com/p/assets/images/images/000/000/123/large/Exact-Name.jpg?1234567890&dl=1",
     "width": 1920, "height": 1080},
    {"type": "youtube", "id": "eWHDcWZnTMY", "title": "Verified trailer"}
  ]
}
```

Supported entries are `image`, `video` (safe local `.mp4` basename), `youtube`,
`sketchfab` and an explicitly observed `empty` container. Images require original
`.jpg` basenames and stable HTTPS source URLs. Preserve letter case. Signed,
credential-bearing or temporary access URLs must never enter a committed manifest.
Historical `entries` manifests from the completed imports are also accepted.
Provide `--slug` and `--title` when those fields are absent.

From the website checkout, with task-specific paths outside the checkout:

```powershell
$GalleryPython = 'ABSOLUTE_PATH_TO_PILLOW13_PYTHON'
$GallerySource = 'C:\task\source.json'
$GalleryOriginals = 'C:\task\originals'
$GalleryStage = 'C:\task\stage'

powershell -NoProfile -ExecutionPolicy Bypass -File .github/scripts/download-gallery-assets.ps1 `
  -InputFile $GallerySource -OutputDir $GalleryOriginals `
  -ReportPath 'C:\task\downloads.json'

& $GalleryPython .github/scripts/gallery-import.py prepare `
  --input $GallerySource --source-dir $GalleryOriginals `
  --cache 'C:\task\cache' --output $GalleryStage

& $GalleryPython .github/scripts/gallery-import.py private-plan `
  --stage $GalleryStage --private-source 'C:\task\portfolio-media-private' `
  --plan 'C:\task\private-plan.json'

# Review/apply the private patch; copy staged private files; commit and push.
# Resolve the actual full private commit SHA, then:
& $GalleryPython .github/scripts/gallery-import.py plan `
  --stage $GalleryStage --revision FULL_PRIVATE_COMMIT_SHA `
  --website . --service-source 'C:\task\service-checkout' `
  --plan 'C:\task\release-plan.json'
```

`prepare` writes originals/provenance under `stage/private`, WebPs, image-only
`gallery.json`, stable image-anchored embeds, native MP4 and both page stubs under
`stage/public`. It also emits measured sizes, SHA-256/Git blob IDs, approval entries,
an artifact inventory and a timing report. WebPs fit 2560Ã—1440 with Lanczos,
quality 92/method 6, EXIF orientation and ICC handling, without cropping/upscaling.
Add `--resume` to repeat preparation with the same input/stage. Source hashes and
cached derivative hashes are rechecked; a filename alone is never a cache hit.

The downloader accepts the same input (or emitted `download-plan.json`), preserves
the downloaded bytes, validates Windows names/public ArtStation CDN URLs and uses
at most four transfers. Its successful report is the resume record; retain it
beside the originals. Conflicting or corrupt existing files block rather than being
overwritten. The Python core does no network access, Git actions or publication.
The command's execution policy applies only to that reviewed-script process; it
does not change the machine or user policy or disable HTTPS certificate validation.

Both planning commands emit replacement JSONs and expected input/output hashes.
They do **not** modify repository metadata, apply patches, commit or deploy. Review
the plan and preserve all prior approvals, including excluded images. Each new
service revision contains only the incoming gallery; retain every prior catalog
and active environment revision. Keep the global website fallback revision and add
only the incoming gallery's override. MP4 stays outside the JPG-only service.

## Acceptance retained

- Check every original's size/hash/Git blob, format and actual dimensions; every
  WebP's recipe/decode/hash; MP4 container/duration/dimensions and exact bytes.
  Source order, case, duplicate checks and embed anchors must all agree.
- Perform the real native editor round-trip, with unchanged companion bytes and
  restored canonical image order. Parser tests alone do not satisfy this check.
- Fetch/decode/hash every new service JPG, retain an old-gallery sample and denial
  probes, then verify every published WebP/MP4. For MP4 check exact byte ranges too.
- On **both** deployed routes, verify real content, mobile WebP and qualifying wide
  desktop original requests, image navigation/fullscreen, and every embed. Native
  MP4 needs actual play/pause/resume/seek/fullscreen; container parsing is separate.
  Prepare one owned browser window and editor scratch folder to avoid repeated setup.
- Confirm noindex, sitemap and homepage/navigation exclusions, applicable build and
  deploy checks. Run shared fallback/stale-request/failure regression and appropriate
  existing-gallery smoke coverage whenever shared runtime/schema code changes.
  A new data-only gallery does not require repeating unrelated exhaustive tests.

Generate asset versions after the new files are tracked at the intended revision,
or use existing CI. Several validators read `HEAD`, not merely working-tree files.
Local Ruby-dependent checks require the established Pages CI environment if Ruby
is unavailable; record that distinction. Report passed, failed and unverified
checks separately. Keep protected RZ media/access controls unchanged.

## Timing target and evidence

Firearms took **64m23s** using the recorded request/final timestamps. Its source
downloads took **6.270s**, media preparation **14.536s**. Encoding alone cannot save
half the elapsed import time. Reusable preparation/planning, existing native video
support, one integration gate and prepared parallel acceptance remove repeated
authoring/setup/handoffs. One gallery per release remains the user's chosen scope.

Replay of the actual Firearms originals through this importer took **3.756s cold**
and **1.443s resumed** (wall time including Python startup). All 20 WebPs were
byte-identical to the published files; MP4 bytes, JPG order and video anchors also
matched. This replay excludes acquisition, editor/browser work and deployment.
See `IMPORT-BENCHMARK.json` for compact measured results.

Transport smoke: one real 115,319-byte JPG downloaded in 0.413s and resumed from
verified cache in 0.103s (internal script timings). Its hash/decode/dimensions match
the archived original. The same source URL without its genuine `dl=1` parameter
returned an 89,214-byte progressive JPEG with equal decoded pixels and different
EXIF/container bytes; expected hash validation correctly rejected it. Preserve
actual source download parameters and previously archived originals.

Nine Python tests and 75 offline downloader assertions pass. Downloader offline
checks ran in Windows PowerShell 5.1 and PowerShell 7; actual transport/resume ran
in Windows PowerShell 5.1. Redirect/retry-status/cancellation branches and live MP4
transfer were not exercised by this tooling smoke. MP4 container/byte preservation
was checked by the real local replay; no new viewer behavior was introduced.

For a comparable gallery using supported formats and healthy services, target
**25â€“30 minutes end to end**: source/preflight 4m; acquisition/preparation/private
checkpoint 4m; pages/service/integration 7m; Pages 3m; editor/live acceptance 8m;
final evidence 3m = **29m**. These are planning estimates, not a measured 2Ã— result.
Record UTC start/end/result per checkpoint on the next import and compare against
the 32m11.5s half-time threshold. Report unexpected source/feature/CI blockers
separately instead of omitting required media or checks to meet the target.

Offline verification:

```powershell
& $GalleryPython -m unittest discover -s .github/tests -p test_gallery_import.py
powershell -NoProfile -ExecutionPolicy Bypass -File .github/tests/download-gallery-assets.tests.ps1
```
