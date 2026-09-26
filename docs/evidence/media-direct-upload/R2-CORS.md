# R2 Direct Upload — CORS (required)

Browser uploads go **directly** to Cloudflare R2 via a short-lived signed PUT URL
(`POST /api/admin/media/prepare` → `PUT` to R2 → `POST /api/admin/media/complete`).

Without bucket CORS, uploads fail in the browser (network/CORS error).

## Cloudflare R2 → bucket → Settings → CORS policy

```json
[
  {
    "AllowedOrigins": [
      "https://vitrine360-psi.vercel.app"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add preview deployment origins if needed. Do not use `*` with credentialed cookies
(signed PUT URLs do not need cookies; `*` for origins may work for PUT-only, but
prefer explicit production origin).

## Verify

1. Content Studio → IMAGE/VIDEO → file **> 5 MB** → Criar.
2. Network: `prepare` 200 → R2 `PUT` 200 → `complete` 200 → content created.
3. Re-upload same file → `prepare` returns `existing: true` (no PUT).
