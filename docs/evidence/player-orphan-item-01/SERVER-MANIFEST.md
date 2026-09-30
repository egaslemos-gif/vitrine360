# SERVER MANIFEST

A versão do manifesto do lado do servidor resolve a reprodução a partir da `DEFAULT PLAYLIST` associada ao dispositivo.

Ao calcular `resolveEffectivePlayback`, o sistema não encontra um `Schedule` ativo e, portanto, recorre ao `currentPlaylistId` atribuído ao dispositivo.

## Resolução Efetiva
- **Source:** `DEFAULT PLAYLIST`
- **PlaylistID:** `a7d095b8-ea49-4f08-912c-5841049d89c6`
- **Effective Playback Key:** `DEFAULT|a7d095b8-ea49-4f08-912c-5841049d89c6|||NONE`

## Conclusão
O servidor está a fornecer ativamente este manifesto. O `manifestVersion` bate certo com o cliente, logo não é um *Server Manifest Stale*.
