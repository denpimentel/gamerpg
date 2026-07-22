# Propostas de Skills/VFX para armas brancas (espada, machado, maça, lança, adaga)

> Pesquisa 2026-07-22. Material baixado em `assets/effects_research/` (fora da web,
> gitignored). Princípio de escalabilidade: **efeito desacoplado da arma** — sheets
> greyscale tintados em runtime (`setTint`), blend aditivo (`setBlendMode(ADD)`),
> escala proporcional ao alcance, e técnicas que usam o PRÓPRIO sprite corrente da
> arma (afterimage) — funcionam com qualquer arma do paper doll, montarias e até mobs.

## Matéria-prima baixada

| Pack | Licença | Onde | Destaque |
|---|---|---|---|
| Slash Effect Collection | CC0 | `oga/slash_collection/` | 30+ slashes greyscale (Small/Big/Huge), Circular, Lunge Thrust — **tintáveis** |
| Weapon Slash - Effect | CC0 | `oga/weapon_slash/` | 5 anims × 4 cores (classic/roxo/azul/fogo), 6 frames |
| Pixel art sword slash | CC0 | `oga/sword_slash_sprites.png` | crescentes pixel 6 frames |
| Slash Hit 01 VFX | CC-BY | `oga/slash_hit/` | slash spiky amarelo 5 frames (creditar autor no CREDITS se usar) |
| Kenney Particle Pack | CC0 | `kenney/` | 193 PNGs soft-glow: slash, trace, spark (raio!), star, magic, smoke |
| Tiny Swords Particle FX | CC0 | `assets/tiny_swords/{Particle FX,Effects}/` | fogo, explosões, poeira — já no estilo do jogo |

Fontes: opengameart.org (download direto ok), kenney.nl (direto ok), craftpix.net
(freebies exigem login — baixar manualmente pela conta, como os packs em
`~/Downloads/craftpix/`), itch.io (Cloudflare bloqueia — usar mirrors GitHub).

## As 5 propostas

### 1. Corte Cromático (slash arc universal) — a fundação
Arco de corte desenhado por cima do swing, na direção do ataque.
- **Visual:** crescente greyscale (Slash Collection `Big/Slash.png`) com
  `setBlendMode(ADD)` + `setTint(corDaArma)` + fade out em ~150ms. Thrust (lança)
  usa `Huge/Lunge Thrust.png` esticado no eixo do golpe.
- **Escalável porque:** 1 sheet serve TODAS as armas — cor via tint (aço branco-azul,
  adaga verde veneno, maça âmbar...), tamanho via `setScale(alcance/64)`, direção via
  `rotation` (8 direções de graça, sem sheet por direção).
- **Phaser:** `add.image` no ângulo do golpe → tween `{alpha: 0, scale: +20%}` → destroy.
  Gancho: já existe o momento do ataque no auto-combate (COMBAT), só anexar.

### 2. Rastro Espectral (afterimage / dash-strike)
Investida curta que deixa "fantasmas" do personagem + arma para trás.
- **Visual:** 3-4 cópias congeladas do sprite ATUAL (paper doll inteiro com arma),
  alpha 0.5→0.1, tint ciano/roxo, cada uma morrendo em ~250ms. Opcional: streak de
  luz (Kenney `trace_01.png`) no vetor do dash.
- **Escalável porque:** ZERO asset por arma — clona a textura/frame corrente
  (`scene.add.image(x, y, spr.texture.key, spr.frame.name)`), então funciona com
  qualquer equipamento, montaria, e até no Porco Rosa.
- **Phaser:** no dash, a cada 40ms solta um clone com `setTint+alpha` e tween de fade.
  É a skill mais barata de implementar e a que mais impressiona em movimento.

### 3. Lâmina Elemental (infusão fogo/raio/gelo)
Buff ligável: a arma "acende" num elemento; todo golpe carrega o VFX do elemento.
- **Visual:** partículas emitidas da mão/arma durante o swing — fogo (Tiny Swords
  `Fire_01-03`, já no estilo do jogo), raio (Kenney `spark_04` tintado), gelo
  (Kenney `star/magic` azulados) — + o slash da proposta 1 tintado na cor do elemento
  + impacto no alvo (Weapon Slash variante Fire pronta p/ fogo).
- **Escalável porque:** elemento = {tint, textura de partícula, som}; arma é
  irrelevante — o emissor segue o ponto médio do walker. Adicionar elemento novo =
  1 entrada de config.
- **Phaser:** `add.particles` com emitter `follow` no player, `frequency` só durante
  o swing; no hit, burst de 6-10 partículas no alvo.

### 4. Onda de Impacto (ground slam p/ machado/maça)
Golpe carregado que soca o chão: anel de choque expande e empurra inimigos.
- **Visual:** elipse top-down (Slash Collection `Circular.png` achatado ~55% em Y)
  expandindo de 0.3→2.5× com ADD + fade, poeira marrom (frames iniciais das
  explosões Tiny Swords), `camera.shake(120ms)`, knockback radial nos foes no raio.
- **Escalável porque:** o anel é geometria pura — raio do efeito = raio do dano
  (mesmo número), qualquer arma pesada usa; a cor do anel herda o tint da arma.
- **Phaser:** tween de scale no anel + loop nos `this.foes` medindo distância
  (mesma conta do auto-combate) aplicando vetor de recuo.

### 5. Tempestade de Lâminas (whirlwind 360°)
Giro completo: o personagem vira um redemoinho de cortes por ~1s.
- **Visual:** `Circular.png` girando (rotation tween 2 voltas) + 3 slashes pequenos
  (`Small/small_00xx`) orbitando o player com ADD/tint + o sprite da arma no frame
  idle rotacionando junto num container; hit em área a cada 250ms.
- **Escalável porque:** os orbitais são greyscale tintados; a arma que aparece
  girando é o frame idle de QUALQUER sheet de arma (rotation no container, não
  precisa de animação própria).
- **Phaser:** container com N imagens orbitando via `rotation += dt`, dano em área
  reusando o range do COMBAT ×1.5.

## Ordem sugerida de implementação
1 (fundação, todos os golpes ganham) → 2 (barata, efeito uau) → 4 (machado ganha
identidade) → 3 (sistema de elementos) → 5 (ultimate).

## Recorte técnico comum (fazer 1×, usar em todas)
- `fx.js` no demo64: helpers `slashArc(scene, x, y, ang, tint, scale)`,
  `afterimage(scene, sprite)`, `ring(scene, x, y, r, tint)`.
- Sheets greyscale entram em `public/assets/64/effects/` via pipeline
  `sprite-post` (recorte + `normalize --cols N` quando virar spritesheet).
- CC-BY (Slash Hit 01) só entra em `public/` se creditado no `CREDITS.md`.
