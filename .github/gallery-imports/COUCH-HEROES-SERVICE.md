# Couch Heroes - Environment Art service verification

Overall: PASS

- Originals: 12/12 HTTP 200, image/jpeg; exact bytes/SHA-256/Git blob, full decode, dimensions/orientation.
- Dimensions: 12 × 2560x1440.
- Retained NFS/Aircraft/Phantom samples: 3/3 exact bytes/hash/decode/dimensions.
- Denials: 12/12 expected 404 (standard denials and all eight nonselected archive images).
- Media revision: `0e4a48b032a13ce0b07bbb2abc9a0fc9fc6bc91a`.
- Windows certificate trust; Pillow 13.0.0; HTTP 11.33s; 10s/request timeout.
- Facts/timings: service-http-results.json and service-verification.json.
- Blockers: none.
