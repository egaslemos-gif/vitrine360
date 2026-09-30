# ROOT CAUSE

## Classificação Final
A causa do problema foi determinada exatamente como:
**F. DEVICE_DEFAULT_PLAYLIST**

## Evidência e Racional
- O conteúdo `Editor smoke text` é real e **EXISTE** na base de dados de produção (Turso). Não é um artefato fixo (Fixture) (*Elimina B*).
- O conteúdo tem uma referência válida na tabela `playlist_items` para a playlist "Playlist Padrão". Não é um conteúdo órfão no Manifesto (*Elimina E*).
- Não existem `Schedules` vinculados a esta playlist (*Elimina D*).
- Os Manifestos Local e do Servidor batem certo (as versões coincidem na telemetria) (*Elimina A e C*).

A anomalia decorre do facto da `"Playlist Padrão"` (`id: a7d095b8...`) estar diretamente atribuída ao campo `currentPlaylistId` de vários dispositivos físicos (ex: `FIREFOX`, `Gchrome-do-cel`). A perceção de erro "Não existe nenhuma Playlist conhecida..." por parte do operador no Admin advém do facto desta ser uma playlist gerada automaticamente no setup da conta ("Criada automaticamente. Edite ou remova esta playlist."), para a qual o Content foi validamente injetado.
