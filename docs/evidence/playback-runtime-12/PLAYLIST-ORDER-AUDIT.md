# PLAYLIST ORDER AUDIT

- A ordem no manifest dita a ordem no `PlaybackController`.
- O `syncPlaylist` atualiza `this.items`.
- O avanço é `this.state.currentItemIndex + 1`. Se atingir o fim, e o repeatMode for `PLAYLIST`, volta a `0`.
- Não há lógica de `shuffle` na camada `PlaybackController` em reprodução (campo guardado apenas no modelo, mas a reprodução é estrita por array index). A ordem original providenciada pela API (`playlist_items.position`) é respeitada ao chegar ao engine.

**CONCLUSÃO**: A Playlist reproduz na ordem fornecida no Manifest de forma estrita. Se houver desordem, advém da montagem da playlist no backend/manifest, e não do runtime de reprodução em React ou Legacy.
