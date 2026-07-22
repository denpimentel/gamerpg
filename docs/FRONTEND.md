# GameRPG Lab — Documentação Front-end

Bancada de testes visuais de RPG 2D top-down (estilo Tibia). **Não é produção** — o foco é
experimentar visual, stacks e assets. Tudo estático, sem servidor de jogo, sem build.

Demo atual: **Ilha de Elmsong** (`public/demo64/`) — 4 biomas (campo, deserto, pedra, neve),
18 monstros, paper doll com equipamentos trocáveis, movimento livre.

---

## 1. Stack e bibliotecas

| Camada | Ferramenta | Papel |
|--------|-----------|-------|
| **Engine de jogo** | [Phaser 4.2.1](https://phaser.io) | Renderer WebGL, loop, animações, câmera, input. Vendorizado em `public/vendor/phaser.min.js` (sem CDN, funciona offline/LAN). |
| **Linguagem** | JavaScript ES6 puro | Sem TypeScript, sem transpile. Roda direto no browser. |
| **Motor compartilhado** | `public/shared/engine.js` (`RPGLab`) | Movimento, IA de NPC, joystick, botões — ver seção 4. |
| **Hospedagem** | `python3 -m http.server` | Servidor estático na LAN (porta 8310). Zero backend. |
| **Pipeline de assets** | Python 3 + [Pillow](https://python-pillow.org) + NumPy | Recorte, chroma key, montagem de spritesheets, upscale Scale2x. Scripts em `scripts/`. |
| **Geração por IA** | [PixelLab API](https://api.pixellab.ai) | Tileset, árvore, personagem e monstros do bioma neve. Ver `scripts/gen_neve.py`. |

### Por que "sem build"

Não há `package.json`, bundler, nem `node_modules`. Cada demo é `index.html` + `game.js` +
tags `<script>`. Para rodar é só servir a pasta `public/` como arquivos estáticos. Isso
mantém a bancada trivial de hospedar e de jogar pelo celular na rede local.

```bash
# Servir na LAN (ou localmente)
python3 -m http.server 8310 --directory ./public
# acessar: http://localhost:8310/demo64/ (ou http://<seu-ip-local>:8310/demo64/)
```

> **Cache busting:** os `<script>` usam `?v=<tag>` (ex.: `engine.js?v=reorg`). Ao editar o
> motor ou o jogo, incremente a tag para o browser recarregar (senão o cache serve a versão
> antiga — causa comum de "não atualizou").

---

## 2. Arquitetura de pastas

```
public/                     raiz servida (estático puro)
  index.html                hub — cartão do demo
  vendor/phaser.min.js      Phaser 4.2.1 vendorizado
  shared/
    engine.js               RPGLab: FreeWalker, HomeWanderer, GridWalker, Joystick…
    style.css               HUD + joystick + inventário
  demo64/
    index.html              inventário DOM + carrega o jogo
    game.js                 a Ilha de Elmsong inteira
  assets/64/                ← ver seção 3
scripts/                    pipeline Python (fora da web)
docs/                       esta documentação
```

---

## 3. Organização dos assets (`public/assets/64/`)

Organizado **por bioma** para criaturas e props; terreno é compartilhado. Tudo em escala
64px (nativos 64px ou upscalados 2×).

```
assets/64/
  terrain/                  atlases de chão e água (compartilhados entre biomas)
    water.png               água base (tileSprite de fundo)
    foam.png                espuma animada da borda (8 frames, 192px)
    bridge.png              ponte (3 segmentos horizontais)
    campo_deserto.png       Tilemap_Flat: grama (col 0-2) + areia (col 5-7)
    pedra.png               Tilemap_Elevation: piso rochoso
    neve.png                recolor de campo_deserto → neve (ver seção 5)
    rocks_01.png, shadows.png
  props/                    decoração + árvores
    tree_campo.png          pinheiro Tiny Swords (animado, balança)
    tree_neve.png           pinheiro nevado (gerado por IA)
    deco/01..19.png         cogumelos, flores, arbustos, marcos
  creatures/
    campo/    chicken bunny bee slime           cada um: idle.png (+ walk.png)
    deserto/  snail rino angrypig trunk goblin_tnt
    pedra/    bat ghost mushroom radish goblin_tocha
    neve/     yeti golem wolf                    (gerados por IA — 92px, 4 direções)
    common/   sheep                              (ambiente, todos os biomas)
  player/
    equip/    body feet legs head hair           paper doll LPC, 128px (upscale 2×)
              torso_{shirt,leather,chain,legion,plate}
              weapon_{longsword,dagger,mace,waraxe,spear}
    hero_ia/  idle.png walk.png                  skin "Cavaleiro de Gelo" (IA)
  ui/
    icons/                  ícones do inventário (armas, armaduras, skins)
  _source/                  NÃO carregado em runtime — fontes reproduzíveis
    lpc_64/                 originais 64px do paper doll (entrada do upscale)
    ai_gen/                 pipeline PixelLab: state.json, tileset Wang cru, sheets
```

### Convenção de nomes

- Criaturas: sempre `idle.png` e (quando existe) `walk.png`. O tamanho de frame nativo fica
  na tabela `MOBS` do `game.js` (ex.: `['Rino', 'deserto/rino', 52, 34, true, [20,6]]`).
- **Monstros Pixel Adventure são upscalados 2×** (Scale2x): o arquivo tem frame `nativo×2`
  e o jogo carrega com `frameWidth: fw*2` e renderiza em `scale/2` — mesmo tamanho na tela,
  metade do "serrilhado". Mesmo tratamento do paper doll.

### Padronização 64px / upscale

Tudo que era pixel art de baixa resolução passou por **Scale2x** (AdvMAME2x), algoritmo
determinístico que arredonda diagonais preservando contornos e o alinhamento entre camadas:

- **Paper doll LPC:** 64px → 128px (`scripts/upscale_lpc.py`), renderizado a 0.8×.
- **Monstros Pixel Adventure:** nativo → 2× (`scripts/reorg_assets.py`, quadro a quadro
  para não vazar entre frames), renderizados a 0.8×.
- **Não upscalados** (já suaves/alta-res): personagens IA (92px), goblins Tiny Swords (192px),
  terreno (64px nativo).

Por que Scale2x e não IA: o paper doll exige que as camadas (corpo, roupa, arma) fiquem
alinhadas pixel a pixel. Upscale por IA inventaria detalhes diferentes em cada camada e
quebraria o encaixe. Scale2x aplica a mesma transformação determinística em todas.

---

## 4. Motor compartilhado (`RPGLab`, em `shared/engine.js`)

API única de movimento: todo walker tem `update(vec, dt)` e chama um callback
`setAnim(state, dir)` que o demo usa para trocar sprite/animação. Trocar de sistema de
movimento é instanciar outra classe.

### `FreeWalker` — movimento livre (usado no demo64)

Velocidade contínua em px/s, integrada por *delta time* (igual em qualquer FPS). Colisão
**AABB com raio** que testa a caixa dos "pés" e **desliza na parede** (move em X e Y
separadamente — encostar numa árvore em diagonal continua deslizando pelo eixo livre).

```js
new FreeWalker(scene, sprite, {
  tile: 64, tx: 7, ty: 7,        // spawn em coordenada de tile
  speed: 165,                     // px/s
  mode: 8,                        // 8 direções (player) ou 4 (mobs)
  radius: 12,                     // raio da colisão
  walkablePx: (px, py) => ...,    // caminhável? (recebe pixel, converte p/ tile)
  setAnim: (state, dir) => ...,   // 'walk'|'idle', 'n'|'ne'|'e'…
});
```

### `HomeWanderer` — IA dos NPCs (coleira elástica)

Vagam num raio do ponto de nascença com **atração elástica de volta**: cada passeio mistura
uma direção aleatória com o vetor que aponta pro "home", com peso `pull²` (0 no centro do
raio, 1 na borda). Resultado: passeios longos e naturais que nunca escapam nem ficam presos
batendo na parede.

```js
new HomeWanderer(scene, walker, { radius: 150 });
// raios usados: mobs comuns/goblins 150, IA 165, ovelhas 120
```

O `walkablePxZone(zone)` do walker continua como trava dura de segurança (NPCs não cruzam
pontes nem entram na água, mesmo se a coleira permitisse).

### `GridWalker` — movimento em grade (estilo Tibia clássico)

Passo de célula em célula com tween. Continua no motor para quem preferir a vibe Tibia
travada; mesma API do `FreeWalker`. Não usado no demo64 atualmente.

### `Joystick`, `ActionButton`, `keyboardVec`, `makeKeys`

- **Joystick** virtual (lado esquerdo da tela, aparece ao tocar). Produz um vetor contínuo
  — casa perfeitamente com o `FreeWalker`.
- **ActionButton** (lado direito) — botão de ação com callback.
- **keyboardVec** — lê WASD/setas → `{x, y}`; **makeKeys** registra as teclas.

---

## 5. Como o mapa é construído (e as bordas animadas)

### Terreno por "autotile" 3×3

Cada bioma é um retângulo pintado com um bloco 3×3 do atlas: 4 cantos, 4 bordas, 1 miolo.
A célula certa é escolhida pela posição na ilha:

```js
function paintRect(scene, rect, base, depth, tex = 'flat') {
  for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
    const c = x === 0 ? 0 : (x === rect.w - 1 ? 2 : 1);   // coluna: 0=oeste 1=meio 2=leste
    const r = y === 0 ? 0 : (y === rect.h - 1 ? 2 : 1);   // linha:  0=norte 1=meio 2=sul
    scene.add.image((rect.x + x) * 64, (rect.y + y) * 64, tex, base + r * 10 + c)
      .setOrigin(0).setDepth(depth);
  }
}
```

- **Campo** usa `campo_deserto` base 0 (grama); **deserto** o mesmo atlas base 5 (areia,
  +5 colunas); **pedra** usa `pedra.png` (elevation, layout 4 colunas); **neve** usa
  `neve.png`.
- Profundidade (`setDepth`): chão em depth negativo; sprites em `sprite.y` para sobreposição
  correta (quem está mais embaixo desenha por cima).

### Borda animada de espuma (a "água batendo")

A espuma é um sprite **animado de 8 frames** (`foam.png`, 192px) desenhado só no anel externo
de cada ilha. É o que dá a sensação de água batendo na praia:

```js
this.anims.create({ key: 'foam', frameRate: 9, repeat: -1,
  frames: this.anims.generateFrameNumbers('foam', { start: 0, end: 7 }) });

function foamRing(scene, rect) {
  for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
    if (y === 0 || x === 0 || y === rect.h - 1 || x === rect.w - 1) {   // só a borda
      scene.add.sprite((rect.x + x) * 64 + 32, (rect.y + y) * 64 + 32, 'foam')
        .setDepth(-90)
        .play({ key: 'foam', startFrame: (x + y) % 8 });   // fase deslocada = onda viva
    }
  }
}
```

O truque do **`startFrame: (x+y) % 8`** desencontra a fase de cada tile de espuma, então a
onda não pisca uniforme — parece se propagar ao redor da ilha. O mesmo `foamRing` serve os
4 biomas (a espuma é neutra, não depende do terreno).

Sobre a água de fundo há um único `tileSprite` de `water.png` cobrindo o mundo todo (depth
-100), e as ilhas ficam por cima.

### O mapa de NEVE em detalhe

O bioma neve nasceu de um experimento com IA e virou um híbrido:

1. **Tileset gerado por IA (PixelLab):** um Wang tileset de 16 tiles (cantos neve/água) foi
   gerado, fatiado por assinatura de canto (`t_UUUU.png`, `t_LULU.png`…) e guardado em
   `_source/ai_gen/snow/`. Pintar com ele exige **dual-grid** (cada tile cobre 4 cantos de
   células, com offset de -32px). Ficou lindo, mas com densidade de pixel diferente do resto.

2. **Decisão final — remake por recolor (palette swap):** em vez do tileset IA, o chão da
   neve usa `terrain/neve.png`, que é o **`campo_deserto` recolorido**: uma máscara pega os
   tons verdes/amarelos da grama (`g > b`) preservando os contornos navy, e uma rampa de
   luminância mapeia para tons de neve (azul-gelo → branco). Resultado: **mesma estrutura de
   autotile 3×3 e a MESMA borda de espuma animada** do resto do mundo, com coesão visual
   perfeita e custo zero. (Código do recolor em `scripts/gen_neve.py`.)

3. **Criaturas e árvore continuam 100% IA:** o pinheiro nevado (`props/tree_neve.png`), o
   Yeti, o Golem de Gelo e o Lobo Ártico (`creatures/neve/*`) e o herói Cavaleiro de Gelo
   (`player/hero_ia/*`) foram todos gerados pela PixelLab.

Ou seja: o **chão** da neve reaproveita o sistema existente (autotile + espuma animada) via
recolor — barato e coeso; o que é **conteúdo novo/vivo** (bichos, árvore, herói) veio da IA.

### Árvores e profundidade

Árvores animadas (`tree_campo`, balança em loop yoyo) e o pinheiro IA são posicionadas com
origem no pé e `setDepth(sprite.y)` — o personagem passa por trás/na frente conforme o Y.

---

## 6. Scripts do pipeline (`scripts/`)

| Script | O que faz |
|--------|-----------|
| `upscale_lpc.py` | Scale2x 2× de todas as camadas do paper doll (`_source/lpc_64` → `player/equip`). |
| `reorg_assets.py` | Migração da árvore antiga para a estrutura por bioma + Scale2x dos monstros. |
| `gen_neve.py` | Pipeline PixelLab: tileset, árvore, herói e monstros de neve. Idempotente (estado em `_source/ai_gen/state.json`). Uso: `python3 scripts/gen_neve.py <tileset\|tree\|hero\|monsters\|all\|status>`. |
| `pixellab-route.py` | Roteia entre as chaves PixelLab escolhendo a de maior saldo. |

### Notas do PixelLab (aprendizados)

- POSTs async retornam **202** com `*_id`; poll em `GET /tilesets/{id}`, `/characters/{id}`,
  `/map-objects/{id}` (423 = ainda processando).
- Personagem sai em **92×92** (não 64); animações via `/characters/animations` template `walk`.
  **Templates quadrúpedes (dog) usam ids próprios** (`walk-6-frames`).
- O CDN `backblaze.pixellab.ai` bloqueia o User-Agent padrão do urllib — mandar
  `User-Agent: Mozilla/5.0`.

---

## 7. Créditos e licenças

Ver `CREDITS.md` na raiz. Resumo: terreno/goblins Tiny Swords (CC0), monstros Pixel Adventure
(CC0), paper doll LPC (**CC-BY-SA/GPL** — exige atribuição), bioma neve gerado via PixelLab.
