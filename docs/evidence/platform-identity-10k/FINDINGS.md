# PI-10K Findings

| ID | Severity | Area | Finding | Status |
|----|----------|------|---------|--------|
| F1 | HIGH | storage heal | buffer heal without reserve | FIXED |
| F2 | HIGH | storage heal | complete heal growth without reserve | FIXED |
| F3 | HIGH | reservation | sticky prepare RESERVED | FIXED |
| F4 | MEDIUM | schema | ensureSchema unique index catch | OPEN |
| F5 | MEDIUM | direct upload | no ContentLength on signed PUT | OPEN |
| F6 | LOW | soft limit | SOFT_LIMIT skips hard reserve | DOC |
| F7 | HIGH | lifecycle | service allocate without operable | FIXED |
| F8 | MEDIUM | observability | activity log failed pair after commit | FIXED |
