# MEDIA DIMENSIONS

**React Player**:
- `mediaStyleFor` define `objectFit: resolveObjectFit(fitMode)` e `objectPosition: "center center"`.
- IMAGE e GIF utilizam a `<img>` tag com estilos de `100%`.
- O `naturalWidth` e `naturalHeight` não são injetados hard-coded no elemento, delegando para o CSS `object-fit` o enquadramento responsivo no container (`100vw/100vh`).

**Legacy TV**:
- Contém bake manual para EXIF (orientação baseada em metadados).
- Se a orientação for falha, desenha no `<canvas>` adaptado a `1920`. Se for GIF, monta num `<img>` usando cálculo em javascript `placeContained`.

**CONCLUSÃO**: A discrepância relatada ("IMAGE/GIF reproduzem com aspecto inadequado") no React provavelmente indica que a Hisense/Sraf *ignora* `object-fit: contain` em certas instâncias, um bug documentado em motores antigos onde o CSS object-fit não funciona, e o Legacy TV usa script para dimensionar (`placeContained`).
