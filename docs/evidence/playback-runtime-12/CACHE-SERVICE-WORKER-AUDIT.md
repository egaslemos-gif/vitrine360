# CACHE & SW

- O service worker `/tv-sw.js` é registado (em alguns runtimes) para cache offline de assets. O player offline utiliza a cache do SW para servir assets (imagens, audios).
- O React pode interagir com IndexedDB para armazenar media blobs, enquanto o NextJS lida com as páginas.
Não há duplicação problemática documentada entre as caches, dado que blobs ou service worker responses resolvem em content idêntico (Stream/Buffer).

**CONCLUSÃO**: OK. Não se reportam efeitos colaterais.
