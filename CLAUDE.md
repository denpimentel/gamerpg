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

## Estado atual (2026-07-19)

Comparativo de resolução de pixel art — 3 mini-jogos completos (mapa, personagem andando
em grid com animação, NPCs, colisão, touch + teclado):

| Demo | Resolução | Pack | Tema |
|------|-----------|------|------|
| `public/demo32/` | 32×32 | LPC (CC-BY-SA) | Vila com lagoa, soldado, slime — 4 direções |
| `public/demo64/` | 64×64 | Tiny Swords (CC0) | Ilha com espuma animada, guerreiro, goblin, ovelhas — 8 dir, flip lateral |
| `public/demo128/` | 128×128 | Reiner's (prerendered) | Clareira Diablo-like, Freya, esqueleto — 8 direções reais |

Hub em `public/index.html`. Licenças em `CREDITS.md`.

## Arquitetura

```
public/            → raiz servida (estático puro, sem build)
  vendor/phaser.min.js   → Phaser 4.2.1 vendorizado (sem CDN)
  shared/engine.js       → RPGLab: GridWalker (movimento em grid com tween, estilo Tibia),
                           Wanderer (NPC), Joystick virtual, ActionButton, parseMap
  demo{32,64,128}/       → index.html + game.js por demo (autocontidos)
  assets/{32,64,128}/    → PNGs processados (só o que os demos usam)
assets/            → downloads brutos (zips, BMPs Reiner, mirror Tiny Swords) — fora da web
```

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

## Convenções dos demos

- Movimento: grid + tween (`GridWalker`), nunca física livre — mantém a vibe Tibia e
  simplifica colisão (Set de células bloqueadas).
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
