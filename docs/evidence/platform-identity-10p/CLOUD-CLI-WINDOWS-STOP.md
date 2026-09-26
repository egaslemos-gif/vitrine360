# PI-10P — Turso Cloud CLI Windows Unblock Stop

**Timestamp:** 2026-09-25  
**Verdict:** BLOCKED

## §1 Binary audit

| Command | Path | Role |
|---------|------|------|
| `turso` | ABSENT from PATH | — |
| `tursodb` | `C:\Users\Egas Lemos\.turso\tursodb.exe` | SQL shell 0.8.0-pre.11 |
| Arch | AMD64 | — |

## §2 Official releases

| Repo | Windows asset | Contents |
|------|---------------|----------|
| `tursodatabase/turso` v0.8.0-pre.13 | `turso_cli-x86_64-pc-windows-msvc.zip` | **Only `tursodb.exe` (SQL shell)** |
| `tursodatabase/turso-cli` (v1.0.x + history scan) | **No Windows assets** | Darwin + Linux only |

Downloaded Windows zip to `%LOCALAPPDATA%\turso-cloud-cli\` for inspection — confirmed SQL shell only. Existing `tursodb` was **not** removed.

## §4 Command verification

SQL shell help has **no**:
- `turso auth login`
- `turso org list`
- `turso auth api-tokens`

**STOP** per hard rule.

## Not executed

- Authentication
- Org discovery
- API token mint
- Preview provisioning
- Live cohort
- Production mutations

## Operator paths to unblock (outside chat)

1. **WSL2 Ubuntu** (or Linux/macOS): install `turso-cli_Linux_x86_64.tar.gz` from `tursodatabase/turso-cli` releases → `turso auth login` → mint Platform token → set unversioned `TURSO_API_TOKEN` + `TURSO_ORG`.
2. Or mint Platform API token from Turso dashboard and store as local secret (never paste into chat).
3. Then: `npm run provision:pi10p-preview-turso`.
