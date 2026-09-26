# PI-10P — WSL2 Turso Cloud CLI Unblock Stop

**Timestamp:** 2026-09-25  
**Verdict:** BLOCKED

## WSL audit

| Check | Result |
|-------|--------|
| WSL default version | 2 |
| Distros installed | `docker-desktop` only (Stopped / minimal) |
| Ubuntu | **NOT FOUND** |
| Ubuntu-22.04 / 24.04 | **NOT FOUND** |

`docker-desktop` is not a usable Ubuntu user distro for Turso Cloud CLI (`wget` present; not a full Ubuntu environment for `get.tur.so/install.sh`).

## Stop rule

§2 / §3: Ubuntu WSL2 required. Do not install Windows/WSL components without user authorization.

## Not executed

- Cloud CLI install
- `turso auth login`
- API token mint
- Preview provisioning
- Production mutations

## Operator instruction (run in elevated PowerShell if needed)

```powershell
wsl --install -d Ubuntu
```

Then open Ubuntu once to finish first-boot user setup, and re-run **PI-10P — WSL2 TURSO CLOUD CLI UNBLOCK**.

Do **not** paste Turso tokens into chat.
