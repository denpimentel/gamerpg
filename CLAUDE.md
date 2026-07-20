# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Propósito

**Bancada de testes visuais de jogos RPG 2D top-down** (estilo Tibia) — NÃO é produção.
Objetivo: experimentar visuais, stacks e assets. Gastar energia no visual, não em
backend/segurança/banco. Tudo estático, sem servidor de jogo.

Hospedagem: sempre no calneyserver, exposto na rede local para jogar pelo celular.

- **URL LAN:** `http://192.168.68.52:8310` (IP do servidor; `.62` é o desktop CMG)
- **Servir:** `setsid nohup python3 -m http.server 8310 --bind 0.0.0.0 --directory /home/calney/Labfy/gamerpg/public &`
  (não sobrevive a reboot; se precisar permanente, criar unit systemd)
- Porta 8310 registrada em `~/docs/ports.md`. Antes de abrir outra porta: `~/scripts/port-check`.

## Estado atual (2026-07-19, tarde)

O usuário escolheu o 64×64 — demos 32/128 foram DELETADOS (zips brutos ainda em `assets/`).
Único demo: **`public/demo64/` — Ilha de Elmsong**:

- 3 biomas lado a lado (campo/grama, deserto/areia, pedra/elevation) ligados por pontes.
- 15 NPCs rotulados: 12 monstros Pixel Adventure (CC0) + 2 goblins Tiny Swords + ovelhas.
- **Paper doll LPC**: personagem em camadas (weapon_behind → body → feet → legs → torso →
  head → weapon), 5 armas + 5 armaduras trocáveis via inventário DOM (🎒 / tecla I),
  visíveis andando e atacando. `window.__equip(kind, id)` é a ponte DOM→jogo.

Hub em `public/index.html`. Licenças em `CREDITS.md` (monstros CC0; LPC é CC-BY-SA!).

## Arquitetura

**Documentação completa da stack, motor e pipeline de mapas: `docs/FRONTEND.md`.**

```
public/            → raiz servida (estático puro, sem build)
  vendor/phaser.min.js   → Phaser 4.2.1 vendorizado (sem CDN)
  shared/engine.js       → RPGLab: FreeWalker (movimento livre), HomeWanderer (IA coleira),
                           GridWalker (grid/Tibia), Joystick virtual, ActionButton, parseMap
  demo64/                → index.html + game.js (Ilha de Elmsong, autocontido)
  assets/64/             → PNGs organizados POR BIOMA (ver abaixo)
assets/            → downloads brutos (zips, BMPs Reiner, mirror Tiny Swords) — fora da web
```

Assets organizados por bioma/tipo (`public/assets/64/`, tudo em escala 64px):
```
terrain/    atlases de chão/água compartilhados (campo_deserto, pedra, neve, water, foam, bridge)
props/      árvores (tree_campo, tree_neve) + deco/
creatures/{campo,deserto,pedra,neve,common}/<nome>/{idle,walk}.png
player/     equip/ (paper doll LPC 2×) + hero_ia/ (skin Cavaleiro de Gelo IA)
ui/icons/   ícones do inventário
_source/    NÃO runtime: lpc_64/ (originais) + ai_gen/ (pipeline PixelLab, state.json)
```
- Monstros Pixel Adventure e paper doll LPC são **upscalados 2× via Scale2x** (arquivo
  frame×2, render scale/2 → mesmo tamanho na tela, menos serrilhado). IA (92px), goblins
  Tiny Swords (192px) e terreno (64px) não sofrem upscale. Scripts: `upscale_lpc.py`,
  `reorg_assets.py`.

## Pipeline de assets (aprendizados que valem repetir)

- **Reiner's Tilesets** (`reinerstilesets.de/zips2d/T_*.zip`): BMPs individuais por frame
  (`walking n0000.bmp`, 8 direções n/ne/e/se/s/sw/w/nw). Fundo dos personagens = cor flat
  **marrom** (detectar com histograma, não assumir magenta); tilesets usam **rosa
  (191,123,199) + teal (0,131,131)**. Script de montagem:
  `scratchpad build_reiners.py / build_assets2.py` (histórico da sessão) — remonta
  spritesheets por animação (linhas = direções na ordem n,ne,e,se,s,sw,w,nw).
- **trees2 do Reiner**: grid é 128×128 (32 frames), NÃO 128×256. Frames verdes bons:
  0,1,2,4,5,9,10. Decalque de terra orgânico: earth_to_grass frame 1 (bandas emendam na
  horizontal). Arbustos bons: 19,24,7,15,53,54,52.
- **Tiny Swords** (mirror GitHub `6-team/tiny-swords`): frames 192×192. Warrior: idle=linha 0,
  walk=linha 2, attack=linha 4 (6 frames/linha). Goblin Torch: idle=0 (7f), walk=1 (6f).
  Tilemap_Flat: bloco grama 3×3 em (0,0)..(2,2), areia +5 colunas; frame = linha*10+coluna.
- **LPC**: walkcycle 576×256 = 9 frames × 4 linhas (n,w,s,e; frame 0 = parado). `soldier.png`
  é o personagem VESTIDO (bases male/female são de cueca). Grama lisa = linha 5 do grass.png
  (a célula (0,0) é moita escura). Lagoa pronta: water.png linhas 2-4.
- itch.io está atrás de Cloudflare agressivo (curl/playwright/stealth falham) — preferir
  OpenGameArt (download direto), GitHub mirrors e reinerstilesets.de.
- **LPC generator** (repo `LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator`):
  um PNG por animação por item em `spritesheets/<cat>/<item>/<tipo>/{walk,slash,thrust}.png`.
  Grade 64×64: walk 9 cols (col 0 = parado), slash 6, thrust 8; linhas n/w/s/e.
  ⚠ Sheets de ATAQUE de armas grandes (longsword/mace/waraxe slash) são **192×192**
  (1152×768) — alinhar com origem `(0.95*64+64)/192` vs 0.95 dos frames 64.
  Armas têm camada `*_behind` (desenha atrás do corpo). A árvore da API do GitHub vem
  TRUNCADA (>56k arquivos) — navegar por `contents/` em subdiretórios.
- Mirrors com PNG real do Pixel Adventure (o repo `parwam/Pixel-Adventure` usa Git LFS
  sem quota): `clecioespindola/godotPlatformer2D` (parcial) e
  `ChrisTutorials/ChrisTutorials-2D-Godot-Platformer` (pack completo em
  `Art/Pixel Adventure 2/Enemies/`). Frame size está no nome do arquivo: `Idle (36x30).png`.
- **PixelLab API** (api.pixellab.ai/v2, keys em `.env`, roteador `scripts/pixellab-route.py`,
  pipeline idempotente `scripts/gen_neve.py` com estado em `public/assets/64/ai/state.json`):
  - POSTs async retornam **202** com `*_id`; poll em `GET /tilesets/{id}`, `/characters/{id}`,
    `/map-objects/{id}` (423 = ainda processando; map-objects pronto = `download_url`).
  - `/balance` → `subscription.generations` = gerações RESTANTES do trial (40/conta).
  - `create-tileset` (Wang 16 tiles, `tile_size` 16 default — pedir **32** e upscale 2×):
    cada tile tem `corners` NW/NE/SW/SE upper|lower → pintar ilha em **dual-grid**
    (tile em cada nó de canto, offset -32px). No fim usamos recolor do TS no chão
    (coesão) e guardamos o Wang em `ai/snow/`.
  - `create-character-with-4-directions` → frames saem 92×92 (não 64); anims via
    `/characters/animations` template `walk`; **templates quadrúpedes (dog) usam ids
    próprios** (`walk-6-frames`). Resultado em `rotation_urls` (dict por direção) +
    `animations[].directions[].frames` (URLs diretas).
  - CDN backblaze.pixellab.ai bloqueia o User-Agent padrão do urllib — mandar
    `User-Agent: Mozilla/5.0`.
  - Recolor de bioma (palette swap): máscara `g > b` pega verdes+amarelos e preserva
    contornos navy do Tiny Swords; rampa de luminância → neve (`ai/Tilemap_Snow.png`).

## Convenções dos demos

- Movimento: `demo64` usa **`FreeWalker`** (movimento livre, velocidade px/s, colisão AABB
  com raio que desliza nas paredes; player 165px/s, mobs ~40-58px/s). `GridWalker`
  (grid+tween estilo Tibia) continua no engine para quem preferir. Ambos têm a mesma API
  `update(vec, dt)` + `setAnim(state, dir)`; trocar é só instanciar o outro. A colisão
  do FreeWalker usa `walkablePx(px,py)` (converte pixel→tile) em vez de `walkable(tx,ty)`.
  `Wanderer.update(dt)` repassa o delta. O loop principal é `update(time, delta)`.
- NPCs usam **`HomeWanderer`**: vagam num raio (px) do ponto de nascença com atração
  elástica de volta — a cada passeio mistura direção aleatória com o vetor pro "home",
  peso `pull²` (0 no centro, 1 na borda), então nunca escapam nem ficam presos batendo
  na parede. Raios: mobs comuns/goblins 150, IA 165, ovelhas 120. `walkablePxZone` fica
  como trava dura de segurança (não cruzam pontes).
- Profundidade: `sprite.setDepth(sprite.y)` para sobreposição correta; chão em depth negativo.
- Touch: joystick virtual (lado esquerdo da tela) + botão de ação (direita); teclado
  WASD/setas + espaço. Testar sempre nos dois.
- QA visual: Playwright MCP → screenshot → corrigir → repetir. Hook de debug: cada demo
  expõe `window.__scene` para teleportar câmera nas verificações.
- Comparação justa entre resoluções: zoom 2×/1×/1× deixa personagens com altura de tela
  similar (~96-110px); a diferença visível é a densidade de detalhe.

## Futuro (decisões antigas, ainda válidas se virar multiplayer)

Colyseus como servidor autoritativo, 1000 players/mundo com fila FIFO para o 1001º —
ver histórico git. Não implementar até o usuário pedir.
