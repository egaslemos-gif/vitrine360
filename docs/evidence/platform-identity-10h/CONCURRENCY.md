# CONCURRENCY — PI-10H

## Required property (future)

```
max = 100 MB
committed = 80 MB

A reserves 15 → OK (reserved=15)
B reserves 15 → DENY (available=5)
```

Also:

```
committed=80, reserved=20 → new 1 MB → DENY
```

Forbidden: independent `SELECT SUM → if ok → INSERT`.

## Today

No reservation; concurrent completes can both INSERT and overshoot any future max. Device-style IMMEDIATE lock alone is insufficient across prepare→PUT→complete unless reservation spans the whole window.

## Multipart

R2 path uses **single PUT**. Partial-part quota is a **future concern** if multipart is added; abandoned multipart uploads would need abort + release reservation.
