# DEVICE TRACE

Foi investigado o mapeamento da "Playlist Padrão" a nível de dispositivos.

A pesquisa na tabela de `devices` procurando pelo `currentPlaylistId` igual à playlist em causa (`a7d095b8-ea49-4f08-912c-5841049d89c6`) retornou exatamente dois dispositivos associados.

## Dispositivos Associados
1. **Dispositivo A:**
   - **ID:** `855bcb21-d64e-4472-80ee-a301e52eb74b`
   - **Nome:** `FIREFOX`
   - **currentPlaylistId:** `a7d095b8-ea49-4f08-912c-5841049d89c6`

2. **Dispositivo B:**
   - **ID:** `930c4a63-3f8b-4b67-945a-b3fd54c6aaac`
   - **Nome:** `Gchrome-do-cel`
   - **currentPlaylistId:** `a7d095b8-ea49-4f08-912c-5841049d89c6`

## Conclusão
Estes dispositivos têm a "Playlist Padrão" configurada nativamente como a sua playlist de reprodução contínua (fallback `currentPlaylistId`). Como não existem *schedules* definidos (ver `SCHEDULE-TRACE.md`), é este comportamento que dita que o item `"Editor smoke text"` lhes seja entregue pelo servidor.
