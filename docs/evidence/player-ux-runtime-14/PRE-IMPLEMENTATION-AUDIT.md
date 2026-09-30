# PRE-IMPLEMENTATION AUDIT (PLAYER-UX-RUNTIME-14)

## A. De onde vem o nome do Device/Ecrã no primeiro render
O componente `DisplayIdentityHud` (em `src/player/playback/display-identity-hud.tsx`) define inicialmente o estado `config` como `null`.
O primeiro render do componente avalia a expressão:
`{config?.deviceName || config?.deviceCode || "Dispositivo"}`
Como `config` é `null` na primeira renderização, a UI apresenta estritamente a string **"Dispositivo"**.

## B. Qual valor é utilizado quando LocalConfig ainda não contém deviceName
Após o carregamento assíncrono do config (quando `getConfig` resolve), caso não haja um `deviceName` definido (e.g. dispositivo pendente de atribuição ou bootstrap falhado), ele mostra o `config.deviceCode` (ex: "X9T2W1"). Se ambos faltarem, o fallback final é **"Dispositivo"**.

## C. Se "NAVEGADOR" ou "TV" são defaults hardcoded, fallback de UI, displayType ou valor proveniente da API
- **TV**: É um default hardcoded como `displayType` em `src/player/runtime/device-config.ts` (linha 63: `? config.displayType : "TV"`). O HUD renderiza este `displayType` na linha 85 em uppercase ("TV").
- **NAVEGADOR**: A string "NAVEGADOR" **não existe** na base de código do Player ou do Admin como fallback genérico de ecrã (verificado via find/grep rigoroso). A sua aparição na UI deve-se muito provavelmente a uma configuração na base de dados onde o Ecrã foi literalmente baptizado como "Navegador" pelo administrador para testes em ambiente browser, ou devido à intervenção do auto-tradutor do Chrome/Edge.
- Portanto, "TV" é o `displayType` de fallback exibido por debaixo do nome e não deve substituir a designação real do ecrã.

## D. Em que momento o deviceConfig real chega ao Player
O Player recebe o `deviceConfig` pelo servidor aquando da resposta do `/api/device/bootstrap` (fase Claim) ou no endpoint `/api/device/sync`. Estes fluxos chamam `saveConfig()`, persistindo no `localStorage` (via chave `v360-player-config`) e de forma assíncrona no `IndexedDB`.

## E. Existe uma janela de fallback genérico antes de receber a identidade persistida?
**Sim**. O `DisplayIdentityHud` instancia `config = null` no mount e depois invoca `getConfig().then(setConfig)`. Durante as dezenas ou centenas de milissegundos que o React demora a montar a componente e a processar a Promise no `useEffect`, a janela é preenchida por `"Dispositivo"` (e ausência total de metadados como location ou displayType).

## F. Se a identidade real já está disponível em IndexedDB antes do primeiro render
**Sim**. De facto, está disponível e é inteiramente acessível de forma síncrona, não em IndexedDB, mas no `localStorage` (como cache primária e bloqueante para os fluxos essenciais). A função `readLocalConfigSync()` faz exactamente isto para injectar as políticas do Runtime Engine. O componente actual simplesmente não explora esta propriedade e opta por um async state-hook.

## G. Se o problema pode ser resolvido utilizando a identidade persistida localmente sem criar uma nova fonte de verdade
**Completamente e exclusivamente sim.** Basta exportar/utilizar o carregamento síncrono da cache (`readLocalConfigSync()`) como estado inicial estático do HUD, ou receber essa string como prop do parent (`PlayerApp`) que já efectuou as verificações do ciclo de boot. Assim elimina-se definitivamente o *flash* "Dispositivo" / "TV", respeitando a regra de zero novas fontes de verdade.

---
*Conclusão da Parte A completada e mapeada de forma estrita contra a codebase ATUAL.*
