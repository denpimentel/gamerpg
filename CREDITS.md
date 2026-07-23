# Créditos dos Assets

Este repositório usa apenas assets gratuitos de terceiros. Downloads brutos em `assets/`
(fora do git), versões processadas/usadas em `public/assets/`.

## Ilha de Elmsong (demo64)

### Terreno, água, árvores, ovelhas, goblins, construções e UI
- **Tiny Swords** — Pixel Frog. Tilemaps (flat/elevation/bridge), água/espuma, árvores,
  deco, ovelha, goblins (Tocha e TNT), construções da villa (castelo/casa/torre + goblin),
  e **pack de UI** (barras base+fill 3-slice, moldura de retrato — HUD do demo64).
  - Fonte: https://pixelfrog-assets.itch.io/tiny-swords (mirrors `6-team/tiny-swords`,
    `MauroCastro1705/tiny_swords` p/ Update 010 + UI)
  - Licença: uso pessoal e comercial + modificação livres; crédito opcional; proibido
    revender/redistribuir o pack. (versão antiga era CC0.)

### Monstros (12 espécies)
- **Pixel Adventure 1 & 2** — Pixel Frog. AngryPig, Bat, Bee, Bunny, Chicken, Ghost,
  Mushroom, Radish, Rino, Slime, Snail, Trunk.
  - Fonte: https://pixelfrog-assets.itch.io/pixel-adventure-2 (via mirrors
    `clecioespindola/godotPlatformer2D` e `ChrisTutorials/ChrisTutorials-2D-Godot-Platformer`)
  - Licença: **CC0** (domínio público).

### Paper doll do personagem (corpo, armaduras, armas)
- **Universal LPC Spritesheet Character Generator** — comunidade Liberated Pixel Cup.
  Camadas: corpo/cabeça/pernas/botas, camisa, couro, cota de malha, legião, placas,
  espada longa, adaga, maça, machado de guerra, lança.
  - Fonte: https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator
  - Licença: **CC-BY-SA 3.0 / GPL 3.0** (dual) — NÃO é CC0. Atribuição aos autores das
    peças usadas: lista completa mantida pelo gerador em
    https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/
    (autores base: Stephen Challener "Redshrike", Johannes Sjölund "wulax",
    Michael Whitlock "bigbeargames", Matthew Krohn "makrohn", Lanea Zimmerman "Sharm",
    entre outros). Derivados devem manter share-alike.

### Montarias (cavalos)
- **"[LPC] Horses"** — bluecarrot16. 5 cores (marrom, preto, cinza, dourado, branco),
  ciclos stand/walk/gallop/eat em 4 direções.
  - Fonte: https://opengameart.org/content/lpc-horses
  - Licença: **CC-BY 3.0 / GPL 3.0 / GPL 2.0 / OGA-BY 3.0** — creditar bluecarrot16 e
    linkar a página acima.
- **"[LPC] Horse Riding"** (recorte em camadas atrás/frente para encaixar o cavaleiro) —
  derivado dos cavalos do bluecarrot16 pelo autor do asset (não exige crédito próprio).
  - Fonte: https://opengameart.org/content/lpc-horse-riding-updated-091
  - Pipeline: `scripts/build_mounts.py` (Scale2x 2×, mesmo esquema do paper doll).
- **Porco Rosa** — gerado via https://api.pixellab.ai (2026-07-20), pipeline
  `scripts/gen_montarias_ia.py`. Direitos conforme os termos do PixelLab para
  conteúdo gerado pelo usuário.

### Bioma NEVE — assets gerados por IA (PixelLab)
- **Tileset Wang de neve, pinheiro nevado, Cavaleiro de Gelo (herói), Yeti, Golem de Gelo
  e Lobo Ártico** — gerados via https://api.pixellab.ai (contas do projeto), 2026-07-19.
  Direitos de uso conforme os termos do PixelLab para conteúdo gerado pelo usuário.
  O chão da ilha usa `ai/Tilemap_Snow.png` — recolor (palette swap) do Tilemap_Flat do
  Tiny Swords (CC0); o tileset 100% IA fica preservado em `ai/snow/`.
  Pipeline: `scripts/gen_neve.py` + roteador de chaves `scripts/pixellab-route.py`.

### Bioma BURGO — tileset de calçamento
- **Calçamento medieval da vila (`terrain/vila.png`)** — imagem fornecida pelo usuário
  via WhatsApp (2026-07-22), aparência de asset gerado por IA; origem/licença a
  confirmar. Original em `assets/vila_calcamento/`; tratamento (chroma key magenta,
  fatiamento 6×6, downscale 64px, grama sintetizada) em `scripts/build_vila_tiles.py`.

### FX de skills de arma (`effects/fx_*.png`)
- **Slash Effect Collection** (cethiel) — CC0 — https://opengameart.org/content/slash-effect-collection
  (fx_slash, fx_lunge, fx_ring, fx_orb — greyscale, tintados em runtime).
- **Kenney Particle Pack** — CC0 — https://kenney.nl/assets/particle-pack
  (fx_p_fire, fx_p_spark, fx_p_ice, fx_p_dust).
- Pipeline: `scripts/build_fx.py` (crop bbox + downscale; brutos em `assets/effects_research/`).

## Engine
- **Phaser 4.2.1** — MIT — https://phaser.io (vendorizado em `public/vendor/phaser.min.js`)

## Histórico (demos removidos em 2026-07-19)
O comparativo 32/64/128px usou LPC Base Assets (CC-BY-SA/GPL) e Reiner's Tilesets
(uso livre, reinerstilesets.de) — removidos do site, zips brutos ainda em `assets/`.
