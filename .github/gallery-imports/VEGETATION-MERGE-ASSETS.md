# Merged Vegetation staged asset verification

Overall: PASS

- 29 images: exact existing 16-image prefix plus 13 additions in personal source order; no companion.
- Existing 16 JPG bytes, 16 WebP bytes, captions and historic provenance are bit-identical.
- 64 artifact byte/SHA-256/Git blob checks passed; all 29 originals and derivatives fully decode; ICC retained; fit without crop/upscale.
- Originals: 19 × 3840x2160; 3 × 1920x1200; 1 × 2560x1440; 6 × 2560x1366.
- WebPs: 20 × 2560x1440; 3 × 1920x1200; 6 × 2560x1366.
- Captions: 28 non-null mappings; mobile remains null in the 29-entry provenance/expected map.
- Separate merge provenance retains both original descriptions and all 25 root decisions, including the distinct upper fern collage panels.
- Manifest: cfc185098e1421171ff6a2f96f8f0d8280bb3f7a060358e9b7a6e2f14573773e; 2187 bytes.
- Importer preparation 2.187s; final local verification 5.630s; zero network/repository/service/Git mutation.
