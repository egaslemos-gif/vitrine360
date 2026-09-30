# LEGACY ISOLATION

`public/tv.html` e `src/features/player/player-app.tsx` são entrypoints disjuntos.
- `/player` renderiza a aplicação em React (App Router).
- `/tv.html` serve um estático que invoca diretamente o `public/tv.js`.
Não existe um import de `tv.js` para o React nem de React para o `tv.js`.
Ambos respondem ao mesmo device token (se partilharem o storage e executarem na mesma frame - porém o `/player` usa IndexedDB+localStorage, e o `tv.html` apenas localStorage).

**CONCLUSÃO**: Isolamento completo entre os dois runtimes, desde que o browser não tenha duas abas abertas simultaneamente (uma no legacy e outra no react).
