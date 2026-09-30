# PLAYLIST IDENTITY

A identidade da Playlist não aparece no `DisplayIdentityHud` porque:
O `currentManifest` proveniente do sync `LocalConfig/Runtime` através da API apenas fornece o `manifestVersion` e itens, mas não o `playlistName`.
No backend, o manifest armazena os IDs e configurações, mas não injeta a string `playlistName` na raiz do payload do manifest (ou se o faz, o runtime client `engine.ts` não guarda esse dado exposto em IndexedDB da mesma forma que guarda a flag `deviceToken`).

**CONCLUSÃO**: O nome da playlist não chega à View (HUD). Não há conflito com o controller.
