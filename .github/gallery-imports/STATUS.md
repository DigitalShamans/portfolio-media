# Gallery publication status

Current task: reduce future ArtStation import time while keeping **one gallery per release**. Aircrafts, Phantom and Firearms remain published; no additional gallery or shared runtime change is part of this task.

## Current bounded checkpoints

1. **Audit complete.** Firearms request-to-final baseline 64m23s; downloads 6.270s, media preparation 14.536s. Most elapsed time was outside these operations, including new MP4 support, script authoring, integration, setup and release/report orchestration. These phase gaps are not measured exclusive CPU or idle time.
2. **Reusable preparation complete.** Branch `codex/gallery-import-pipeline-20261119`, based on main `f8edbe5`. `gallery-import.py` stages one new gallery from normalized or historical source evidence, preserves original bytes and exact WebP settings, emits image-only data, stable ordered embeds and both unlisted page stubs. `private-plan` and `plan` emit hash-bound reviewable patches; they never apply or deploy. Sparse service additions preserve prior catalogs/approvals/revision overrides. Pinned-Pillow offline tests pass 9/9.
3. **Golden replay complete.** Actual Firearms originals produced 20 byte-identical WebPs and the unchanged MP4; image order and video anchors match production. Cold process 3.756s; resumed 1.443s, 20 verified cache hits. Acquisition, UI and deployment are excluded. Detailed compact evidence: `IMPORT-BENCHMARK.json`.
4. **Downloader and integration verification in progress.** Windows certificate-validating bounded transfers and hash-checked resume are being tested separately. No source/service/gallery data has changed. Next: finish transport/offline verification, review all tooling, checkpoint/push and open its PR.

Workflow/commands/acceptance: `IMPORT-WORKFLOW.md`. Target 25–30 minutes for the next comparable supported-format import; this is a forecast. Measure all four checkpoints on the next gallery against the 32m11.5s half-time threshold. Keep actual native editor and both-route browser acceptance, full new-file integrity and terminal deployments.

## Completed publication references

- Aircrafts: public implementation `dd84935`; 23 images + four Sketchfab; final evidence `AIRCRAFTS-VERIFICATION.md`.
- Phantom: publication `4c6bcf4`; 23 images + leading YouTube; evidence `PHANTOM-VERIFICATION.md` records limitations.
- Firearms: PR #56, merge `87bb41b`; successful Pages run `44529823521`; 20 images + native MP4. Evidence PR #59 / `FIREARMS-VERIFICATION.md` records both routes, original/WebP/MP4 integrity, real native editor and both-route playback/fullscreen acceptance. No Firearms publication work remains.
