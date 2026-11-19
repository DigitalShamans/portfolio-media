# Vegetation service verification

Overall: PASS

- Originals: 16/16 HTTP 200, image/jpeg; exact bytes/SHA-256/Git blob, full decode, dimensions/orientation.
- Dimensions: 6 × 3840x2160; 3 × 1920x1200; 1 × 2560x1440; 6 × 2560x1366.
- Retained NFS/Aircraft/Phantom samples: 3/3 exact bytes/hash/decode/dimensions.
- Denials: 4/4 expected 404 (unknown revision, missing file, wrong case, video at JPEG endpoint).
- Media revision: `3a64865730657b150111a6173598a24da0d85275`.
- Windows certificate trust; Pillow 13.0.0; HTTP 13.79s; 10s/request timeout.
- Facts/timings: service-http-results.json and service-verification.json.
- Blockers: none.
