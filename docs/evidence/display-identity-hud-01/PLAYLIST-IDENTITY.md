# PLAYLIST IDENTITY

## Setup 
Se um dispositivo tiver a sua `Device.currentPlaylistId` para "Playlist A", mas existir um schedule ativado (via `Schedule`) para a "Playlist B", o Sync do Player puxará um manifesto contendo a "Playlist B".

## Verificação
O componente de identidade recupera o nome da playlist diretamente invocando `getCurrentManifest()`. Uma vez que a arquitetura do backend escreve o manifesto baseando-se na resolução efetiva da playlist (`resolveEffectivePlayback`), o nome presente no `CURRENT_MANIFEST` do cliente será obrigatoriamente a *Playlist B*.

## Atualização Automática
Quando ocorre um `sync` que reescreve o `CURRENT_MANIFEST` no IndexedDB, o componente que observa estas atualizações notará a diferença e puxará a nova playlistName sem requerer reload do cliente.

## Conclusão
Playlist Correctness - **PASS**. O nome exibido reflete exclusivamente o manifesto em execução.
