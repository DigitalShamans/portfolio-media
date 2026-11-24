# Strange Brigade - Environment Art service verification

Overall: PASS

- Originals: 33/33 HTTP 200, image/jpeg; exact bytes/SHA-256/Git blob, full decode, dimensions/orientation.
- Dimensions: 33 × 2560x1440.
- Retained NFS/Aircraft/Phantom samples: 3/3 exact bytes/hash/decode/dimensions.
- Denials: 4/4 expected 404 (unknown revision, missing file, wrong case, video at JPEG endpoint).
- Media revision: `3ea1ff2006349804fde73818e2c16d7e21af0586`.
- Windows certificate trust; Pillow 13.0.0; HTTP 24.86s; 10s/request timeout.
- Facts/timings: service-http-results.json and service-verification.json.
- Blockers: none.
