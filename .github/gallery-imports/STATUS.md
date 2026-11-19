# Gallery publication status

Current item: port Aircrafts pages and ordered embeds (04).

- Public baseline `8891795d` (PR #41). The prior diagnostic branch `codex/artstation-three-galleries-20261119` is excluded. All six proposed paths are available in the baseline. Aircrafts is separate from `hb-airplanes`.
- Aircrafts originals and source manifest are in the originals repo's merged PR #2. Verified the live ArtStation sequence against the recovered import. There are 23 JPGs: 8 at 3840×2160, 12 at 1920×1080, and 3 at 1920×905. Four Sketchfab viewers follow the lead image in source order.
- All 23 recovered WebPs match a fresh run of the existing exporter byte for byte. The editable JPG references and both public delivery manifests match the verified source and approved candidate originals revision.
- The existing media-service v6 is saved. Its 14 local gateway checks passed. Production is on the earlier version and the Aircrafts originals are not live yet.
- Next: validate the two recovered page/embedded-viewer implementations, integrate the smallest one that meets acceptance, then deploy the media service before merging the Pages rollout.
