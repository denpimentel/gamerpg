/* Ilha de Elmsong 2.0 — 3 biomas, 15 monstros (CC0), paper doll LPC com inventário */
(function () {
  const { FreeWalker, HomeWanderer, Joystick, ActionButton, keyboardVec, makeKeys } = RPGLab;
  const TILE = 64, WORLD_W = 55, WORLD_H = 15, WORLD_X0 = -25;

  // --- mundo: 6 ilhas + pontes (castelo e villa em x negativo, à esquerda do campo) ---
  const ISLES = {
    castelo: { x: -24, y: 3, w: 10, h: 9, base: 0, titulo: 'CASTELO' },
    villa: { x: -11, y: 3, w: 10, h: 9, base: 0, titulo: 'VILLA' },
    campo: { x: 2, y: 3, w: 10, h: 9, base: 0, titulo: 'CAMPO' },
    deserto: { x: 15, y: 3, w: 10, h: 9, base: 5, titulo: 'DESERTO' },
    pedra: { x: 28, y: 3, w: 10, h: 9, base: null, titulo: 'PEDRA' },
    neve: { x: 41, y: 3, w: 10, h: 9, base: null, titulo: 'NEVE ✦ IA' },
  };
  const BRIDGES = [[-14, 7], [-13, 7], [-12, 7], [-1, 7], [0, 7], [1, 7], [12, 7], [13, 7], [14, 7], [25, 7], [26, 7], [27, 7], [38, 7], [39, 7], [40, 7]];
  // casa gerada por IA (ChatGPT) — 8×7.8 tiles, centrada no castelo. footprint bloqueado.
  const AI_HOUSE = { cx: -19, by: 12, cells: [] };
  for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy <= 3; dy++) AI_HOUSE.cells.push([-19 + dx, 11 - dy]);
  const TREES = [[4, 4], [9, 5], [3, 9]];
  const TREES_NEVE = [[43, 4], [48, 5], [44, 10], [49, 11], [46, 6]];
  const SPAWN = { x: 7, y: 7 };

  const inRect = (r, tx, ty) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  const onLand = (tx, ty) =>
    Object.values(ISLES).some(r => inRect(r, tx, ty)) ||
    BRIDGES.some(([bx, by]) => bx === tx && by === ty);
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
  };
  const ATTACK_ANIM = { longsword: 'slash', dagger: 'slash', mace: 'slash', waraxe: 'slash', spear: 'thrust' };

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
  };

  // --- monstros Pixel Adventure (upscalados 2x → frame nativo × 2 no load): ---
  //     [nome, 'bioma/pasta', fwNativo, fhNativo, temWalk, célula]
  const MOBS = [
    ['Galinha', 'campo/chicken', 32, 34, true, [4, 6]],
    ['Coelho', 'campo/bunny', 34, 44, true, [8, 4]],
    ['Abelha', 'campo/bee', 36, 34, false, [6, 9]],
    ['Slime', 'campo/slime', 44, 30, false, [9, 8]],
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
    this.load.spritesheet('sheep', A + 'creatures/common/sheep/idle.png', { frameWidth: 64, frameHeight: 64 });
    for (const n of ['yeti', 'golem', 'wolf']) { // IA PixelLab: 92px, idle 1col / walk 6col, linhas n/w/s/e
      this.load.spritesheet('ai' + n + '-idle', A + 'creatures/neve/' + n + '/idle.png', { frameWidth: 92, frameHeight: 92 });
      this.load.spritesheet('ai' + n + '-walk', A + 'creatures/neve/' + n + '/walk.png', { frameWidth: 92, frameHeight: 92 });
    }
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
      this.load.spritesheet(`mtai-${m}-idle`, `${A}player/mount/${m}/idle.png`, { frameWidth: cfg.frame, frameHeight: cfg.frame });
      this.load.spritesheet(`mtai-${m}-walk`, `${A}player/mount/${m}/walk.png`, { frameWidth: cfg.frame, frameHeight: cfg.frame });
    }
    this.load.spritesheet('aihero-idle', A + 'player/hero_ia/idle.png', { frameWidth: 92, frameHeight: 92 });
    this.load.spritesheet('aihero-walk', A + 'player/hero_ia/walk.png', { frameWidth: 92, frameHeight: 92 });
    this.load.image('mount-leg', A + 'player/mount_leg.png'); // pezinho do lado de cá (montado)
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
    // ovelhas (ambiente)
    mk('sheep-idle', 'sheep', 0, -1, 3, -1);
    [[3, 8], [10, 9], [16, 4]].forEach(([sx, sy], i) => {
      const s = this.add.sprite(0, 0, 'sheep', 0).setOrigin(0.5, 0.8).setScale(SCALE.sheep);
      const w = new FreeWalker(this, s, {
        tile: TILE, tx: sx, ty: sy, speed: 40, mode: 4,
        walkablePx,
        setAnim: (st, dir) => {
          if (dir.includes('w')) s.setFlipX(true);
          else if (dir.includes('e')) s.setFlipX(false);
          s.play('sheep-idle', true); s.setDepth(s.y);
        },
      });
      this.mobs.push(new HomeWanderer(this, w, { radius: 120, pauseChance: 0.4 }));
    });

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
        if (legSpr.visible) legSpr.setPosition((d4 === 'w' ? -3 : 3), -13 + bob * K);
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
        mountB.setVisible(true).setOrigin(0.5, 0.95).setScale(1).setPosition(0, ai.dy);
        if (cycle === 'walk') mountB.play(ensureMountAnim(`mtai-${P.mount}-walk`, row, ai.walkCols, ai.rate), true);
        else { mountB.anims.stop(); mountB.setTexture(`mtai-${P.mount}-idle`, row); }
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
        legSpr.setScale(0.48);                        // perna de montaria dobrada, compacta
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

    const attack = () => {
      if (P.attacking) return;
      if (P.skin === 'ai') {
        // herói IA não tem anim de ataque — investida rápida como feedback
        P.attacking = true;
        this.tweens.add({ targets: aiSpr, scaleX: 1.18, scaleY: 0.92,
          duration: 90, yoyo: true, onComplete: () => { P.attacking = false; } });
        return;
      }
      // a pé OU montado: golpe real do paper doll (montado, renderMounted anima o tronco+arma)
      P.attacking = true;
      setDoll('attack', P.dir);
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
    this.mobStrike = (f) => {
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

  function update(time, delta) {
    // --- combate automático: UMA distância por par decide os DOIS lados.
    // SEM CONGELAMENTO: atacar nunca trava movimento (nem do player nem dos bichos) —
    // o fraco sempre pode fugir/desviar; o golpe anima por cima do deslocamento.
    let nearest = null, nearestD = Infinity;
    for (const f of this.foes) {
      const d = Math.hypot(f.walker.x - this.player.x, f.walker.y - this.player.y);
      if (d > COMBAT.range) continue; // fora da envergadura única: ninguém ataca
      if (time - f.last >= COMBAT.mobCdMs) { f.last = time; this.mobStrike(f); }
      if (d < nearestD) { nearestD = d; nearest = f; }
    }
    if (nearest && !this.P.attacking && time - this.lastPlayerAtk >= COMBAT.playerCdMs) {
      this.lastPlayerAtk = time;
      this.P.dir = dirBetween(this.player, nearest.walker); // encara o alvo
      this.autoAttack();
      const alvo = nearest; // flash no meio do golpe
      this.time.delayedCall(200, () => {
        alvo.spr.setTint(0xff7070);
        this.time.delayedCall(130, () => alvo.spr.clearTint());
      });
    }
    this.player.update(keyboardVec(this.keys) || this.joy.vec, delta);
    this.mobs.forEach(m => m.update(delta));
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
