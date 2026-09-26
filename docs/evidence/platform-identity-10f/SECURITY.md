# SECURITY — PI-10F

- TenantId required on all usage methods
- Isolation tested A≠B
- No client usage override
- No JWT / Device Bearer dependency in usage service
- SUSPENDED still countable (lifecycle separate)
- No public Usage API
- Resource endpoints do not call evaluateQuota (PI10F-USAGE-012)
