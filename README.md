# Hegemonia 1914

Jogo de estratégia em tempo real na Primeira Guerra Mundial, contra 30 nações controladas pelo computador. Projeto pessoal, sem fins comerciais.

**Jogar:** https://murilodannis123-lang.github.io/hegemonia-1914/

- Mapa: Natural Earth e GeoNames (províncias geradas a partir de cidades reais).
- Fotos do jornal: Wikimedia Commons, domínio público.
- Ilustrações, ícones e bandeiras: desenhados para o jogo.

## Desenvolvimento
- `npm run build` — gera `dist/game.js` e atualiza a versão no `index.html`.
- `npm test` — partida IA x IA, testes de interface no navegador e telas de fim de jogo.
- `node tools/buildmap.mjs` — regenera `assets/map.json`.
