# Vegetation asset verification

Overall: PASS

- 16 JPG originals and 16 WebPs match every staged size/SHA-256/Git blob and fully decode with Pillow 13.0.0.
- Originals: 13,961,989 bytes; dimensions 6 × 3840x2160; 3 × 1920x1200; 1 × 2560x1440; 6 × 2560x1366.
- WebPs: 7,070,108 bytes; dimensions 7 × 2560x1440; 3 × 1920x1200; 6 × 2560x1366.
- Canonical image-only order matches source.json; empty positions [2] omitted; no embeds or extra image files.
- All 16 filename/caption pairs preserve exact source texts; original project description is preserved exactly in provenance.
- Recorded download URLs with dl=1 remain exact: 13 /4k/; 3 /large/.
- Evidence: asset-verification.json, prepared-media-facts.json. No HTTP or browser acceptance claimed.
