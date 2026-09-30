# DATABASE TRACE

A base de dados de produção (Turso) foi interrogada procurando o conteúdo "Editor smoke text" na tabela `contents`, bem como na tabela relacional `playlist_items` e `playlists`.

## Resultados (Queries DB)

1. **CONTENT EXISTS:**
   ```json
   {
     "id": "f6100b5b-95e0-4587-bfe1-6daf761ed3cf",
     "type": "TEXT",
     "title": "Editor smoke text",
     "status": "ACTIVE",
     "createdAt": "2026-09-21 21:51:19"
   }
   ```

2. **PLAYLIST REFERENCE EXISTS:**
   ```json
   [
     {
       "id": "fedb8d43-8755-4038-b5fe-fe6b1c95b10e",
       "playlistId": "a7d095b8-ea49-4f08-912c-5841049d89c6",
       "contentId": "f6100b5b-95e0-4587-bfe1-6daf761ed3cf",
       "position": 3,
       "active": true
     }
   ]
   ```

3. **PLAYLIST DETALHES:**
   ```json
   {
     "id": "a7d095b8-ea49-4f08-912c-5841049d89c6",
     "name": "Playlist Padrão",
     "description": "Criada automaticamente. Edite ou remova esta playlist.",
     "status": "ACTIVE"
   }
   ```

## Conclusão
O Content **EXISTE** e tem uma referência válida (não é órfão de playlist). Está associado à "Playlist Padrão". O facto de a UI de Admin aparentemente não mostrar a Playlist que contém este Content sugere que pode haver um filtro na UI ou o operador não verificou esta "Playlist Padrão" específica.
