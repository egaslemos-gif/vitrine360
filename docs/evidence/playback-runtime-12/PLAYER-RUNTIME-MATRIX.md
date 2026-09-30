# PLAYER RUNTIME MATRIX

| Funcionalidade  | React Player | Legacy Player | Chromium | Hisense/SRAF |
| --------------- | ------------ | ------------- | -------- | ------------ |
| IMAGE           | PASS         | PASS          | PASS     | PASS         |
| GIF             | PASS         | PASS          | PASS     | PASS         |
| VIDEO           | PASS         | PASS          | PASS     | PASS (fix)   |
| AUDIO           | PASS         | PASS          | PASS     | PASS         |
| TEXT            | PASS         | PASS          | PASS     | PASS         |
| NEXT            | PASS         | N/A           | PASS     | PASS         |
| PREVIOUS        | PASS         | N/A           | PASS     | PASS         |
| PLAY/PAUSE/STOP | PASS         | N/A           | PASS     | PASS         |
| PLAYLIST ID     | FAIL         | N/A           | FAIL     | N/A          |

Nota: Playlist ID falha porque o manifest não incluiu a metadata no API Sync. A matriz suporta que ambas as arquiteturas têm capacidades de visualização estendidas.
