# Gallery publication status

Current item: Aircrafts source verification (02).

- Public website main: `8891795da78be0434ba934a310de7c2c79d84810` (PR #41, NFS Unbound). The `codex/artstation-three-galleries-20261119` head `3e75ea9f3b392b1036a64e7eac9a37c51f96ffb5` is diagnostic work and is outside the release.
- Checked all six proposed route paths against main. They are available. Vehicles - Aircrafts is separate from `hb-airplanes`.
- Architecture: GitHub Pages builds the shared Jekyll gallery layout and publishes WebPs. The existing media service serves revision-pinned originals. Gallery Editor data keeps original JPG names. Any ordered embeds use companion data keyed to a stable image reference.
- The Aircrafts import, metadata and 23 JPGs are already committed in the originals repository. Two earlier website implementations have been recovered locally. None of the new website routes are published yet. The matching media-service version is saved and requires deployment verification.
- Public Git checkout reads work. This environment has no shell write credential for GitHub. The connected GitHub operation created this working branch.
- Next: match the source sequence against the original import, validate the recovered WebPs and select one website implementation. Push the verified site changes and publish the existing media-service version before the Pages rollout.
