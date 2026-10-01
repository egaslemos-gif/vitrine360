# MATRIZ DE AUTORIZAÇÃO (RBAC)

Baseado em `src/domain/types.ts`.

Abaixo a matriz de operações (deduzidas a partir das permissões do sistema) por perfil:

| Operation | Guard Permission | VIEWER | OPERATOR | EDITOR | ADMIN | SUPER_ADMIN |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| dashboard.read | `view_dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| devices.read | *implicit via dashboard/logs ou manage_devices* | ❌* | ✅ | ❌* | ✅ | ✅ |
| devices.create/pair | `manage_devices` | ❌ | ✅ | ❌ | ✅ | ✅ |
| devices.update | `manage_devices` | ❌ | ✅ | ❌ | ✅ | ✅ |
| devices.delete/unpair | `manage_devices` | ❌ | ✅ | ❌ | ✅ | ✅ |
| device_groups.read | `manage_devices` (deduzido) | ❌ | ✅ | ❌ | ✅ | ✅ |
| device_groups.manage| `manage_devices` (deduzido) | ❌ | ✅ | ❌ | ✅ | ✅ |
| media.read | `manage_contents` | ❌ | ❌ | ✅ | ✅ | ✅ |
| media.manage | `manage_contents` | ❌ | ❌ | ✅ | ✅ | ✅ |
| contents.read | `manage_contents` | ❌ | ❌ | ✅ | ✅ | ✅ |
| contents.manage | `manage_contents` | ❌ | ❌ | ✅ | ✅ | ✅ |
| playlists.read | `manage_playlists` | ❌ | ✅ | ✅ | ✅ | ✅ |
| playlists.manage | `manage_playlists` | ❌ | ✅ | ✅ | ✅ | ✅ |
| schedules.read | `manage_schedules` | ❌ | ✅ | ✅ | ✅ | ✅ |
| schedules.manage | `manage_schedules` | ❌ | ✅ | ✅ | ✅ | ✅ |
| members.read | `manage_users` | ❌ | ❌ | ❌ | ✅ | ✅ |
| members.manage | `manage_users` | ❌ | ❌ | ❌ | ✅ | ✅ |
| activity.read | `view_logs` | ✅ | ✅ | ✅ | ✅ | ✅ |

*Nota: Em alguns locais a simples leitura de Ecrãs na UI poderá exigir apenas `view_dashboard`, dependendo do grau de separação entre API de leitura e gestão de ecrãs. Contudo, as operações CRUD (criar, alterar estado, eliminar, emparelhar) exigem rigorosamente `manage_devices`.*

**Conclusão imediata:**
Os perfis autorizados para executar acções que envolvam `manage_devices` (e logo adicionar/associar Ecrãs) são estritamente **SUPER_ADMIN**, **ADMIN**, e **OPERATOR**.
O perfil **EDITOR** NÃO possui `manage_devices`.
O perfil **VIEWER** NÃO possui `manage_devices`.
