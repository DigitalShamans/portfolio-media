# Vegetation service verification

Overall: PASS

- Originals: 29/29 HTTP 200, image/jpeg; exact bytes/SHA-256/Git blob, full decode, dimensions/orientation.
- Dimensions: 19 × 3840x2160; 3 × 1920x1200; 1 × 2560x1440; 6 × 2560x1366.
- Retained NFS/Aircraft/Phantom samples: 3/3 exact bytes/hash/decode/dimensions.
- Denials: 4/4 expected 404 (unknown revision, missing file, wrong case, video at JPEG endpoint).
- Media revision: `0f32e45b4ec85c19aa0527ce5725256787dafbbf`.
- Windows certificate trust; Pillow 13.0.0; HTTP 20.91s; 10s/request timeout.
- Facts/timings: service-http-results.json and service-verification.json.
- Blockers: none.
