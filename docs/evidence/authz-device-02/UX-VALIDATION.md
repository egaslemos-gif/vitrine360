# UX VALIDATION — AUTHZ-DEVICE-02

## Cenários de UX Validados

### 1. Página Protegida (SSR)
A página `src/app/admin/devices/page.tsx` já executa `requireAdminPage("manage_devices")`:
- Se o role não tem a permissão → renderiza `<AccessDenied />` com mensagem "Acesso negado" e "Não tem permissão para esta área neste workspace."
- **EDITOR e VIEWER nunca vêem o formulário de associação** na renderização normal.
- O formulário `PairDeviceForm` só é renderizado se o guard SSR passa.

### 2. Formulário: Estados de Loading
- **Antes do submit**: Botão lê "Associar dispositivo". Todos os inputs activos.
- **Durante o submit**: Botão lê "A associar Ecrã…", desactivado. Inputs desactivados. Submissão dupla prevenida.
- **Após sucesso**: Banner verde "✓ Ecrã associado com sucesso. O Player irá receber o token automaticamente." Campos limpos. Lista atualizada via `router.refresh()`.
- **Após erro**: Banner vermelho com título + descrição. Campos preservados. Utilizador pode corrigir e tentar novamente.

### 3. Mensagens de Erro por Cenário

#### Cenário: RBAC DENY (perfil sem `manage_devices`)
**Quando**: Um EDITOR/VIEWER consegue submeter o form (ex: cache stale, race condition)
**Backend responde**: `403 { "error": "PERMISSION_DENIED" }`
**UI mostra**:
> **Permissão insuficiente**
> O seu perfil não tem permissão para gerir Ecrãs neste espaço de trabalho. Contacte um administrador.

#### Cenário: Entitlement DENY (funcionalidade desactivada no plano)
**Backend responde**: `403 { "error": "ENTITLEMENT_DENIED" }`
**UI mostra**:
> **Funcionalidade indisponível**
> A gestão de Ecrãs não está disponível para este espaço de trabalho.

#### Cenário: Quota excedida
**Backend responde**: `403 { "error": "QUOTA_EXCEEDED" }`
**UI mostra**:
> **Limite de Ecrãs atingido**
> O espaço de trabalho atingiu o limite de Ecrãs permitido pelo plano actual.

#### Cenário: Código de activação inválido
**Backend responde**: `400 { "error": "ACTIVATION_CODE_INVALID" }`
**UI mostra**:
> **Código de activação inválido**
> O código de activação introduzido não é válido ou já expirou. Verifique o código no ecrã do dispositivo.

#### Cenário: Device code duplicado
**Backend responde**: `400 { "error": "DEVICE_ALREADY_REGISTERED" }`
**UI mostra**:
> **Ecrã já associado**
> Este código de identificação já está em uso neste espaço de trabalho. Escolha um código diferente.

#### Cenário: Tenant suspenso
**Backend responde**: `403 { "error": "TENANT_SUSPENDED" }`
**UI mostra**:
> **Espaço de trabalho suspenso**
> Este espaço de trabalho está temporariamente suspenso. Contacte o suporte.

#### Cenário: Erro inesperado / Network
**UI mostra**:
> **Não foi possível completar a operação**
> Ocorreu um erro inesperado. Tente novamente.

### 4. Caso Específico Reportado
**Activation Code 463748, Device ID mun-CMM:**
Se o utilizador que submete NÃO tem `manage_devices`:
- **Antes**: UI mostrava "ENTITLEMENT_DENIED" ou "Forbidden"
- **Agora**: UI mostra "Permissão insuficiente — O seu perfil não tem permissão para gerir Ecrãs neste espaço de trabalho."

### 5. Princípio Respeitado
- O frontend NÃO usa `role === "SUPER_ADMIN"` para decidir autorização.
- A ocultação do formulário via SSR é apenas UX conveniente.
- O backend é a autoridade final para todas as decisões de RBAC, Entitlements e Quotas.
