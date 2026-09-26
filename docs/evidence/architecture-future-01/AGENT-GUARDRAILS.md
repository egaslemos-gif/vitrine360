# ARCHITECTURE-FUTURE-01 — Agent Guardrails

Instructions for future coding agents. Architecture phase only defines these rules; agents must obey them in later phases.

## Always

1. Read the relevant phase doc + ADR before writing code.  
2. Prefer extending an existing plane over inventing a parallel stack.  
3. Keep offline-first and deny-by-default Experience security.  
4. For Smart TV claims: require React + `tv.js` parity tests (CLOCK pattern).  
5. Keep commits scoped; do not mix Identity audits with Playback changes.  
6. Document PHYSICAL VALIDATION — NOT AVAILABLE when Hisense is not tested — never invent PASS.

## Never (unless a new ADR explicitly supersedes)

1. Implement Billing / Plans / Subscriptions inside Manifest or Player.  
2. Store Live sessions as MediaAsset rows.  
3. Add Camera / Microphone / unrestricted Network to Experiences by default.  
4. Treat membership `SUPER_ADMIN` as Platform Super Admin.  
5. Add `CONTENT_TYPE = GIF` without a dedicated RFC + device evidence.  
6. Change firmware / APK / root / browser config for validation.  
7. Use `eval` / `new Function` / untrusted `innerHTML` in player paths.  
8. Introduce ES modules into legacy `tv.js`.  
9. Wire Experience Runtime into production player only via RUNTIME-EXPERIENCE-11+ gates (EX-11 React path implemented; legacy `tv.js` remains non-exec until a dedicated TV execution gate).  
10. Start LIVE-MEDIA / Campaigns / Platform Identity **implementation** from a vague prompt — require a named phase doc.

## Dependency checklist (PR / phase)

- [ ] No new forbidden dependency (see DEPENDENCY-RULES.md)  
- [ ] No schema change without phase authority  
- [ ] Dual runtime touched ⇒ parity tests updated  
- [ ] Experience security ADRs still hold  
- [ ] Telemetry changes do not pretend to be Analytics product  

## Phase entry template

Before coding a future phase, the agent must produce:

1. Phase name + non-goals  
2. Plane(s) touched  
3. Contracts changed  
4. Explicit “will not modify” list (Manifest / Clock / … as applicable)  
5. Evidence folder path  

## Related

- `docs/ARCHITECTURE-FUTURE-01.md`  
- `docs/adr/ADR-ARCHITECTURE-FUTURE-001.md`  
- `docs/PLATFORM-IDENTITY-02-TARGET-ARCHITECTURE.md`  
- `docs/RUNTIME-EXPERIENCE-04-RUNTIME-SECURITY.md`
