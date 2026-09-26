# PI-10P — Turso Credential Bootstrap Stop

**Timestamp:** 2026-09-25  
**Verdict:** BLOCKED

## §1 Turso CLI verification

| Binary | Status | Role |
|--------|--------|------|
| `turso` (cloud Platform CLI) | **ABSENT** | Required for `auth login`, `org list`, `api-tokens mint` |
| `tursodb` / npm `turso` | PRESENT | Local SQL shell only — **cannot** mint Platform API tokens |
| GitHub `turso-cli` latest (v1.0.32) | Darwin + Linux assets only | **No Windows release asset** |

## §2 Authentication

Cloud CLI session: not applicable (CLI absent).  
`~/.turso` contains only `tursodb.exe` — no cloud auth config.

## §4 API token

`TURSO_API_TOKEN` = **ABSENT**  
`TURSO_ORG` = **ABSENT**

## Actions not taken (safety)

- No Production Turso used
- No token requested in chat
- No secrets printed
- No provisioner run
- No live cohort

## Operator unblock (outside chat)

1. Install **Turso Cloud CLI** on an environment with official builds (Linux/macOS or WSL2 Ubuntu), e.g. download `turso-cli_Linux_x86_64.tar.gz` from [turso-cli releases](https://github.com/tursodatabase/turso-cli/releases).
2. Run `turso auth login` in that environment.
3. Run `turso org list` and note the org **slug**.
4. Run `turso auth api-tokens mint vitrine360-preview-provisioner`.
5. Store the token as a **local unversioned** env var `TURSO_API_TOKEN` (and `TURSO_ORG=<slug>`) — never commit, never paste into chat.
6. Re-run PI-10P-UNBLOCK / `npm run provision:pi10p-preview-turso`.
