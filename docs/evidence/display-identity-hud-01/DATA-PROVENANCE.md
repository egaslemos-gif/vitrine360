# DATA PROVENANCE

## Análise de Fontes

| FIELD        | SOURCE OF TRUTH                                                    | VEREDICTO |
|--------------|--------------------------------------------------------------------|-----------|
| deviceName   | `LocalConfig` no IndexedDB (populado via `DevicePolicyConfigWire`) | PASS      |
| location     | `LocalConfig` no IndexedDB (populado via `DevicePolicyConfigWire`) | PASS      |
| groupName    | `LocalConfig` no IndexedDB (populado via `DevicePolicyConfigWire`) | PASS      |
| playlistName | `getCurrentManifest()` no IndexedDB (via Sync)                     | PASS      |
| itemTitle    | Propagado via UI via render array (`items[state.currentIndex]`)    | PASS      |

## Avaliação de Integridade
A informação provém das fontes corretas já estabelecidas. Nenhum valor de fallback (*hardcoded*) foi criado. Os controlos não instanciam estados extra, o que previne bifurcações ou desalinhamentos e *flickering* durante o funcionamento da aplicação. Nenhuma tabela, Store, ou nova base de dados foi inventada.

## Conclusão
Data Provenance - **PASS**.
