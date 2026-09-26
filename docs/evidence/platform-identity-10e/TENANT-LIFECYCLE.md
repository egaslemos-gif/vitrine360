# TENANT-LIFECYCLE — PI-10E (Usage interaction)

| Question | Answer |
|----------|--------|
| SUSPENDED → still count Usage? | **Yes** — stored devices/bytes remain; lifecycle blocks access separately |
| SUSPENDED → evaluate quotas? | Resolution may still return plan; mutations already blocked by session/device auth |
| REACTIVATED → Usage preserved? | **Yes** |
| Cascade tenant delete | Devices/media CASCADE — Usage would drop with rows (future) |

Does not modify PI-09.
