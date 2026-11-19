# Slag service verification

Overall: PASS

- Originals: 11/11 HTTP 200, image/jpeg; exact bytes/SHA-256/Git blob, full decode, dimensions/orientation.
- Dimensions: 11 × 1920x1080.
- Retained NFS/Aircraft/Phantom samples: 3/3 exact bytes/hash/decode/dimensions.
- Denials: 4/4 expected 404 (unknown revision, missing file, wrong case, video at JPEG endpoint).
- Media revision: `ddbb5d1a9b9aad396debb1c5b11f66db8b08a8a4`.
- Windows certificate trust; Pillow 13.0.0; HTTP 8.36s; 10s/request timeout.
- Facts/timings: service-http-results.json and service-verification.json.
- Blockers: none.
