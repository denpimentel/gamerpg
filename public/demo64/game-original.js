/* Ilha de Elmsong 2.0 — 3 biomas, 15 monstros (CC0), paper doll LPC com inventário */
(function () {
  const { FreeWalker, HomeWanderer, Joystick, ActionButton, keyboardVec, makeKeys } = RPGLab;
  const TILE = 64, WORLD_W = 55, WORLD_H = 27, WORLD_X0 = -25;

  // --- mundo: 6 ilhas + pontes (castelo e villa em x negativo, à esquerda do campo) ---
  const ISLES = {
    castelo: { x: -24, y: 3, w: 10, h: 9, base: 0, titulo: 'CASTELO' },
    villa: { x: -11, y: 3, w: 10, h: 9, base: 0, titulo: 'VILLA' },
    campo: { x: 2, y: 3, w: 10, h: 9, base: 0, titulo: 'CAMPO' },
    deserto: { x: 15, y: 3, w: 10, h: 9, base: 5, titulo: 'DESERTO' },
    pedra: { x: 28, y: 3, w: 10, h: 9, base: null, titulo: 'PEDRA' },
    neve: { x: 41, y: 3, w: 10, h: 9, base: null, titulo: 'NEVE ✦ IA' },
    burgo: { x: -11, y: 15, w: 10, h: 9, base: null, titulo: 'BURGO' },
  };
  const BRIDGES = [[-14, 7], [-13, 7], [-12, 7], [-1, 7], [0, 7], [1, 7], [12, 7], [13, 7], [14, 7], [25, 7], [26, 7], [27, 7], [38, 7], [39, 7], [40, 7]];
  // ponte vertical villa → burgo (frames 3/6/9 do bridge.png = topo/meio/base)
  const VBRIDGE = [[-6, 12], [-6, 13], [-6, 14]];
  // casa gerada por IA (ChatGPT) — 8×7.8 tiles, centrada no castelo. footprint bloqueado.
  const AI_HOUSE = { cx: -19, by: 12, cells: [] };
  for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy <= 3; dy++) AI_HOUSE.cells.push([-19 + dx, 11 - dy]);
  const TREES = [[4, 4], [9, 5], [3, 9]];
  const TREES_NEVE = [[43, 4], [48, 5], [44, 10], [49, 11], [46, 6]];
  const SPAWN = { x: 7, y: 7 };

  const inRect = (r, tx, ty) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  const onLand = (tx, ty) =>
    Object.values(ISLES).some(r => inRect(r, tx, ty)) ||
    BRIDGES.some(([bx, by]) => bx === tx && by === ty) ||
    VBRIDGE.some(([bx, by]) => bx === tx && by === ty);
  // construções Tiny Swords Update 010 (CC0) — 64px nativo, escala 1:1 com o tile.
  //   [tex, ax, ay, wt, ht, frames]: (ax,ay) = canto inf-esq em tiles; a arte sobe ht tiles.
  const BUILDINGS = [
    ['castle',   -11,  7, 5, 4, 0],
    ['house',     -5,  6, 2, 3, 0],
    ['tower',    -11, 11, 2, 4, 0],
    ['gobtower',  -8, 11, 2, 3, 8],
    ['gobhouse',  -4, 11, 2, 3, 0],
  ];
  const blocked = new Set([...TREES, ...TREES_NEVE, ...AI_HOUSE.cells].map(([x, y]) => x + ',' + y));
  // pegada de colisão: as 2 fileiras da base de cada construção
  for (const [, ax, ay, wt] of BUILDINGS)
    for (let dx = 0; dx < wt; dx++) for (let dy = 0; dy < 2; dy++) blocked.add((ax + dx) + ',' + (ay - dy));

  // --- escalas (ajuste fino de proporção vs cenário) ---
  const SCALE = { player: 1.6, mob: 1.6, goblin: 0.8, sheep: 0.85 };

  // --- combate automático ---
  // REGRA ABSOLUTA DE SIMETRIA: existe UMA envergadura global, e a MESMA distância
  // (entre centros dos walkers, calculada uma única vez por par/frame) decide o ataque
  // dos dois lados. Se o player alcança o bicho, o bicho alcança o player — sempre.
  const COMBAT = { range: 30, playerCdMs: 900, mobCdMs: 1100 };
  const DIRN = { '1,0': 'e', '-1,0': 'w', '0,1': 's', '0,-1': 'n',
                 '1,1': 'se', '1,-1': 'ne', '-1,1': 'sw', '-1,-1': 'nw' };
  const dirBetween = (from, to) => {
    const q = RPGLab.quantize({ x: to.x - from.x, y: to.y - from.y }, 8);
    return DIRN[q.dx + ',' + q.dy];
  };

  // --- paper doll ---
  const ROWS = { n: 0, w: 1, s: 2, e: 3 };
  const COLS = { walk: 9, slash: 6, thrust: 8 };
  const CLOTH = ['body', 'feet', 'legs', 'head', 'hair'];
  const TORSOS = { shirt: 'torso_shirt', leather: 'torso_leather', chain: 'torso_chain', legion: 'torso_legion', plate: 'torso_plate' };
  // arquivos por arma: [anim, sufixo, tamanhoFrame]
  const WEAPON_FILES = {
    longsword: [['walk', '', 64], ['walk_behind', '', 64], ['slash', '', 192], ['slash_behind', '', 192]],
    dagger: [['walk', '', 64], ['walk_behind', '', 64], ['slash', '', 64], ['slash_behind', '', 64]],
    mace: [['walk', '', 64], ['walk_behind', '', 64], ['slash', '', 192], ['slash_behind', '', 192]],
    waraxe: [['walk', '', 64], ['slash', '', 192], ['slash_behind', '', 192]],
    spear: [['walk', '', 64], ['walk_behind', '', 64], ['thrust', '', 64], ['thrust_behind', '', 64]],
    lord_mas_lance: [['walk', '', 64], ['walk_behind', '', 64], ['thrust', '', 64], ['thrust_behind', '', 64]],
  };
  const ATTACK_ANIM = {
    longsword: 'slash', dagger: 'slash', mace: 'slash', waraxe: 'slash',
    spear: 'thrust', lord_mas_lance: 'thrust',
  };

  // --- montarias LPC (cavalo em 2 camadas: atrás → cavaleiro cortado na cintura → frente) ---
  const MOUNTS = ['marrom', 'preto', 'cinza', 'dourado', 'branco'];
  // modX/modY do cavaleiro por ciclo/direção/frame (tabela do [LPC] Horse Riding 0.9)
  const RIDE_OFF = {
    stand: { n: [[0, -23]], w: [[-3, -28]], s: [[0, -21]], e: [[3, -28]] },
    gallop: {
      n: [[0, -22], [0, -23], [0, -26], [0, -24]],
      w: [[-2, -32], [-2, -28], [-7, -24], [-5, -26]],
      s: [[0, -21], [0, -22], [0, -25], [0, -23]],
      e: [[2, -32], [2, -28], [7, -24], [5, -26]],
    },
  };
  // montarias IA (PixelLab, camada única — bicho desenha ATRÁS do cavaleiro):
  // offs = [modX, modY] do cavaleiro por direção, em px da arte 64
  const AI_MOUNTS = {
    // dy: o frame IA tem margem vazia embaixo — posiciona os pés na linha do chão (~26)
    // bob: deslocamento extra do cavaleiro por frame do walk (px da arte 64) — trote
    porco: { frame: 92, walkCols: 6, speed: 230, dy: 46, rate: 14,
             bob: [0, -2, -4, -2, 0, -1],
             // w espelhado do east: corpo do porco é off-center, sela cai +4px à direita
             offs: { n: [0, -13], w: [4, -13], s: [0, -14], e: [0, -13] } },
    // slime domado (gen_montaria.py, ref = slime do campo). bob MEDIDO dos frames:
    // topo do corpo por frame do hop [+1,-2,-4,-6,-5,-2]px/1.6 — o cavaleiro acompanha o squish
    slime: { frame: 92, walkCols: 6, speed: 200, dy: 40, rate: 12,
             bob: [1, -1, -3, -4, -3, -1],
             offs: { n: [0, -12], w: [0, -12], s: [0, -12], e: [0, -12] } },
    skeletal_horse: { frame: 192, walkCols: 6, speed: 260, dy: 34, rate: 10,
             scale: 0.68, singleRow: true, legY: -40,
             bob: [0, -2, -4, -2, 0, -1],
             offs: { n: [0, -32], w: [0, -32], s: [0, -32], e: [0, -32] } },
    skeletal_horse_gold: { frame: 192, walkCols: 6, speed: 270, dy: 34, rate: 10,
             scale: 0.68, singleRow: true, legY: -40,
             bob: [0, -2, -4, -2, 0, -1],
             offs: { n: [0, -32], w: [0, -32], s: [0, -32], e: [0, -32] } },
    ancestral_deer: { frame: 256, walkCols: 6, speed: 275, dy: 32, rate: 9,
             scale: 0.58, singleRow: true, legY: -13,
             bob: [0, -2, 0, -2, 0, -2],
             offs: { n: [-8, -18], w: [9, -18], s: [-8, -18], e: [-9, -18] } },
    spring_deer: { frame: 256, walkCols: 6, speed: 285, dy: 32, rate: 9,
             scale: 0.58, singleRow: true, legY: -13,
             bob: [0, -2, 0, -2, 0, -2],
             offs: { n: [-8, -18], w: [9, -18], s: [-8, -18], e: [-9, -18] } },
  };

  // --- monstros Pixel Adventure (upscalados 2x → frame nativo × 2 no load): ---
  //     [nome, 'bioma/pasta', fwNativo, fhNativo, temWalk, célula]
  const MOBS = [
    ['Caracol', 'deserto/snail', 38, 24, true, [17, 5]],
    ['Rino', 'deserto/rino', 52, 34, true, [20, 6]],
    ['Javali', 'deserto/angrypig', 36, 30, true, [22, 9]],
    ['Tronco', 'deserto/trunk', 64, 32, true, [17, 10]],
    ['Morcego', 'pedra/bat', 46, 30, true, [30, 5]],
    ['Fantasma', 'pedra/ghost', 44, 30, false, [33, 4]],
    ['Cogumelo', 'pedra/mushroom', 32, 32, true, [35, 8]],
    ['Rabanete', 'pedra/radish', 30, 38, true, [31, 10]],
  ];

  function preload() {
    const A = '../assets/64/';
    // --- terrain/ (atlases de chão e água, compartilhados) ---
    this.load.image('water', A + 'terrain/water.png');
    this.load.spritesheet('flat', A + 'terrain/campo_deserto.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('elev', A + 'terrain/pedra.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('snowflat', A + 'terrain/neve.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('bridge', A + 'terrain/bridge.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('vila', A + 'terrain/vila.png', { frameWidth: 64, frameHeight: 64 });
    // FX de skills (greyscale/branco → tint em runtime; scripts/build_fx.py)
    for (const fx of ['slash', 'lunge', 'ring', 'orb', 'p_fire', 'p_spark', 'p_ice', 'p_dust'])
      this.load.image('fx-' + fx.replace('_', '-'), A + 'effects/fx_' + fx + '.png');
    this.load.spritesheet('foam', A + 'terrain/foam.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('rocks1', A + 'terrain/rocks_01.png', { frameWidth: 64, frameHeight: 64 });
    // --- props/ (árvores + decoração, por bioma) ---
    this.load.spritesheet('tree', A + 'props/tree_campo.png', { frameWidth: 192, frameHeight: 192 });
    this.load.image('aitree', A + 'props/tree_neve.png');
    for (let i = 1; i <= 18; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image('deco' + n, A + 'props/deco/' + n + '.png');
    }
    // --- buildings/ (Tiny Swords Update 010, CC0) ---
    for (const b of ['castle', 'house', 'tower', 'gobhouse'])
      this.load.image('bld-' + b, A + 'buildings/' + b + '.png');
    this.load.spritesheet('bld-gobtower', A + 'buildings/gobtower.png', { frameWidth: 256, frameHeight: 192 });
    this.load.image('casa-azul', A + 'buildings/casa_azul.png');       // gerada por IA (ChatGPT)
    this.load.image('casa-azul-shadow', A + 'buildings/casa_azul_shadow.png');
    // --- creatures/ ---
    this.load.spritesheet('goblin', A + 'creatures/pedra/goblin_tocha/sheet.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('tnt', A + 'creatures/deserto/goblin_tnt/sheet.png', { frameWidth: 192, frameHeight: 192 });
    this.load.image('swamp-ogre-idle', A + 'creatures/campo/swamp_ogre/idle.png');
    this.load.spritesheet('swamp-ogre-walk', A + 'creatures/campo/swamp_ogre/walk.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('swamp-ogre-attack', A + 'creatures/campo/swamp_ogre/attack.png', { frameWidth: 192, frameHeight: 192 });
    this.load.image('mossy-boar-idle', A + 'creatures/campo/mossy_boar/idle.png');
    this.load.spritesheet('mossy-boar-walk', A + 'creatures/campo/mossy_boar/walk.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('mossy-boar-attack', A + 'creatures/campo/mossy_boar/attack.png', { frameWidth: 192, frameHeight: 192 });
    this.load.image('clover-spider-idle', A + 'creatures/campo/clover_spider/idle.png');
    this.load.spritesheet('clover-spider-walk', A + 'creatures/campo/clover_spider/walk.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('clover-spider-attack', A + 'creatures/campo/clover_spider/attack.png', { frameWidth: 192, frameHeight: 192 });
    this.load.image('cursed-scarecrow-idle', A + 'creatures/campo/cursed_scarecrow/idle.png?v=small1');
    this.load.spritesheet('cursed-scarecrow-walk', A + 'creatures/campo/cursed_scarecrow/walk.png?v=small1', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('cursed-scarecrow-attack', A + 'creatures/campo/cursed_scarecrow/attack.png?v=small1', { frameWidth: 192, frameHeight: 192 });
    this.load.image('meadow-turtle-idle', A + 'creatures/campo/meadow_turtle/idle.png?v=nosefix1');
    this.load.spritesheet('meadow-turtle-walk', A + 'creatures/campo/meadow_turtle/walk.png?v=nosefix1', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('meadow-turtle-attack', A + 'creatures/campo/meadow_turtle/attack.png?v=nosefix1', { frameWidth: 192, frameHeight: 192 });
    this.load.image('deer-king-idle', A + 'creatures/campo/deer_king/idle.png?v=cartoon1');
    this.load.image('deer-king-enraged', A + 'creatures/campo/deer_king/enraged.png?v=polish1');
    this.load.spritesheet('deer-king-walk', A + 'creatures/campo/deer_king/walk.png?v=walk3', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('deer-king-walk-enraged', A + 'player/mount/spring_deer/walk.png?v=walk3', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('deer-king-charge', A + 'creatures/campo/deer_king/charge.png?v=cartoon1', { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('deer-king-charge-enraged', A + 'creatures/campo/deer_king/charge_enraged.png?v=polish1', { frameWidth: 256, frameHeight: 256 });
    for (const n of ['yeti', 'golem', 'wolf']) { // IA PixelLab: 92px, idle 1col / walk 6col, linhas n/w/s/e
      this.load.spritesheet('ai' + n + '-idle', A + 'creatures/neve/' + n + '/idle.png', { frameWidth: 92, frameHeight: 92 });
      this.load.spritesheet('ai' + n + '-walk', A + 'creatures/neve/' + n + '/walk.png', { frameWidth: 92, frameHeight: 92 });
    }
    // Lord Mas: chefe montado, frames grandes e âncora nos cascos.
    this.load.image('death-knight-idle', A + 'creatures/neve/ghost_knight/idle.png');
    this.load.spritesheet('death-knight-walk', A + 'creatures/neve/ghost_knight/walk.png', { frameWidth: 320, frameHeight: 192 });
    this.load.spritesheet('death-knight-attack', A + 'creatures/neve/ghost_knight/attack.png', { frameWidth: 320, frameHeight: 192 });
    for (const [, path, fw, fh, hasWalk] of MOBS) { // Pixel Adventure upscalado 2x → frame nativo × 2
      this.load.spritesheet(`en-${path}-idle`, `${A}creatures/${path}/idle.png`, { frameWidth: fw * 2, frameHeight: fh * 2 });
      if (hasWalk) this.load.spritesheet(`en-${path}-walk`, `${A}creatures/${path}/walk.png`, { frameWidth: fw * 2, frameHeight: fh * 2 });
    }
    // --- player/ (paper doll LPC upscalado 2x + herói IA) ---
    for (const c of [...CLOTH, ...Object.values(TORSOS)]) {
      for (const anim of ['walk', 'slash', 'thrust']) {
        this.load.spritesheet(`${c}-${anim}`, `${A}player/equip/${c}/${anim}.png`, { frameWidth: 128, frameHeight: 128 });
      }
    }
    for (const [w, files] of Object.entries(WEAPON_FILES)) {
      for (const [anim, , fs] of files) {
        this.load.spritesheet(`w-${w}-${anim}`, `${A}player/equip/weapon_${w}/${anim}.png`, { frameWidth: fs * 2, frameHeight: fs * 2 });
      }
    }
    for (const m of MOUNTS) { // cavalos upscalados 2x: frames 128 nativos → 256
      for (const cyc of ['stand', 'gallop']) {
        for (const l of ['b', 'f']) {
          this.load.spritesheet(`mt-${m}-${cyc}${l}`, `${A}player/mount/${m}/${cyc}_${l}.png`, { frameWidth: 256, frameHeight: 256 });
        }
      }
    }
    for (const [m, cfg] of Object.entries(AI_MOUNTS)) {
      const mountVersion = m === 'skeletal_horse_gold' ? '?v=green-eye-v2'
        : (m === 'ancestral_deer' || m === 'spring_deer') ? '?v=walk3' : '';
      this.load.spritesheet(`mtai-${m}-idle`, `${A}player/mount/${m}/idle.png${mountVersion}`, { frameWidth: cfg.frame, frameHeight: cfg.frame });
      this.load.spritesheet(`mtai-${m}-walk`, `${A}player/mount/${m}/walk.png${mountVersion}`, { frameWidth: cfg.frame, frameHeight: cfg.frame });
    }
    this.load.spritesheet('aihero-idle', A + 'player/hero_ia/idle.png', { frameWidth: 92, frameHeight: 92 });
    this.load.spritesheet('aihero-walk', A + 'player/hero_ia/walk.png', { frameWidth: 92, frameHeight: 92 });
    this.load.image('mount-leg', A + 'player/mount_leg.png'); // pezinho do lado de cá (montado)
    this.load.image('lord-mas-lance-icon', A + 'ui/icons/lord_mas_lance.png');
    this.load.spritesheet('evil_spirit', A + 'effects/evil_spirit_sheet.png', { frameWidth: 192, frameHeight: 192 });
  }

  function paintRect(scene, rect, base, depth, tex = 'flat') {
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      const c = x === 0 ? 0 : (x === rect.w - 1 ? 2 : 1);
      const r = y === 0 ? 0 : (y === rect.h - 1 ? 2 : 1);
      scene.add.image((rect.x + x) * TILE, (rect.y + y) * TILE, tex, base + r * 10 + c)
        .setOrigin(0).setDepth(depth);
    }
  }

  // Tilemap_Elevation: platô 3×3 nas linhas 0-2 (col 0=oeste, 1=miolo, 2=leste) e
  // linha 3 = face do penhasco, desenhada UMA LINHA ABAIXO da ilha (sobre a água).
  function paintStone(scene, rect, depth) {
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      const col = x === 0 ? 0 : (x === rect.w - 1 ? 2 : 1);
      const row = y === 0 ? 0 : (y === rect.h - 1 ? 2 : 1);
      scene.add.image((rect.x + x) * TILE, (rect.y + y) * TILE, 'elev', row * 4 + col)
        .setOrigin(0).setDepth(depth);
    }
    for (let x = 0; x < rect.w; x++) {
      const col = x === 0 ? 0 : (x === rect.w - 1 ? 2 : 1);
      scene.add.sprite((rect.x + x) * TILE + 32, (rect.y + rect.h) * TILE + 32, 'foam')
        .setDepth(-90).play({ key: 'foam', startFrame: x % 8 });
      scene.add.image((rect.x + x) * TILE, (rect.y + rect.h) * TILE, 'elev', 12 + col)
        .setOrigin(0).setDepth(depth);
    }
  }
  // BURGO: calçamento medieval (vila.png, tileset WhatsApp tratado via chroma key).
  // Piso de pedra variado, mureta na borda (12/14/15 + cantos 16/17/18/22), saia
  // frame 13 sobre a água, praça de tijolo (6-9, transições 10/11), parque de
  // grama (30-35 + miolo do 'flat') e decalques urbanos (24-29).
  function paintVila(scene, rect, depth) {
    const rng = new Phaser.Math.RandomDataGenerator(['burgo']);
    const FLOOR = [0, 0, 0, 1, 1, 1, 2, 3, 4, 5];
    const put = (lx, ly, f, tex = 'vila') =>
      scene.add.image((rect.x + lx) * TILE, (rect.y + ly) * TILE, tex, f).setOrigin(0).setDepth(depth);
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      let f = rng.pick(FLOOR);
      if (y === 0) f = x === 0 ? 16 : (x === rect.w - 1 ? 17 : 12);
      else if (x === 0) f = y === rect.h - 1 ? 18 : 14;
      else if (x === rect.w - 1) f = y === rect.h - 1 ? 22 : 15;
      put(x, y, f);
    }
    put(VBRIDGE[0][0] - rect.x, 0, rng.pick([0, 1])); // abre a mureta na entrada da ponte
    // saia da plataforma: conteúdo do frame 13 começa na linha 44 — sobe 44px p/ colar na ilha
    for (let x = 0; x < rect.w; x++)
      scene.add.image((rect.x + x) * TILE, (rect.y + rect.h) * TILE - 44, 'vila', 13)
        .setOrigin(0).setDepth(depth);
    // praça de tijolo com transição p/ pedra nas laterais
    for (let y = 2; y <= 4; y++) for (let x = 2; x <= 5; x++)
      put(x, y, x === 2 ? 11 : (x === 5 ? 10 : rng.pick([6, 6, 7, 8, 9])));
    // parque de grama no canto SE (curvas 34/35, retas 30-33, miolo grama do campo)
    put(5, 6, 34); put(6, 6, 30); put(7, 6, 31); put(8, 6, 35);
    put(5, 7, 32); put(5, 8, 32); put(8, 7, 33); put(8, 8, 33);
    for (let y = 7; y <= 8; y++) for (let x = 6; x <= 7; x++) put(x, y, 36); // grama pura sintetizada
    // decalques (tiles com fundo de pedra — só sobre área de pedra)
    [[2, 6, 24], [7, 2, 28], [4, 5, 29], [8, 4, 25], [1, 7, 25], [3, 6, 26], [1, 2, 27]]
      .forEach(([x, y, f]) => put(x, y, f));
  }
  function foamRing(scene, rect) {
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      if (y === 0 || x === 0 || y === rect.h - 1 || x === rect.w - 1) {
        scene.add.sprite((rect.x + x) * TILE + 32, (rect.y + y) * TILE + 32, 'foam')
          .setDepth(-90).play({ key: 'foam', startFrame: (x + y) % 8 });
      }
    }
  }

  function create() {
    const scene = this;
    const W = WORLD_W * TILE, H = WORLD_H * TILE, X0 = WORLD_X0 * TILE, FULLW = W - X0;
    this.add.tileSprite(X0, 0, FULLW, H, 'water').setOrigin(0).setDepth(-100);
    this.anims.create({ key: 'foam', frameRate: 9, repeat: -1,
      frames: this.anims.generateFrameNumbers('foam', { start: 0, end: 7 }) });

    for (const r of Object.values(ISLES)) foamRing(this, r);
    paintRect(this, ISLES.castelo, 0, -80);
    paintRect(this, ISLES.villa, 0, -80);
    paintRect(this, ISLES.campo, 0, -80);
    paintRect(this, ISLES.deserto, 5, -80);
    paintStone(this, ISLES.pedra, -80);
    paintRect(this, ISLES.neve, 0, -80, 'snowflat');
    paintVila(this, ISLES.burgo, -80);

    // casa gerada por IA no bioma CASTELO (sombra no chão + sprite com depth pela base)
    {
      const hx = AI_HOUSE.cx * TILE + TILE / 2, hy = AI_HOUSE.by * TILE;
      this.add.image(hx, hy - 6, 'casa-azul-shadow').setOrigin(0.5, 1).setDepth(hy - 60);
      this.add.image(hx, hy, 'casa-azul').setOrigin(0.5, 1).setDepth(hy);
    }

    // pontes (linha horizontal: frames 0,1,2 do sheet)
    BRIDGES.forEach(([x, y], i) => {
      const seg = i % 3 === 0 ? 0 : (i % 3 === 2 ? 2 : 1);
      this.add.image(x * TILE, y * TILE, 'bridge', seg).setOrigin(0).setDepth(-85);
    });
    VBRIDGE.forEach(([x, y], i) =>
      this.add.image(x * TILE, y * TILE, 'bridge', [3, 6, 9][i]).setOrigin(0).setDepth(-85));

    // títulos dos biomas
    for (const r of Object.values(ISLES)) {
      this.add.text((r.x + r.w / 2) * TILE, (r.y - 0.7) * TILE, r.titulo, {
        fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold',
        color: '#ffffff', stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5).setAlpha(0.85).setDepth(4000);
    }

    // árvores (campo)
    this.anims.create({ key: 'tree-sway', frameRate: 5, repeat: -1, yoyo: true,
      frames: this.anims.generateFrameNumbers('tree', { start: 0, end: 3 }) });
    TREES.forEach(([x, y]) => {
      const t = this.add.sprite(x * TILE + 32, y * TILE + 56, 'tree').setOrigin(0.5, 0.85);
      t.setDepth(t.y).play({ key: 'tree-sway', startFrame: (x + y) % 4 });
    });
    // pinheiros nevados gerados por IA
    TREES_NEVE.forEach(([x, y]) => {
      const t = this.add.image(x * TILE + 32, (y + 1) * TILE - 4, 'aitree').setOrigin(0.5, 1);
      t.setDepth((y + 1) * TILE - 4);
    });
    // deco por bioma
    const rng = new Phaser.Math.RandomDataGenerator(['elmsong2']);
    const deco = (isle, ids, n) => {
      for (let i = 0; i < n; i++) {
        const tx = rng.between(isle.x + 1, isle.x + isle.w - 2);
        const ty = rng.between(isle.y + 1, isle.y + isle.h - 2);
        if (blocked.has(tx + ',' + ty)) continue;
        this.add.image(tx * TILE + 32, ty * TILE + 60, 'deco' + rng.pick(ids))
          .setOrigin(0.5, 1).setDepth(ty * TILE + 60);
      }
    };
    deco(ISLES.campo, ['01', '02', '03', '07', '08'], 8);
    deco(ISLES.deserto, ['14', '15', '16', '17'], 6);
    deco(ISLES.pedra, ['09', '10', '11'], 6);
    [[13.5, 10], [26.5, 4]].forEach(([x, y]) =>
      this.add.sprite(x * TILE, y * TILE, 'rocks1', 0).setDepth(-86));

    // construções da villa (origin no canto inf-esq; depth pela base p/ sobrepor com o player)
    // gobtower.png = 1024×192 = 4 frames de 256px (NÃO 8 de 128 — os pares ficavam vazios e piscava)
    this.anims.create({ key: 'gobtower-idle', frameRate: 6, repeat: -1,
      frames: this.anims.generateFrameNumbers('bld-gobtower', { start: 0, end: 3 }) });
    for (const [tex, ax, ay, , , frames] of BUILDINGS) {
      const x = ax * TILE, y = (ay + 1) * TILE;
      const img = frames ? this.add.sprite(x, y, 'bld-' + tex).play('gobtower-idle')
                         : this.add.image(x, y, 'bld-' + tex);
      img.setOrigin(0, 1).setDepth(y);
    }

    const walkableBase = (tx, ty) => onLand(tx, ty) && !blocked.has(tx + ',' + ty);
    // versões pixel para o movimento livre
    const walkablePx = (px, py) => walkableBase(Math.floor(px / TILE), Math.floor(py / TILE));
    const walkablePxZone = (zone) => (px, py) => {
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      return walkableBase(tx, ty) && inRect(zone, tx, ty);
    };

    // ------- monstros -------
    const mk = (key, sheet, s, e, rate, rep) => {
      if (!this.anims.exists(key)) this.anims.create({ key, frameRate: rate, repeat: rep,
        frames: this.anims.generateFrameNumbers(sheet, { start: s, end: e }) });
    };
    this.mobs = [];
    this.foes = []; // combatentes do auto-ataque (ovelhas ficam de fora)
    const spawnMob = (nome, texIdle, texWalk, cell, zone, opts = {}) => {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, opts.dy ?? 26, texIdle, 0).setOrigin(0.5, 1).setScale(opts.scale ?? SCALE.mob / 2);
      const lbl = this.add.text(0, opts.ly ?? -48, nome, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#fff',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      cont.add([spr, lbl]);
      mk(texIdle + ':a', texIdle, 0, -1, opts.rate ?? 9, -1);
      if (texWalk) mk(texWalk + ':a', texWalk, 0, opts.walkEnd ?? -1, opts.rate ?? 9, -1);
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: cell[0], ty: cell[1], speed: opts.speed ?? 52, mode: 4,
        walkablePx: walkablePxZone(zone),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(opts.faceRight ? true : false);
          else if (dir.includes('e')) spr.setFlipX(opts.faceRight ? false : true);
          spr.play((st === 'walk' && texWalk ? texWalk : texIdle) + ':a', true);
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, { radius: opts.radius ?? 150 });
      this.mobs.push(wander);
      this.foes.push({ walker, spr, cont, wander, last: 0, lunging: false });
    };
    for (const [nome, path, , , hasWalk, cell] of MOBS) {
      const biome = path.split('/')[0];
      spawnMob(nome, `en-${path}-idle`, hasWalk ? `en-${path}-walk` : null, cell, ISLES[biome]);
    }
    // goblins Tiny Swords (192px, sheets grandes)
    mk('gob-idle', 'goblin', 0, 6, 8, -1); mk('gob-walk', 'goblin', 7, 12, 10, -1);
    mk('tnt-idle', 'tnt', 0, 6, 8, -1); mk('tnt-walk', 'tnt', 7, 12, 10, -1);
    const spawnGoblin = (nome, tex, cell, zone) => {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 36, tex, 0).setOrigin(0.5, 0.85).setScale(SCALE.goblin);
      const lbl = this.add.text(0, -56, nome, { fontFamily: 'sans-serif', fontSize: '12px',
        color: '#ffd76a', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
      cont.add([spr, lbl]);
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: cell[0], ty: cell[1], speed: 58, mode: 4,
        walkablePx: walkablePxZone(zone),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(true);
          else if (dir.includes('e')) spr.setFlipX(false);
          spr.play(tex === 'goblin' ? (st === 'walk' ? 'gob-walk' : 'gob-idle')
                                    : (st === 'walk' ? 'tnt-walk' : 'tnt-idle'), true);
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, { radius: 150 });
      this.mobs.push(wander);
      this.foes.push({ walker, spr, cont, wander, last: 0, lunging: false });
    };
    spawnGoblin('Goblin Tocha', 'goblin', [36, 6], ISLES.pedra);
    spawnGoblin('Goblin TNT', 'tnt', [23, 4], ISLES.deserto);
    // Ogro do Pântano: interpretação original inspirada no Enemy Pack Tiny Swords.
    // Sheets normalizadas em células 192px, com os pés fixos na baseline y=184.
    mk('swamp-ogre-walk', 'swamp-ogre-walk', 0, 5, 10, -1);
    mk('swamp-ogre-attack', 'swamp-ogre-attack', 0, 5, 10, 0);
    {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 34, 'swamp-ogre-idle').setOrigin(0.5, 184 / 192).setScale(0.72);
      const lbl = this.add.text(0, -104, 'Ogro do Pântano', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#d8ff9a',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      cont.add([spr, lbl]);
      let foe = null;
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: 5, ty: 8, speed: 46, mode: 4, radius: 18,
        walkablePx: walkablePxZone(ISLES.campo),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(true);
          else if (dir.includes('e')) spr.setFlipX(false);
          if (foe && foe.attacking) return;
          if (st === 'walk') spr.play('swamp-ogre-walk', true);
          else { spr.anims.stop(); spr.setTexture('swamp-ogre-idle'); }
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, { radius: 135, pauseChance: 0.25 });
      foe = {
        walker, spr, cont, wander, last: 0, lunging: false,
        attackKey: 'swamp-ogre-attack', attacking: false, damage: 6,
      };
      this.mobs.push(wander);
      this.foes.push(foe);
    }
    // Espantalho Amaldiçoado: conjura um corvo sombrio durante o ataque.
    mk('cursed-scarecrow-walk', 'cursed-scarecrow-walk', 0, 5, 9, -1);
    mk('cursed-scarecrow-attack', 'cursed-scarecrow-attack', 0, 4, 9, 0);
    {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 34, 'cursed-scarecrow-idle')
        .setOrigin(0.5, 184 / 192).setScale(0.52);
      const lbl = this.add.text(0, -63, 'Espantalho Amaldiçoado', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#d9b6ff',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      cont.add([spr, lbl]);
      let foe = null;
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: 8, ty: 7, speed: 44, mode: 4, radius: 16,
        walkablePx: walkablePxZone(ISLES.campo),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(true);
          else if (dir.includes('e')) spr.setFlipX(false);
          if (foe && foe.attacking) return;
          if (st === 'walk') spr.play('cursed-scarecrow-walk', true);
          else { spr.anims.stop(); spr.setTexture('cursed-scarecrow-idle'); }
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, {
        radius: 115, pauseChance: 0.4, moveMin: 650, moveMax: 1250,
      });
      foe = {
        walker, spr, cont, wander, last: 0, lunging: false,
        attackKey: 'cursed-scarecrow-attack', attacking: false, damage: 4,
        hp: 48, hpMax: 48, dead: false, isCursedScarecrow: true,
      };
      this.mobs.push(wander);
      this.foes.push(foe);
    }
    // monstros gerados por IA (4 direções reais + walk)
    const spawnAIMob = (nome, base, cell, zone) => {
      for (const [d, r] of Object.entries(ROWS)) {
        mk(base + '-walk-' + d, base + '-walk', r * 6, r * 6 + 5, 10, -1);
      }
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 28, base + '-idle', 2).setOrigin(0.5, 0.95);
      const lbl = this.add.text(0, -70, nome, { fontFamily: 'sans-serif', fontSize: '12px',
        color: '#9fdcff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
      cont.add([spr, lbl]);
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: cell[0], ty: cell[1], speed: 54, mode: 4,
        walkablePx: walkablePxZone(zone),
        setAnim: (st, dir) => {
          if (st === 'walk') spr.play(base + '-walk-' + dir, true);
          else { spr.anims.stop(); spr.setTexture(base + '-idle', ROWS[dir]); }
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, { radius: 165 });
      this.mobs.push(wander);
      this.foes.push({ walker, spr, cont, wander, last: 0, lunging: false });
    };
    spawnAIMob('Yeti ✦IA', 'aiyeti', [43, 6], ISLES.neve);
    spawnAIMob('Golem de Gelo ✦IA', 'aigolem', [47, 9], ISLES.neve);
    spawnAIMob('Lobo Ártico ✦IA', 'aiwolf', [45, 4], ISLES.neve);
    // Chefe montado: arte 192px em vista lateral, espelhada para oeste.
    mk('death-knight-walk', 'death-knight-walk', 0, 5, 10, -1);
    mk('death-knight-attack', 'death-knight-attack', 0, 5, 10, 0);
    {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 34, 'death-knight-idle')
        .setOrigin(0.5, 184 / 192).setScale(0.9);
      const lbl = this.add.text(0, -126, 'Lord Mas', {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: '#b9f6ff', stroke: '#06131a', strokeThickness: 4,
      }).setOrigin(0.5);
      cont.add([spr, lbl]);
      let foe = null;
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: 46, ty: 7, speed: 58, mode: 4, radius: 20,
        walkablePx: walkablePxZone(ISLES.neve),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(true);
          else if (dir.includes('e')) spr.setFlipX(false);
          if (foe && (foe.attacking || foe.dead)) return;
          if (st === 'walk') spr.play('death-knight-walk', true);
          else { spr.anims.stop(); spr.setTexture('death-knight-idle'); }
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, { radius: 150, pauseChance: 0.2 });
      foe = {
        walker, spr, cont, lbl, wander, last: 0, lunging: false,
        attackKey: 'death-knight-attack', attacking: false, damage: 8,
        isDeathKnight: true, hp: 120, hpMax: 120, dead: false,
      };
      walker.foe = foe;
      this.mobs.push(wander);
      this.foes.push(foe);
    }
    // Javali Musgoso: primeiro monstro da nova fauna original do CAMPO.
    // Seis frames por estado, escala fixa e cascos na baseline y=184.
    mk('mossy-boar-walk', 'mossy-boar-walk', 0, 5, 10, -1);
    mk('mossy-boar-attack', 'mossy-boar-attack', 0, 5, 10, 0);
    {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 34, 'mossy-boar-idle')
        .setOrigin(0.5, 184 / 192).setScale(0.72);
      const lbl = this.add.text(0, -76, 'Javali Musgoso', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#e9ff9f',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      cont.add([spr, lbl]);
      let foe = null;
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: 10, ty: 10, speed: 66, mode: 4, radius: 17,
        walkablePx: walkablePxZone(ISLES.campo),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(true);
          else if (dir.includes('e')) spr.setFlipX(false);
          if (foe && foe.attacking) return;
          if (st === 'walk') spr.play('mossy-boar-walk', true);
          else { spr.anims.stop(); spr.setTexture('mossy-boar-idle'); }
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, {
        radius: 145, pauseChance: 0.18, moveMin: 750, moveMax: 1450,
      });
      foe = {
        walker, spr, cont, wander, last: 0, lunging: false,
        attackKey: 'mossy-boar-attack', attacking: false, damage: 5,
        isMossyBoar: true,
      };
      this.mobs.push(wander);
      this.foes.push(foe);
    }
    // Aranha de Trevo: criatura de controle, com teia que reduz movimento.
    mk('clover-spider-walk', 'clover-spider-walk', 0, 5, 10, -1);
    mk('clover-spider-attack', 'clover-spider-attack', 0, 5, 10, 0);
    {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 34, 'clover-spider-idle')
        .setOrigin(0.5, 184 / 192).setScale(0.68);
      const lbl = this.add.text(0, -82, 'Aranha de Trevo', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#dfff7d',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      cont.add([spr, lbl]);
      let foe = null;
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: 3, ty: 5, speed: 52, mode: 4, radius: 16,
        walkablePx: walkablePxZone(ISLES.campo),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(true);
          else if (dir.includes('e')) spr.setFlipX(false);
          if (foe && foe.attacking) return;
          if (st === 'walk') spr.play('clover-spider-walk', true);
          else { spr.anims.stop(); spr.setTexture('clover-spider-idle'); }
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, {
        radius: 125, pauseChance: 0.32, moveMin: 500, moveMax: 1100,
      });
      foe = {
        walker, spr, cont, wander, last: 0, lunging: false,
        attackKey: 'clover-spider-attack', attacking: false, damage: 3,
        hp: 36, hpMax: 36, dead: false, isCloverSpider: true,
      };
      this.mobs.push(wander);
      this.foes.push(foe);
    }
    // Tartaruga do Prado: tanque lento que ataca girando dentro do casco.
    mk('meadow-turtle-walk', 'meadow-turtle-walk', 0, 5, 8, -1);
    mk('meadow-turtle-attack', 'meadow-turtle-attack', 0, 5, 12, 0);
    {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 34, 'meadow-turtle-idle')
        .setOrigin(0.5, 184 / 192).setScale(0.40);
      const lbl = this.add.text(0, -47, 'Tartaruga do Prado', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#e8f5a4',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      cont.add([spr, lbl]);
      let foe = null;
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: 10, ty: 7, speed: 36, mode: 4, radius: 19,
        walkablePx: walkablePxZone(ISLES.campo),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(true);
          else if (dir.includes('e')) spr.setFlipX(false);
          if (foe && foe.attacking) return;
          if (st === 'walk') spr.play('meadow-turtle-walk', true);
          else { spr.anims.stop(); spr.setTexture('meadow-turtle-idle'); }
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, {
        radius: 85, pauseChance: 0.28, moveMin: 800, moveMax: 1450,
      });
      foe = {
        walker, spr, cont, wander, last: 0, lunging: false,
        attackKey: 'meadow-turtle-attack', attacking: false, damage: 7,
        hp: 96, hpMax: 96, dead: false, isMeadowTurtle: true,
      };
      this.mobs.push(wander);
      this.foes.push(foe);
    }
    // Rei Cervo: chefe ancestral do CAMPO, com quatro habilidades e fase enfurecida.
    mk('deer-king-walk', 'deer-king-walk', 0, 5, 9, -1);
    mk('deer-king-walk-enraged', 'deer-king-walk-enraged', 0, 5, 9, -1);
    mk('deer-king-charge', 'deer-king-charge', 0, 5, 11, 0);
    mk('deer-king-charge-enraged', 'deer-king-charge-enraged', 0, 5, 11, 0);
    {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 44, 'deer-king-idle')
        .setOrigin(0.5, 248 / 256).setScale(0.78);
      const lbl = this.add.text(0, -154, 'Rei Cervo — Guardião da Campina', {
        fontFamily: '"Pixelify Sans", sans-serif', fontSize: '15px',
        fontStyle: 'bold', color: '#dfffa2', stroke: '#18310d', strokeThickness: 5,
      }).setOrigin(0.5);
      cont.add([spr, lbl]);
      let foe = null;
      const walker = new FreeWalker(this, cont, {
        tile: TILE, tx: 7, ty: 5, speed: 38, mode: 4, radius: 24,
        walkablePx: walkablePxZone(ISLES.campo),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(true);
          else if (dir.includes('e')) spr.setFlipX(false);
          if (foe && foe.attacking) return;
          if (st === 'walk') spr.play(foe && foe.enraged ? 'deer-king-walk-enraged' : 'deer-king-walk', true);
          else {
            spr.anims.stop();
            spr.setTexture(foe && foe.enraged ? 'deer-king-enraged' : 'deer-king-idle');
          }
          if (foe && foe.enraged) spr.setTint(0xffe5e5);
          else spr.clearTint();
          cont.setDepth(cont.y);
        },
      });
      const wander = new HomeWanderer(this, walker, {
        radius: 70, pauseChance: 0.38, moveMin: 850, moveMax: 1450,
      });
      foe = {
        walker, spr, cont, lbl, wander, last: 0, skillIndex: 0,
        attacking: false, damage: 12, hp: 600, hpMax: 600,
        dead: false, enraged: false, isDeerKing: true, hitRadius: 52,
      };
      this.mobs.push(wander);
      this.foes.push(foe);
    }

    // ------- player paper doll -------
    const P = this.P = { skin: 'lpc', armor: 'leather', weapon: 'longsword', mount: null, dir: 's', attacking: false,
      nome: 'Calney', hp: 100, hpMax: 100, gold: 125, idade: 10,
      energia: 80, energiaMax: 100, xp: 3250, xpMax: 6400, nivel: 5 };
    const doll = this.add.container(0, 0);
    const mkLayer = () => this.add.sprite(0, 24, 'body-walk', 2 * 9).setScale(SCALE.player / 2);
    const layers = this.layers = {
      wb: mkLayer(), body: mkLayer(), feet: mkLayer(), legs: mkLayer(),
      torso: mkLayer(), head: mkLayer(), hair: mkLayer(), wf: mkLayer(),
    };
    // cavalo centrado no frame 64 do boneco: frame 128 → centro em (0, 24 - 32*K + 3)
    const K = SCALE.player; // 1 px da arte original → px de mundo (2x no arquivo × 0.8 no render)
    const mkMount = () => this.add.sprite(0, 24 - 32 * K + 3, 'mt-marrom-standf', 2)
      .setScale(SCALE.player / 2).setVisible(false);
    const mountB = mkMount(), mountF = mkMount();
    // "pezinho do lado de cá" — perna dobrada dedicada (só montarias IA, vistas e/w),
    // desenhada NA FRENTE da montaria e ATRÁS do tronco do cavaleiro
    const legSpr = this.add.sprite(0, 24, 'mount-leg').setOrigin(0.5, 0).setScale(SCALE.player / 2).setVisible(false);
    const aiSpr = this.aiSpr = this.add.sprite(0, 24, 'aihero-idle', 2)
      .setOrigin(0.5, 0.93).setVisible(false);
    doll.add([mountB, legSpr, ...Object.values(layers), aiSpr, mountF]);
    for (const [d, r] of Object.entries(ROWS)) {
      this.anims.create({ key: 'aihero-walk-' + d, frameRate: 11, repeat: -1,
        frames: this.anims.generateFrameNumbers('aihero-walk', { start: r * 6, end: r * 6 + 5 }) });
    }

    const texFor = (layer, anim) => {
      if (layer === 'torso') return `${TORSOS[P.armor]}-${anim}`;
      if (layer === 'wf') return `w-${P.weapon}-${anim}`;
      if (layer === 'wb') return `w-${P.weapon}-${anim}_behind`;
      return `${layer}-${anim}`;
    };
    const applyOrigin = (spr) => {
      const big = spr.frame.width === 384; // sheets de ataque oversized (192→384 no 2x)
      spr.setOrigin(0.5, big ? (0.95 + 1) / 3 : 0.95);
    };
    const ensureAnim = (tex, anim, row) => {
      const key = `${tex}|${row}`;
      if (!this.anims.exists(key)) {
        const cols = COLS[anim];
        this.anims.create({ key, frameRate: anim === 'walk' ? 13 : 15,
          repeat: anim === 'walk' ? -1 : 0,
          frames: this.anims.generateFrameNumbers(tex, {
            start: row * cols + (anim === 'walk' ? 1 : 0),
            end: row * cols + cols - 1 }) });
      }
      return key;
    };
    const toCardinal = (dir) => dir.includes('w') ? 'w' : dir.includes('e') ? 'e' : dir;
    const ensureMountAnim = (tex, row, cols = 4, rate = 11) => {
      const key = `${tex}|${row}`;
      if (!this.anims.exists(key)) {
        this.anims.create({ key, frameRate: rate, repeat: -1,
          frames: this.anims.generateFrameNumbers(tex, { start: row * cols, end: row * cols + cols - 1 }) });
      }
      return key;
    };
    // desloca o cavaleiro pro offset da sela, sincronizado com o frame da montaria
    const applyRide = (cycle, d4, col) => {
      const ai = AI_MOUNTS[P.mount];
      if (ai) {
        const [mx, my] = ai.offs[d4];
        const bob = cycle === 'walk' && ai.bob ? ai.bob[col % ai.bob.length] : 0;
        for (const spr of Object.values(layers)) spr.setPosition(mx * K, 24 + (my + bob) * K);
        // perninha do lado de cá: mesma base fixa + o MESMO bob do tronco (cavalga junto)
        if (legSpr.visible) legSpr.setPosition(
          (d4 === 'w' ? 3 : -3),
          (ai.legY ?? -13) + bob * K
        );
        return;
      }
      const off = RIDE_OFF[cycle][d4];
      const [mx, my] = off[col] || off[0];
      for (const spr of Object.values(layers)) spr.setPosition(mx * K, 24 + my * K);
    };
    mountF.on('animationupdate', (anim, frame) => {
      if (P.mount) applyRide('gallop', toCardinal(P.dir), frame.frame.name % 4);
    });
    mountB.on('animationupdate', (anim, frame) => { // montarias IA animam no mountB
      const ai = AI_MOUNTS[P.mount];
      if (ai) applyRide('walk', toCardinal(P.dir), frame.frame.name % ai.walkCols);
    });
    let ridePose = null; // setAnim roda todo tick — só reposiciona o cavaleiro em mudança de pose
    const renderMounted = (state, d4, row) => {
      const ai = AI_MOUNTS[P.mount];
      const cycle = state === 'walk' ? (ai ? 'walk' : 'gallop') : 'stand';
      if (ai) { // camada única em escala nativa, atrás do cavaleiro
        mountF.setVisible(false);
        const mountRow = ai.singleRow ? 0 : row;
        mountB.setVisible(true).setOrigin(0.5, 0.95).setScale(ai.scale ?? 1).setPosition(0, ai.dy);
        if (ai.singleRow) mountB.setFlipX(d4 === 'w');
        else mountB.setFlipX(false);
        if (cycle === 'walk') mountB.play(ensureMountAnim(`mtai-${P.mount}-walk`, mountRow, ai.walkCols, ai.rate), true);
        else { mountB.anims.stop(); mountB.setTexture(`mtai-${P.mount}-idle`, mountRow); }
      } else {
        for (const [spr, l] of [[mountB, 'b'], [mountF, 'f']]) {
          const tex = `mt-${P.mount}-${cycle}${l}`;
          spr.setVisible(true).setOrigin(0.5, 0.5).setScale(SCALE.player / 2).setPosition(0, 24 - 32 * K + 3);
          if (cycle === 'stand') { spr.anims.stop(); spr.setTexture(tex, row * 4); }
          else spr.play(ensureMountAnim(tex, row), true);
        }
      }
      // cavaleiro: tronco cortado na cintura; ATACA montado (anim de golpe nas camadas
      // de cima, arma sem corte); nas montarias IA a PERNA fica pendurada NA FRENTE
      // (crop invertido da cintura p/ baixo — a "perna do lado de cá")
      const attacking = state === 'attack';
      const anim = attacking ? ATTACK_ANIM[P.weapon] : 'walk';
      // pezinho do lado de cá: perna dobrada dedicada, só montaria IA e vistas laterais
      const showLeg = ai && (d4 === 'e' || d4 === 'w');
      legSpr.setVisible(showLeg);
      if (showLeg) {
        legSpr.setFlipX(d4 === 'w');                 // asset vira leste; espelha p/ oeste
        legSpr.setScale(0.6);                         // perna de montaria dobrada
        doll.bringToTop(legSpr);                      // container ignora setDepth: reordena p/ frente
        // posição (x,y) + bob de cavalgada são aplicados por applyRide (sincroniza com o tronco)
      }
      for (const [name, spr] of Object.entries(layers)) {
        const isWeapon = name === 'wb' || name === 'wf';
        if (name === 'legs' || name === 'feet') { spr.setVisible(false); continue; } // a perna dedicada substitui
        const tex = texFor(name, anim);
        if ((isWeapon && !attacking) || !this.textures.exists(tex)) { spr.setVisible(false); continue; }
        spr.setVisible(true);
        if (attacking) {
          spr.play(ensureAnim(tex, anim, row), true);
          applyOrigin(spr);
          if (isWeapon) spr.setCrop();               // arco da arma completo
          else spr.setCrop(0, 0, spr.frame.width, Math.round(spr.frame.height * 0.78));
        } else {
          spr.anims.stop();
          spr.setTexture(tex, row * COLS.walk);
          spr.setOrigin(0.5, 0.95);
          spr.setCrop(0, 0, 128, 100);
        }
      }
      const pose = P.mount + '|' + cycle + '|' + d4 + (attacking ? '|atk' : '');
      if (ridePose !== pose) { ridePose = pose; applyRide(cycle, d4, 0); }
    };
    const setDoll = this.setDoll = (state, dir) => {
      P.dir = dir;
      const d4 = toCardinal(dir);
      const row = ROWS[d4];
      if (this.ovName) this.ovName.setY(P.mount && P.skin !== 'ai' ? -84 : -52); // montado = mais alto
      if (P.skin === 'ai') {
        Object.values(layers).forEach(l => l.setVisible(false));
        aiSpr.setVisible(true);
        if (state === 'walk') aiSpr.play('aihero-walk-' + d4, true);
        else { aiSpr.anims.stop(); aiSpr.setTexture('aihero-idle', row); }
        doll.setDepth(doll.y);
        return;
      }
      aiSpr.setVisible(false);
      if (P.mount) {
        renderMounted(state, d4, row);
        doll.setDepth(doll.y);
        return;
      }
      const anim = state === 'attack' ? ATTACK_ANIM[P.weapon] : 'walk';
      for (const [name, spr] of Object.entries(layers)) {
        const tex = texFor(name, anim);
        if (!this.textures.exists(tex)) { spr.setVisible(false); continue; }
        spr.setVisible(true);
        if (state === 'idle') {
          spr.anims.stop();
          spr.setTexture(tex, row * COLS[anim]);
        } else {
          spr.play(ensureAnim(tex, anim, row), true);
        }
        applyOrigin(spr);
      }
      doll.setDepth(doll.y);
    };

    this.player = new FreeWalker(this, doll, {
      tile: TILE, tx: SPAWN.x, ty: SPAWN.y, speed: 165, mode: 8, radius: 12,
      walkablePx,
      setAnim: (st, dir) => { if (!P.attacking) setDoll(st, dir); },
    });

    // ------- FX / skills de arma (docs/SKILLS-VFX.md) -------
    // Tudo greyscale/branco tintado em runtime → escala p/ qualquer arma/skin/montaria.
    const DIR_ANG = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
    const WEAPON_FX = {
      longsword: { tint: 0xcfe8ff, heavy: false },
      dagger: { tint: 0xb0ffb8, heavy: false },
      mace: { tint: 0xffd27a, heavy: true },
      waraxe: { tint: 0xffa96b, heavy: true },
      spear: { tint: 0xe2d0ff, heavy: false, lunge: true },
      lord_mas_lance: { tint: 0x62ffd2, heavy: false, lunge: true },
    };
    const ELEMENTS = { none: null,
      fogo: { tint: 0xff7a2a, p: 'fx-p-fire' },
      raio: { tint: 0xffe95c, p: 'fx-p-spark' },
      gelo: { tint: 0x9adcff, p: 'fx-p-ice' } };
    P.element = 'none';
    const fxTint = () => ELEMENTS[P.element] ? ELEMENTS[P.element].tint : (WEAPON_FX[P.weapon] || { tint: 0xffffff }).tint;
    const burst = (tex, x, y, tint, n = 10) => {
      const em = this.add.particles(x, y, tex, {
        speed: { min: 30, max: 110 }, lifespan: 380, blendMode: 'NORMAL', tint,
        scale: { start: 0.8, end: 0 }, emitting: false,
      }).setDepth(doll.y + 41);
      em.explode(n);
      this.time.delayedCall(700, () => em.destroy());
    };

    // 1) Corte Cromático: arco tintado na direção do golpe (lança usa o lunge)
    let swingFlip = false;
    const slashArc = () => {
      const ang = Phaser.Math.DegToRad(DIR_ANG[P.dir] ?? 90);
      const wfx = WEAPON_FX[P.weapon] || {};
      const lordMasLance = P.weapon === 'lord_mas_lance';
      const attackTint = lordMasLance ? 0x79ffe6 : fxTint();
      const dx = Math.cos(ang), dy = Math.sin(ang);
      swingFlip = !swingFlip;
      // 2 camadas: NORMAL segura a leitura em fundo claro (neve!), ADD dá o glow
      const tex = wfx.lunge ? 'fx-lunge' : 'fx-slash';
      const mk = (blend, alpha, scl, tint = attackTint) => this.add.image(doll.x + dx * 26, doll.y - 14 + dy * 26, tex)
        .setRotation(ang).setFlipY(swingFlip).setBlendMode(blend)
        .setTint(tint).setAlpha(alpha).setScale(scl).setDepth(doll.y + 40);
      const base = mk(Phaser.BlendModes.NORMAL, 0.9, 0.55);
      const glow = mk(Phaser.BlendModes.ADD, 0.6, 0.62);
      const core = lordMasLance ? mk(Phaser.BlendModes.ADD, 1, 0.38, 0xffffff) : null;
      const outer = lordMasLance ? mk(Phaser.BlendModes.ADD, 0.42, 0.78, 0x42ffc8) : null;
      const fxLayers = [base, glow, core, outer].filter(Boolean);
      this.tweens.add({ targets: fxLayers, scale: lordMasLance ? 1.08 : (wfx.lunge ? 0.9 : 1.05), alpha: 0,
        duration: lordMasLance ? 310 : 190, ease: 'Cubic.easeOut',
        onComplete: () => fxLayers.forEach(layer => layer.destroy()) });
      if (lordMasLance) {
        const weaponLayers = [layers.wb, layers.wf].filter(layer => layer.visible);
        weaponLayers.forEach(layer => layer.setBlendMode(Phaser.BlendModes.ADD).setTint(0xbaffea));
        this.tweens.add({
          targets: weaponLayers, alpha: 0.45, duration: 55, yoyo: true, repeat: 2,
          onComplete: () => weaponLayers.forEach(layer =>
            layer.setAlpha(1).clearTint().setBlendMode(Phaser.BlendModes.NORMAL)),
        });
        for (let i = 1; i <= 4; i++) {
          this.time.delayedCall(i * 28, () =>
            burst('fx-p-spark', doll.x + dx * (22 + i * 13), doll.y - 12 + dy * (22 + i * 13),
              i % 2 ? 0x79ffe6 : 0xffffff, 4));
        }
      }
      const el = ELEMENTS[P.element];
      if (el) burst(el.p, doll.x + dx * 34, doll.y - 10 + dy * 34, el.tint, 10);
    };

    // 2) Rastro Espectral: silhueta congelada do doll (camadas visíveis, crop incluso)
    const ghost = (tint = 0x7ad8ff) => {
      const g = this.add.container(doll.x, doll.y).setDepth(doll.y - 1).setAlpha(0.4);
      doll.iterate(ch => {
        // camadas com crop (cavaleiro cortado na cintura) ficam de fora: setCrop
        // clonado não se comporta no Phaser 4 — montado, o fantasma é o cavalo
        if (!ch.visible || !ch.texture || !ch.frame || ch.isCropped) return;
        if (!(ch instanceof Phaser.GameObjects.Sprite) && !(ch instanceof Phaser.GameObjects.Image)) return;
        const c = this.add.image(ch.x, ch.y, ch.texture.key, ch.frame.name)
          .setOrigin(ch.originX, ch.originY).setScale(ch.scaleX, ch.scaleY).setFlip(ch.flipX, ch.flipY);
        c.setTint(tint).setTintMode(Phaser.TintModes.FILL);
        g.add(c);
      });
      this.tweens.add({ targets: g, alpha: 0, duration: 280, onComplete: () => g.destroy() });
    };
    this.fxGhost = ghost;

    // 3) Lâmina Elemental: [E] cicla nenhum→fogo→raio→gelo; aura + burst no golpe
    let aura = null;
    const setElement = (el) => {
      P.element = el;
      if (aura) { aura.destroy(); aura = null; }
      const cfg = ELEMENTS[el];
      if (cfg) {
        aura = this.add.particles(0, 0, cfg.p, {
          speed: { min: 5, max: 25 }, lifespan: 500, frequency: 110, quantity: 1,
          scale: { start: 0.45, end: 0 }, alpha: { start: 0.8, end: 0 },
          blendMode: 'NORMAL', tint: cfg.tint,
        }).setDepth(4000);
        aura.startFollow(doll, 0, 4);
      }
      skillTxt();
    };

    // 4) Onda de Impacto: armas pesadas socam o chão — anel + poeira + shake + knockback
    const shockwave = () => {
      const tint = fxTint();
      const ring = this.add.image(doll.x, doll.y + 6, 'fx-ring').setBlendMode(Phaser.BlendModes.NORMAL)
        .setTint(tint).setAlpha(0.85).setScale(0.3, 0.17).setDepth(doll.y + 39);
      this.tweens.add({ targets: ring, scaleX: 1.5, scaleY: 0.85, alpha: 0,
        duration: 340, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
      burst('fx-p-dust', doll.x, doll.y + 8, 0xcbb489, 8);
      this.cameras.main.shake(110, 0.004);
      for (const f of this.foes) {
        const dx = f.walker.x - this.player.x, dy = f.walker.y - this.player.y;
        const d = Math.hypot(dx, dy);
        if (!d || d > COMBAT.range * 2.4) continue;
        const nx = dx / d, ny = dy / d;
        const tx = Math.floor((f.walker.x + nx * 30) / TILE), ty = Math.floor((f.walker.y + ny * 30) / TILE);
        if (walkableBase(tx, ty)) {
          f.walker.x += nx * 30; f.walker.y += ny * 30;
          f.walker.sprite.setPosition(Math.round(f.walker.x), Math.round(f.walker.y));
        }
        f.spr.setTint(0xffd27a);
        this.time.delayedCall(150, () => f.spr.clearTint());
      }
    };

    // 5) Tempestade de Lâminas: [R] giro 360° — anel + orbitais + arma girando (frame
    //    idle de QUALQUER sheet de arma), hits em área a cada ~250ms, cooldown 5s
    let wwCd = 0;
    const wwHit = () => {
      for (const f of this.foes) {
        const d = Math.hypot(f.walker.x - this.player.x, f.walker.y - this.player.y);
        if (d > COMBAT.range * 1.9) continue;
        f.spr.setTint(0xff7070);
        this.time.delayedCall(120, () => f.spr.clearTint());
      }
    };
    const whirlwind = () => {
      const now = this.time.now;
      if (now < wwCd || P.skin === 'ai') return;
      wwCd = now + 5000;
      const tint = fxTint();
      const c = this.add.container(doll.x, doll.y - 10);
      const ring = this.add.image(0, 0, 'fx-ring').setBlendMode(Phaser.BlendModes.NORMAL)
        .setTint(tint).setAlpha(0.75).setScale(0.9, 0.6);
      const wtex = `w-${P.weapon}-walk`;
      const wep = this.textures.exists(wtex)
        ? this.add.image(0, -6, wtex, 2 * 9).setScale(SCALE.player / 2) : null;
      const orbs = [0, 1, 2].map(() =>
        this.add.image(0, 0, 'fx-orb').setBlendMode(Phaser.BlendModes.NORMAL).setTint(tint).setAlpha(0.9));
      c.add([ring, ...(wep ? [wep] : []), ...orbs]);
      let hitT = 0;
      this.tweens.addCounter({ from: 0, to: 1, duration: 900,
        onUpdate: (t) => {
          const v = t.getValue(), a = v * Math.PI * 4;
          c.setPosition(doll.x, doll.y - 10).setDepth(doll.y + 42);
          ring.setRotation(a);
          if (wep) wep.setRotation(a * 1.5);
          orbs.forEach((o, i) => {
            const oa = a + i * Math.PI * 2 / 3;
            o.setPosition(Math.cos(oa) * 46, Math.sin(oa) * 30).setRotation(oa + Math.PI / 2);
          });
          if (v >= hitT) { hitT += 0.28; wwHit(); }
        },
        onComplete: () => c.destroy() });
      ghost(tint); this.time.delayedCall(300, () => ghost(tint)); this.time.delayedCall(600, () => ghost(tint));
    };

    // teclas extras + legenda das skills
    const fxKeys = this.input.keyboard.addKeys('e,r');
    const EL_ORDER = ['none', 'fogo', 'raio', 'gelo'];
    fxKeys.e.on('down', () => setElement(EL_ORDER[(EL_ORDER.indexOf(P.element) + 1) % EL_ORDER.length]));
    fxKeys.r.on('down', () => whirlwind());
    const skillHint = this.add.text(this.scale.width / 2, this.scale.height - 8, '', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#fff', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(5000).setAlpha(0.8);
    const skillTxt = () => skillHint.setText(`[E] elemento: ${P.element} · [R] tempestade de lâminas`);
    skillTxt();

    const attack = () => {
      if (P.attacking) return;
      const wfx = WEAPON_FX[P.weapon] || {};
      if (P.skin === 'ai') {
        // herói IA não tem anim de ataque — investida rápida como feedback
        P.attacking = true;
        this.time.delayedCall(40, slashArc);
        this.tweens.add({ targets: aiSpr, scaleX: 1.18, scaleY: 0.92,
          duration: 90, yoyo: true, onComplete: () => { P.attacking = false; } });
        return;
      }
      // a pé OU montado: golpe real do paper doll (montado, renderMounted anima o tronco+arma)
      P.attacking = true;
      setDoll('attack', P.dir);
      this.time.delayedCall(110, slashArc);
      this.time.delayedCall(60, () => ghost(fxTint()));
      if (wfx.heavy) this.time.delayedCall(200, shockwave);
      layers.body.once('animationcomplete', () => {
        P.attacking = false;
        setDoll('idle', P.dir);
      });
    };

    const setMount = (m) => {
      P.mount = m;
      ridePose = null;
      this.player.speed = m ? (AI_MOUNTS[m] ? AI_MOUNTS[m].speed : 260) : 165; // galope/trote
      this.player.radius = m ? 16 : 12;
      if (!m) {
        mountB.setVisible(false); mountF.setVisible(false);
        for (const spr of Object.values(layers)) { spr.setCrop(); spr.setPosition(0, 24); }
      }
    };
    window.__equip = (kind, id) => {
      if (kind === 'weapon') P.weapon = id;
      else if (kind === 'armor') P.armor = id;
      else if (kind === 'skin') {
        P.skin = id.replace('skin_', '');
        if (P.skin === 'ai' && P.mount) { // herói IA não cavalga os frames LPC
          setMount(null);
          window.__markEquipped && window.__markEquipped('mount', 'none');
        }
      } else if (kind === 'mount') {
        if (id !== 'none' && P.skin === 'ai') {
          P.skin = 'lpc';
          window.__markEquipped && window.__markEquipped('skin', 'skin_lpc');
        }
        setMount(id === 'none' ? null : id);
      }
      if (!P.attacking) setDoll(this.player.moving ? 'walk' : 'idle', P.dir);
      if ((kind === 'skin' || kind === 'armor') && this.__refreshPortrait) this.__refreshPortrait();
      window.__markEquipped && window.__markEquipped(kind, id);
    };
    if (window.__markEquipped) {
      window.__markEquipped('weapon', P.weapon);
      window.__markEquipped('armor', P.armor);
      window.__markEquipped('skin', 'skin_' + P.skin);
      window.__markEquipped('mount', 'none');
    }

    const cam = this.cameras.main;
    cam.setBounds(X0, 0, FULLW, H);
    cam.startFollow(doll, true, 0.15, 0.15);

    // ------- overhead do player: só o nome (barra de HP fica no HUD do canto) -------
    // Pixelify Sans: pixel PORÉM legível, no nível do título dos biomas ("CAMPO").
    const ovName = this.add.text(0, -52, P.nome, {
      fontFamily: '"Pixelify Sans", sans-serif', fontSize: '16px', fontStyle: '700',
      color: '#ffe08a', stroke: '#000', strokeThickness: 4,
    }).setOrigin(0.5);
    doll.add([ovName]);
    this.ovName = ovName;

    // — retrato do herói: recorta o busto do frame parado-sul das camadas do paper doll —
    const buildPortrait = () => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 64;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      // fundo transparente: a moldura de retrato (Tiny Swords) já tem o interior azul
      if (P.skin === 'ai') {
        ctx.drawImage(this.textures.get('aihero-idle').getSourceImage(), 20, 14, 60, 60, 0, 0, 64, 64);
      } else {
        const sy = 2 * 128, cx = 34, cy = 16;        // frame 128, linha sul (parado), busto
        for (const c of ['body', 'legs', TORSOS[P.armor], 'head', 'hair']) {
          const key = c + '-walk';
          if (!this.textures.exists(key)) continue;
          ctx.drawImage(this.textures.get(key).getSourceImage(), cx, sy + cy, 58, 58, 0, 0, 64, 64);
        }
      }
      return cv.toDataURL();
    };
    let portrait = buildPortrait();
    this.__refreshPortrait = () => { portrait = buildPortrait(); window.__hudRefresh(); };

    // — API de troca + refresh (HUD é 100% React no DOM) —
    this.huds = {};
    window.__hudData = () => ({
      nome: P.nome, hp: P.hp, hpMax: P.hpMax, energia: P.energia, energiaMax: P.energiaMax,
      xp: P.xp, xpMax: P.xpMax, nivel: P.nivel, gold: P.gold, idade: P.idade, portrait,
    });
    window.__hudRefresh = () => { window.dispatchEvent(new CustomEvent('hudchange')); };
    this.setHp = (v) => {
      P.hp = Math.max(0, Math.min(P.hpMax, Math.round(v)));
      window.__hudRefresh();
    };
    this.time.addEvent({ delay: 1000, loop: true, callback: () => { // regen lenta
      if (P.hp < P.hpMax) this.setHp(P.hp + 2);
    } });
    const qs = new URLSearchParams(location.search); // ?hp=NN sobrescreve (QA)
    if (qs.get('hp')) this.setHp(parseInt(qs.get('hp'), 10));
    window.__hudRefresh();

    this.keys = makeKeys(this);
    this.joy = new Joystick(this);
    new ActionButton(this, 'atk', attack);
    this.keys.space.on('down', attack);

    // --- ganchos do combate automático ---
    this.autoAttack = attack;
    this.lastPlayerAtk = 0;
    this.flashDoll = () => { // player levou golpe
      doll.iterate(c => c.setTint && c.setTint(0xff7070));
      this.time.delayedCall(130, () => doll.iterate(c => c.clearTint && c.clearTint()));
    };
    const announceReward = (text, color = '#b9f6ff') => {
      const msg = this.add.text(this.scale.width / 2, 90, text, {
        fontFamily: '"Pixelify Sans", sans-serif', fontSize: '22px', fontStyle: 'bold',
        color, align: 'center', stroke: '#06131a', strokeThickness: 6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(9000).setAlpha(0);
      this.tweens.add({ targets: msg, alpha: 1, y: 78, duration: 220, hold: 2200,
        yoyo: true, onComplete: () => msg.destroy() });
    };
    this.cloverBuffText = this.add.text(this.scale.width - 20, 104, '', {
      fontFamily: '"Pixelify Sans", sans-serif', fontSize: '17px', fontStyle: 'bold',
      color: '#dfff7d', stroke: '#15320b', strokeThickness: 5,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(8500).setVisible(false);
    this.dropChanceMultiplier = () =>
      this.time.now < (P.cloverBuffUntil || 0) ? 1.30 : 1;
    this.rollDrop = (baseChance) =>
      Math.random() < Math.min(1, baseChance * this.dropChanceMultiplier());
    this.grantCloverBuff = () => {
      P.cloverBuffUntil = this.time.now + 180000;
      announceReward('BUFF ATIVO!\nSorte do Trevo · +30% de drop · 3 min', '#dfff7d');
      const cx = this.scale.width / 2, cy = this.scale.height / 2;
      for (let i = 0; i < 18; i++) {
        const angle = Math.PI * 2 * i / 18;
        const spark = this.add.image(cx, cy, i % 3 === 0 ? 'fx-orb' : 'fx-p-spark')
          .setScrollFactor(0).setDepth(8994).setBlendMode(Phaser.BlendModes.ADD)
          .setTint(i % 3 === 0 ? 0xf1ff85 : 0x66e339).setScale(0.35 + Math.random() * 0.25);
        this.tweens.add({
          targets: spark,
          x: cx + Math.cos(angle) * (80 + Math.random() * 90),
          y: cy + Math.sin(angle) * (55 + Math.random() * 65),
          angle: 180, alpha: 0, scale: 0, duration: 850 + Math.random() * 300,
          ease: 'Cubic.easeOut', onComplete: () => spark.destroy(),
        });
      }
    };
    const celebrateMountDrop = (reward) => {
      const golden = reward === 'skeletal_horse_gold' || reward === 'spring_deer';
      const cx = this.scale.width / 2, cy = this.scale.height / 2;
      const tint = golden ? 0xff4b18 : 0x79e8ff;
      const flash = this.add.rectangle(cx, cy, this.scale.width, this.scale.height,
        golden ? 0xffc928 : 0x9befff, golden ? 0.34 : 0.18)
        .setScrollFactor(0).setDepth(8990);
      this.tweens.add({ targets: flash, alpha: 0, duration: golden ? 800 : 480,
        onComplete: () => flash.destroy() });

      const ringCount = golden ? 3 : 2;
      for (let i = 0; i < ringCount; i++) {
        const ring = this.add.image(cx, cy + 36, 'fx-ring').setScrollFactor(0).setDepth(8992)
          .setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95).setScale(0.25);
        this.tweens.add({ targets: ring, scale: 2.2 + i * 0.55, alpha: 0,
          delay: i * 130, duration: golden ? 950 : 720, ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy() });
      }

      const halo = this.add.image(cx, cy + 2, 'fx-orb')
        .setScrollFactor(0).setDepth(8993).setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD).setScale(golden ? 3.4 : 2.8).setAlpha(0);
      this.tweens.add({
        targets: halo, alpha: { from: 0, to: golden ? 0.72 : 0.55 },
        scale: golden ? 4.2 : 3.5, duration: 520, ease: 'Sine.easeOut',
        yoyo: true, repeat: golden ? 4 : 3,
        onComplete: () => halo.destroy(),
      });
      const aura = this.add.image(cx, cy + 2, 'fx-ring')
        .setScrollFactor(0).setDepth(8994).setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD).setScale(golden ? 1.45 : 1.15).setAlpha(0);
      this.tweens.add({
        targets: aura, alpha: { from: 0, to: 0.95 }, angle: golden ? 270 : 180,
        scale: golden ? 1.8 : 1.45, duration: golden ? 900 : 1100,
        ease: 'Sine.easeInOut', yoyo: true, repeat: golden ? 2 : 1,
        onComplete: () => aura.destroy(),
      });

      const preview = this.add.image(cx, cy + 20, `mtai-${reward}-idle`)
        .setScrollFactor(0).setDepth(8995).setOrigin(0.5, 0.95)
        .setScale(0.15).setAlpha(0);
      this.tweens.add({ targets: preview, alpha: 1, scale: golden ? 0.72 : 0.62,
        y: cy - 2, duration: golden ? 700 : 520, ease: 'Back.easeOut',
        hold: golden ? 2600 : 1900, yoyo: true, onComplete: () => preview.destroy() });

      const sparks = golden ? 42 : 24;
      for (let i = 0; i < sparks; i++) {
        const angle = (Math.PI * 2 * i / sparks) + Math.random() * 0.2;
        const radius = golden ? 150 + Math.random() * 150 : 110 + Math.random() * 100;
        const sparkTex = golden ? 'fx-p-fire' : (i % 4 === 0 ? 'fx-orb' : 'fx-p-spark');
        const spark = this.add.image(cx, cy + 10, sparkTex)
          .setScrollFactor(0).setDepth(8994).setTint(tint)
          .setBlendMode(Phaser.BlendModes.ADD).setScale(golden ? 0.7 : 0.5).setAlpha(0);
        this.tweens.add({ targets: spark, alpha: { from: 0, to: 1 },
          x: cx + Math.cos(angle) * radius, y: cy + 10 + Math.sin(angle) * radius * 0.65,
          scale: 0, rotation: Math.random() * Math.PI * 3, delay: Math.random() * 260,
          duration: golden ? 1100 : 820, ease: 'Cubic.easeOut', onComplete: () => spark.destroy() });
      }
      if (golden) {
        for (let i = 0; i < 18; i++) {
          const flame = this.add.image(cx - 68 + Math.random() * 136, cy + 34, 'fx-p-fire')
            .setScrollFactor(0).setDepth(8996).setBlendMode(Phaser.BlendModes.ADD)
            .setTint(i % 3 === 0 ? 0xffd34a : 0xff431c).setAlpha(0).setScale(0.45 + Math.random() * 0.4);
          this.tweens.add({
            targets: flame, alpha: { from: 0, to: 0.95 },
            x: flame.x + (Math.random() - 0.5) * 34,
            y: cy - 55 - Math.random() * 85, scale: 0,
            delay: Math.random() * 900, duration: 700 + Math.random() * 450,
            repeat: 1, ease: 'Sine.easeOut', onComplete: () => flame.destroy(),
          });
        }
        const legendary = this.add.text(cx, cy - 138, '✦  LENDÁRIO  ✦', {
          fontFamily: '"Pixelify Sans", sans-serif', fontSize: '34px', fontStyle: 'bold',
          color: '#fff2a8', stroke: '#6b3300', strokeThickness: 8,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(8998).setScale(0.35).setAlpha(0);
        this.tweens.add({ targets: legendary, alpha: 1, scale: 1, duration: 520,
          ease: 'Back.easeOut', hold: 2500, yoyo: true, onComplete: () => legendary.destroy() });
        this.cameras.main.shake(360, 0.008);
      } else {
        this.cameras.main.shake(180, 0.004);
      }
    };
    const celebrateWeaponDrop = () => {
      const cx = this.scale.width / 2, cy = this.scale.height / 2;
      const tint = 0x62ffd2;
      const halo = this.add.image(cx, cy, 'fx-orb').setScrollFactor(0).setDepth(8992)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0).setScale(0.4);
      const ring = this.add.image(cx, cy, 'fx-ring').setScrollFactor(0).setDepth(8993)
        .setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setAlpha(0.9).setScale(0.25);
      const icon = this.add.image(cx, cy, 'lord-mas-lance-icon').setScrollFactor(0).setDepth(8995)
        .setScale(0.25).setAlpha(0).setAngle(-35);
      this.tweens.add({ targets: halo, alpha: 0.7, scale: 3.2, duration: 520,
        yoyo: true, repeat: 3, onComplete: () => halo.destroy() });
      this.tweens.add({ targets: ring, alpha: 0, scale: 2.3, angle: 220,
        duration: 1200, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
      this.tweens.add({ targets: icon, alpha: 1, scale: 1.1, angle: -18,
        duration: 620, ease: 'Back.easeOut', hold: 2100, yoyo: true,
        onComplete: () => icon.destroy() });
      for (let i = 0; i < 24; i++) {
        const angle = Math.PI * 2 * i / 24;
        const spark = this.add.image(cx, cy, 'fx-p-spark').setScrollFactor(0).setDepth(8994)
          .setBlendMode(Phaser.BlendModes.ADD).setTint(i % 3 ? tint : 0xc8fff1).setScale(0.5);
        this.tweens.add({
          targets: spark, x: cx + Math.cos(angle) * (100 + Math.random() * 90),
          y: cy + Math.sin(angle) * (65 + Math.random() * 70),
          alpha: 0, scale: 0, delay: Math.random() * 180, duration: 850,
          ease: 'Cubic.easeOut', onComplete: () => spark.destroy(),
        });
      }
      announceReward('ARMA RARA!\\nLança de Lord Mas · 0,5%', '#8affda');
      this.cameras.main.shake(220, 0.005);
    };
    const showBossSkill = (f, text, color = '#dfff9a') => {
      const tag = this.add.text(f.cont.x, f.cont.y - 178, text, {
        fontFamily: '"Pixelify Sans", sans-serif', fontSize: '16px',
        fontStyle: 'bold', color, stroke: '#10230b', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(9000);
      this.tweens.add({ targets: tag, y: tag.y - 18, alpha: 0,
        duration: 1050, ease: 'Cubic.easeOut', onComplete: () => tag.destroy() });
    };
    const bossHitPlayer = (damage, shake = 0.004) => {
      this.flashDoll();
      this.setHp(P.hp - damage);
      this.cameras.main.shake(180, shake);
    };
    this.deerKingAttack = (f) => {
      if (!f || f.dead || f.attacking) return;
      f.attacking = true;
      f.walker.__dead = true;
      const skill = f.skillIndex++ % 4;
      const rageSpeed = f.enraged ? 0.72 : 1;
      const finish = (delay = 950) => this.time.delayedCall(delay * rageSpeed, () => {
        if (f.dead) return;
        f.attacking = false;
        f.walker.__dead = false;
        f.spr.clearTint();
        f.walker.setAnim('idle', dirBetween(f.walker, this.player));
      });

      if (skill === 0) {
        showBossSkill(f, 'INVESTIDA REAL');
        f.spr.play(f.enraged ? 'deer-king-charge-enraged' : 'deer-king-charge', true);
        const dx = this.player.x - f.cont.x, dy = this.player.y - f.cont.y;
        const len = Math.hypot(dx, dy) || 1;
        const distance = Math.min(150, Math.max(50, len - 24));
        const tx = f.cont.x + dx / len * distance;
        const ty = f.cont.y + dy / len * distance;
        for (let i = 1; i <= 9; i++) {
          this.time.delayedCall(i * 55 * rageSpeed, () => {
            if (f.dead) return;
            const leaf = this.add.image(f.cont.x - dx / len * 20, f.cont.y + 8, 'fx-p-spark')
              .setTint(i % 3 ? 0x7ed957 : 0xd8f27a).setBlendMode(Phaser.BlendModes.ADD)
              .setScale(0.42).setDepth(f.cont.y + 2);
            this.tweens.add({ targets: leaf, x: leaf.x + (Math.random() - 0.5) * 45,
              y: leaf.y - 20 - Math.random() * 25, angle: 180, alpha: 0,
              duration: 520, onComplete: () => leaf.destroy() });
          });
        }
        this.tweens.add({ targets: f.cont, x: tx, y: ty, duration: 520 * rageSpeed,
          ease: 'Cubic.easeIn', onComplete: () => {
            if (Math.hypot(f.cont.x - this.player.x, f.cont.y - this.player.y) < 62) {
              bossHitPlayer(f.enraged ? 18 : 14, 0.007);
            }
          } });
        finish(760);
      } else if (skill === 1) {
        showBossSkill(f, 'RAÍZES ANCESTRAIS');
        const dx = this.player.x - f.cont.x, dy = this.player.y - f.cont.y;
        const len = Math.hypot(dx, dy) || 1;
        for (let i = 1; i <= 4; i++) {
          const rx = f.cont.x + dx / len * i * 48;
          const ry = f.cont.y + dy / len * i * 48;
          this.time.delayedCall(i * 170 * rageSpeed, () => {
            const root = this.add.image(rx, ry, 'fx-ring').setTint(0x6f9e3d)
              .setBlendMode(Phaser.BlendModes.ADD).setScale(0.18, 0.09).setDepth(ry + 1);
            this.tweens.add({ targets: root, scaleX: 0.72, scaleY: 0.34, alpha: 0,
              duration: 620, ease: 'Back.easeOut', onComplete: () => root.destroy() });
            if (Math.hypot(rx - this.player.x, ry - this.player.y) < 42) {
              bossHitPlayer(f.enraged ? 13 : 10);
            }
          });
        }
        finish(1050);
      } else {
        const doubleVolley = skill === 3;
        showBossSkill(f, doubleVolley ? 'GALHADA DUPLA' : 'CHUVA DE ESPINHOS', '#f4e89c');
        const count = f.enraged ? 16 : 12;
        const volleys = doubleVolley ? 2 : 1;
        for (let wave = 0; wave < volleys; wave++) {
          this.time.delayedCall(wave * 310 * rageSpeed, () => {
            if (f.dead) return;
            for (let i = 0; i < count; i++) {
              const angle = Math.PI * 2 * (i + wave * 0.5) / count;
              const thorn = this.add.image(f.cont.x, f.cont.y - 35, 'fx-p-spark')
                .setTint(f.enraged ? 0xff6b4a : 0xcab56a).setScale(0.55)
                .setDepth(f.cont.y + 10);
              this.tweens.add({ targets: thorn,
                x: thorn.x + Math.cos(angle) * 185, y: thorn.y + Math.sin(angle) * 145,
                angle: 270, alpha: 0, duration: 720 * rageSpeed,
                ease: 'Cubic.easeOut', onComplete: () => thorn.destroy() });
            }
            if (Math.hypot(f.cont.x - this.player.x, f.cont.y - this.player.y) < 175) {
              this.time.delayedCall(330 * rageSpeed, () => {
                if (!f.dead) bossHitPlayer(f.enraged ? 14 : 11);
              });
            }
          });
        }
        finish(doubleVolley ? 1250 : 850);
      }
    };
    const unlockDeerReward = (id, label, color) => {
      const key = 'deerKingRewards';
      let rewards = [];
      try { rewards = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
      if (!rewards.includes(id)) rewards.push(id);
      localStorage.setItem(key, JSON.stringify(rewards));
      announceReward(`RECOMPENSA DO REI CERVO!\n${label}`, color);
    };
    this.defeatFoe = (f) => {
      if (!f || f.dead) return;
      f.dead = true;
      f.attacking = false;
      f.walker.__dead = true;
      f.cont.setVisible(false);

      if (f.isDeerKing) {
        if (this.rollDrop(0.05)) unlockDeerReward('deer_king_antler', 'Galhada do Rei Cervo · 5%', '#dfffa2');
        if (this.rollDrop(0.03)) unlockDeerReward('meadow_cape', 'Capa da Campina · 3%', '#b9f69f');
        const forcedDeerDrop = new URLSearchParams(window.location.search).get('forceDeerDrop');
        if (forcedDeerDrop === 'ancestral_deer' || (!forcedDeerDrop && this.rollDrop(0.01))) {
          window.__unlockMount && window.__unlockMount('ancestral_deer');
          celebrateMountDrop('ancestral_deer');
          unlockDeerReward('ancestral_deer', 'Montaria Rei Cervo · 1%', '#b9f6ff');
        }
        if (forcedDeerDrop === 'spring_deer' || (!forcedDeerDrop && this.rollDrop(0.001))) {
          window.__unlockMount && window.__unlockMount('spring_deer');
          celebrateMountDrop('spring_deer');
          unlockDeerReward('spring_deer', 'Montaria Rei Cervo Enfurecido · 0,1%', '#ff745c');
        }
        this.time.delayedCall(15000, () => {
          f.hp = f.hpMax;
          f.dead = false;
          f.enraged = false;
          f.skillIndex = 0;
          f.walker.__dead = false;
          f.cont.setVisible(true);
          f.spr.clearTint().setTexture('deer-king-idle');
          f.walker.setAnim('idle', 'e');
        });
        return;
      }

      if (f.isCloverSpider) {
        this.grantCloverBuff();
        this.time.delayedCall(7000, () => {
          f.hp = f.hpMax;
          f.dead = false;
          f.walker.__dead = false;
          f.cont.setVisible(true);
          f.spr.clearTint().setTexture('clover-spider-idle');
          f.walker.setAnim('idle', 'e');
        });
        return;
      }

      if (f.isCursedScarecrow) {
        this.time.delayedCall(7000, () => {
          f.hp = f.hpMax;
          f.dead = false;
          f.walker.__dead = false;
          f.cont.setVisible(true);
          f.spr.clearTint().setTexture('cursed-scarecrow-idle');
          f.walker.setAnim('idle', 'e');
        });
        return;
      }

      if (f.isMeadowTurtle) {
        this.time.delayedCall(8000, () => {
          f.hp = f.hpMax;
          f.dead = false;
          f.walker.__dead = false;
          f.cont.setVisible(true);
          f.spr.clearTint().setTexture('meadow-turtle-idle');
          f.walker.setAnim('idle', 'e');
        });
        return;
      }

      if (f.isDeathKnight) {
        const forced = qs.get('forceMount');
        const dropMultiplier = this.dropChanceMultiplier();
        const roll = Math.random();
        const reward = forced === 'skeletal_horse' || forced === 'skeletal_horse_gold'
          ? forced
          : roll < 0.001 * dropMultiplier ? 'skeletal_horse_gold'
            : roll < 0.011 * dropMultiplier ? 'skeletal_horse' : null;
        if (reward) {
          const golden = reward === 'skeletal_horse_gold';
          window.__unlockMount && window.__unlockMount(reward);
          celebrateMountDrop(reward);
          announceReward(golden
            ? 'DROP LENDÁRIO!\\nCavalo-Esqueleto Dourado · 0,1%'
            : 'RECOMPENSA RARA!\\nCavalo-Esqueleto · 1%',
            golden ? '#ffd75a' : '#b9f6ff');
        }
        const forcedWeapon = qs.get('forceWeapon');
        const weaponReward = forcedWeapon === 'lord_mas_lance' || this.rollDrop(0.005);
        if (weaponReward) {
          window.__unlockWeapon && window.__unlockWeapon('lord_mas_lance');
          celebrateWeaponDrop();
        }
        this.time.delayedCall(5000, () => {
          f.hp = f.hpMax;
          f.dead = false;
          f.walker.__dead = false;
          f.cont.setVisible(true);
          f.lbl.setText('Lord Mas');
          f.spr.clearTint().setTexture('death-knight-idle');
          f.walker.setAnim('idle', 'e');
        });
      }
    };
    this.damageFoe = (f, amount) => {
      if (!f || f.dead || !f.hpMax) return;
      f.hp = Math.max(0, f.hp - amount);
      if (f.isDeerKing && !f.enraged && f.hp > 0 && f.hp <= f.hpMax * 0.30) {
        f.enraged = true;
        f.skillIndex = 0;
        f.spr.anims.stop();
        f.spr.setTexture('deer-king-enraged').setTint(0xffdddd);
        showBossSkill(f, 'FASE ENFURECIDA!', '#ff7777');
        this.cameras.main.shake(420, 0.009);
      }
      if (f.hp <= 0) this.defeatFoe(f);
    };
    this.mobStrike = (f) => {
      if (f.dead) return;
      if (f.attackKey && !f.attacking) {
        f.walker.setAnim('idle', dirBetween(f.walker, this.player));
        f.attacking = true;
        f.spr.play(f.attackKey, true);
        f.spr.once('animationcomplete', () => {
          f.attacking = false;
          f.walker.setAnim(f.walker.moving ? 'walk' : 'idle', f.walker.dir);
        });
        this.time.delayedCall(350, () => {
          if (f.dead) return;
          const hitDistance = Math.hypot(f.walker.x - this.player.x, f.walker.y - this.player.y);
          if (hitDistance > COMBAT.range * 1.35) return;
          this.flashDoll();
          this.setHp(this.P.hp - (f.damage || 3));
          if (f.isCloverSpider) {
            this.webSlowUntil = Math.max(this.webSlowUntil || 0, this.time.now + 1800);
            const web = this.add.image(0, 8, 'fx-ring').setTint(0xbaff67)
              .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9).setScale(0.45, 0.25);
            doll.add(web);
            doll.bringToTop(web);
            this.tweens.add({
              targets: web, angle: 220, scaleX: 0.9, scaleY: 0.48, alpha: 0,
              duration: 1800, ease: 'Sine.easeOut', onComplete: () => web.destroy(),
            });
            burst('fx-p-ice', doll.x, doll.y + 4, 0xbaff67, 12);
          }
          this.cameras.main.shake(90, 0.0025);
        });
        return;
      }
      // investida VISUAL no sprite interno (o corpo/walker continua livre — sem congelar)
      f.walker.setAnim('idle', dirBetween(f.walker, this.player)); // encara só no golpe
      if (!f.lunging) {
        f.lunging = true;
        const dx = this.player.x - f.walker.x, dy = this.player.y - f.walker.y;
        const len = Math.hypot(dx, dy) || 1;
        const bx = f.spr.x, by = f.spr.y;
        this.tweens.add({
          targets: f.spr, x: bx + (dx / len) * 16, y: by + (dy / len) * 16,
          duration: 110, yoyo: true,
          onComplete: () => { f.lunging = false; f.spr.setPosition(bx, by); },
        });
      }
      this.flashDoll();
      this.setHp(this.P.hp - 3); // dano do golpe do bicho
    };

    window.__scene = this;
  }

  // --- sistema Evil Spirits (MU Online) — 50 vultos caóticos ---
  const EVIL_SPIRIT_COUNT = 50;
  const EVIL_SPIRIT_RADIUS = 280;

  function initEvilSpirits(scene) {
    if (!scene.anims.exists('evil-spirit-float')) {
      scene.anims.create({
        key: 'evil-spirit-float',
        frameRate: 9,
        repeat: -1,
        frames: scene.anims.generateFrameNumbers('evil_spirit', { start: 0, end: 3 })
      });
    }

    scene.evilMode = 1;
    scene.evilSpirits = [];

    for (let i = 0; i < EVIL_SPIRIT_COUNT; i++) {
      const spr = scene.add.sprite(0, 0, 'evil_spirit', 0)
        .setOrigin(0.5, 0.5)
        .setAlpha(0.55)
        .setVisible(true)
        .play('evil-spirit-float');

      const angle = (i / EVIL_SPIRIT_COUNT) * Math.PI * 2;
      const r = 40 + Math.random() * 240;
      spr.setPosition(
        scene.player.x + Math.cos(angle) * r,
        scene.player.y - 12 + Math.sin(angle) * r * 0.7
      );

      scene.evilSpirits.push({
        spr,
        vx: 0, vy: 0,
        orbitAngle: angle,
        orbitR: r,
        baseRadius: r,                         // raio âncora — orbita ao redor dele
        orbitSpeed: 1.2 + Math.random() * 2.8,
        ellipseRatio: 0.5 + Math.random() * 0.4, // achatamento da órbita (0.5=elipse, 1.0=círculo)
        wobble: Math.random() * Math.PI * 2,
        chaseTarget: null,
        chaseTimer: 0,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 2.5 + Math.random() * 4,
      });
    }

    window.__evilMode = scene.evilMode;
    window.__setEvilMode = (m) => {
      scene.evilMode = m;
      window.__evilMode = m;
      scene.evilSpirits.forEach(es => { es.spr.setVisible(m > 0); });
      document.querySelectorAll('.evil-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById('btnEvil' + m);
      if (activeBtn) activeBtn.classList.add('active');
    };
  }

  function updateEvilSpirits(scene, time, delta) {
    const mode = scene.evilMode;
    if (!mode || mode === 0) return;
    const px = scene.player.x;
    const py = scene.player.y - 12;
    const dt = delta / 1000;
    const tSec = time / 1000;

    scene.evilSpirits.forEach((es, i) => {
      let sx = es.spr.x, sy = es.spr.y;
      es.pulse += es.pulseSpeed * dt;
      const alphaBase = 0.35 + Math.sin(es.pulse) * 0.15;
      let targetScale = 0.55;

      if (mode === 1) {
        // ---- NUVEM SOMBRIA: movimento browniano caótico, atraído suavemente ao centro ----
        // cada espírito tem sua própria velocidade que muda gradualmente de forma aleatória
        const dx = sx - px;
        const dy = sy - py;
        const dist = Math.hypot(dx, dy);

        // aceleração browniana: direção muda a cada poucos frames
        if (Math.random() < 0.04) {
          es.vx += (Math.random() - 0.5) * 120;
          es.vy += (Math.random() - 0.5) * 120;
        }
        // fricção leve
        es.vx *= 0.985;
        es.vy *= 0.985;
        // limite de velocidade
        const vMag = Math.hypot(es.vx, es.vy);
        if (vMag > 160) { es.vx *= 160 / vMag; es.vy *= 160 / vMag; }

        // atração suave ao player quando muito longe, repulsão suave quando muito perto
        if (dist > 0.1) {
          const pull = dist > EVIL_SPIRIT_RADIUS ? 0.6 + (dist - EVIL_SPIRIT_RADIUS) * 0.002
                    : dist < 50 ? -0.3
                    : 0.15;
          es.vx -= (dx / dist) * pull * 80 * dt;
          es.vy -= (dy / dist) * pull * 80 * dt;
        }

        sx += es.vx * dt;
        sy += es.vy * dt;

        // confina ao raio (elastic boundary)
        const newDx = sx - px, newDy = sy - py;
        if (Math.hypot(newDx, newDy) > EVIL_SPIRIT_RADIUS + 20) {
          es.vx -= (newDx - px) * 0.05;
          es.vy -= (newDy - py) * 0.05;
        }

        targetScale = 0.45 + Math.abs(Math.sin(es.pulse)) * 0.2;
        es.spr.setFlipX(es.vx < 0);

      } else if (mode === 2) {
        // ---- ENXAME CAÓTICO: órbitas circulares com raios variados (perto/longe/aleatório) ----
        // ângulo avança com pequena variação de velocidade p/ não ficar robótico
        const speedVar = 1 + Math.sin(tSec * 1.3 + es.wobble) * 0.25;
        es.orbitAngle += es.orbitSpeed * speedVar * dt;

        // raio oscila SUAVEMENTE ao redor do baseRadius (sem fugir muito)
        const radiusWobble = Math.sin(tSec * 1.7 + es.wobble * 1.3) * 18;
        const curR = Phaser.Math.Clamp(es.baseRadius + radiusWobble, 25, EVIL_SPIRIT_RADIUS);

        // inversão de direção OCASIONAL (rara, p/ surpresa)
        if (Math.random() < 0.006) es.orbitSpeed *= -1;

        // órbita elíptica: raio horizontal = curR, vertical = curR * ellipseRatio
        // dá variedade visual (uns circulam mais "achatados" que outros)
        const rx = curR;
        const ry = curR * es.ellipseRatio;

        // leve perturbação caótica sobre a posição orbital (só uns pixels)
        const chaosX = Math.sin(tSec * 5.5 + i) * 10;
        const chaosY = Math.cos(tSec * 5.5 + i * 0.7) * 10;

        sx = px + Math.cos(es.orbitAngle) * rx + chaosX;
        sy = py + Math.sin(es.orbitAngle) * ry + chaosY;

        targetScale = 0.42 + Math.abs(Math.cos(es.orbitAngle * 2)) * 0.18;
        es.spr.setFlipX(Math.cos(es.orbitAngle) < 0);

      } else if (mode === 3) {
        // ---- MIASMA CAÇADOR: movimento browniano + perseguição agressiva a inimigos ----
        // drift browniano base
        if (Math.random() < 0.03) {
          es.vx += (Math.random() - 0.5) * 100;
          es.vy += (Math.random() - 0.5) * 100;
        }
        es.vx *= 0.98;
        es.vy *= 0.98;
        const vM = Math.hypot(es.vx, es.vy);
        if (vM > 200) { es.vx *= 200 / vM; es.vy *= 200 / vM; }

        // procura monstro mais próximo
        let nearest = null, minD = 260;
        for (const f of scene.foes) {
          const d = Math.hypot(f.walker.x - sx, f.walker.y - sy);
          if (d < minD) { minD = d; nearest = f; }
        }

        if (nearest && minD < 260) {
          // atraído agressivamente ao monstro
          const tx = nearest.walker.x, ty = nearest.walker.y - 12;
          const tdx = tx - sx, tdy = ty - sy;
          const td = Math.hypot(tdx, tdy) || 1;
          const chaseForce = 300 + (1 - minD / 260) * 500;
          es.vx += (tdx / td) * chaseForce * dt;
          es.vy += (tdy / td) * chaseForce * dt;

          // flash roxo no monstro ao colidir
          if (minD < 40 && time - (nearest.lastEvilHit || 0) > 400) {
            nearest.lastEvilHit = time;
            nearest.spr.setTint(0x9a4dff);
            scene.time.delayedCall(130, () => nearest.spr.clearTint());
          }

          targetScale = 0.55 + (1 - minD / 260) * 0.3;
        } else {
          // atração fraca ao player quando sem alvo
          const pdx = px - sx, pdy = py - sy;
          const pd = Math.hypot(pdx, pdy) || 1;
          es.vx += (pdx / pd) * 40 * dt;
          es.vy += (pdy / pd) * 40 * dt;
          targetScale = 0.4;
        }

        sx += es.vx * dt;
        sy += es.vy * dt;

        // confina ao raio
        const cdx = sx - px, cdy = sy - py;
        const cd = Math.hypot(cdx, cdy);
        if (cd > EVIL_SPIRIT_RADIUS) {
          sx = px + (cdx / cd) * EVIL_SPIRIT_RADIUS;
          sy = py + (cdy / cd) * EVIL_SPIRIT_RADIUS;
          es.vx *= -0.3;
          es.vy *= -0.3;
        }

        es.spr.setFlipX(nearest ? nearest.walker.x < sx : es.vx < 0);
      }

      es.spr.setPosition(sx, sy);
      es.spr.setAlpha(alphaBase);
      es.spr.setScale(targetScale);
      es.spr.setDepth(sy + 10);
    });
  }

  function update(time, delta) {
    const cloverRemaining = Math.max(0, (this.P.cloverBuffUntil || 0) - time);
    if (this.cloverBuffText) {
      this.cloverBuffText.setX(this.scale.width - 20);
      if (cloverRemaining > 0) {
        const totalSeconds = Math.ceil(cloverRemaining / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        this.cloverBuffText.setText(`☘ Sorte do Trevo · +30% · ${minutes}:${seconds}`)
          .setVisible(true);
      } else {
        this.cloverBuffText.setVisible(false);
      }
    }
    // --- combate automático: UMA distância por par decide os DOIS lados.
    // SEM CONGELAMENTO: atacar nunca trava movimento (nem do player nem dos bichos) —
    // o fraco sempre pode fugir/desviar; o golpe anima por cima do deslocamento.
    let nearest = null, nearestD = Infinity;
    for (const f of this.foes) {
      if (f.dead) continue;
      const d = Math.hypot(f.walker.x - this.player.x, f.walker.y - this.player.y);
      if (f.isDeerKing && d < 310 && !f.attacking
          && time - f.last >= (f.enraged ? 1900 : 2700)) {
        f.last = time;
        this.deerKingAttack(f);
      }
      const playerReach = COMBAT.range + (f.hitRadius || 0);
      if (d > playerReach) continue; // chefes grandes recebem golpes em toda a silhueta
      if (!f.isDeerKing && time - f.last >= COMBAT.mobCdMs) {
        f.last = time;
        this.mobStrike(f);
      }
      if (d < nearestD) { nearestD = d; nearest = f; }
    }
    if (nearest && !this.P.attacking && time - this.lastPlayerAtk >= COMBAT.playerCdMs) {
      this.lastPlayerAtk = time;
      this.P.dir = dirBetween(this.player, nearest.walker); // encara o alvo
      this.autoAttack();
      const alvo = nearest; // flash no meio do golpe
      this.time.delayedCall(200, () => {
        if (alvo.dead) return;
        alvo.spr.setTint(0xff7070);
        this.time.delayedCall(130, () => alvo.spr.clearTint());
        this.damageFoe(alvo, 12);
      });
    }
    // rastro espectral no galope (skill 2 — clona o frame corrente, qualquer montaria)
    if (this.P.mount && this.player.moving && time - (this._ghostT || 0) > 95) {
      this._ghostT = time;
      const trailTint = this.P.mount === 'spring_deer' ? 0xff3028
        : this.P.mount === 'skeletal_horse_gold' ? 0xff7a20 : undefined;
      this.fxGhost(trailTint);
    }
    const baseSpeed = this.P.mount
      ? (AI_MOUNTS[this.P.mount] ? AI_MOUNTS[this.P.mount].speed : 260)
      : 165;
    this.player.speed = time < (this.webSlowUntil || 0) ? baseSpeed * 0.55 : baseSpeed;
    this.player.update(keyboardVec(this.keys) || this.joy.vec, delta);
    this.mobs.forEach(m => { if (!m.walker.__dead) m.update(delta); });
    updateEvilSpirits(this, time, delta);
  }

  // espera a fonte pixel antes de subir o jogo (nomes usam Pixelify Sans)
  const boot = () => new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#4a90c4',
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: { preload, create, update },
  });
  document.fonts.load('700 16px "Pixelify Sans"').then(boot, boot);
})();
