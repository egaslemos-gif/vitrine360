# PI-10L ContentLength Strategy

## Mechanism

SigV4 signed `PutObject` with:

- `ContentLength` = prepare `fileSize` (= reservation `expectedBytes`)
- `ContentType` = declared MIME
- `signableHeaders`: `content-type`, `content-length`

## Client

`requiredHeaders` returned from prepare; browser PUT must include them.

## Authority

Successful PUT size ≈ signed length. Final authority remains **HEAD** in `completeMediaUpload`.

## Live evidence

When R2 credentials present: within-limit PUT 200; oversized PUT 403.
