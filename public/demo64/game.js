/* Ilha de Elmsong 2.0 — 3 biomas, 15 monstros (CC0), paper doll LPC com inventário */
(function () {
  const { FreeWalker, HomeWanderer, Joystick, ActionButton, keyboardVec, makeKeys } = RPGLab;
  const TILE = 64, WORLD_W = 55, WORLD_H = 15;

  // --- mundo: 4 ilhas + pontes ---
  const ISLES = {
    campo: { x: 2, y: 3, w: 10, h: 9, base: 0, titulo: 'CAMPO' },
    deserto: { x: 15, y: 3, w: 10, h: 9, base: 5, titulo: 'DESERTO' },
    pedra: { x: 28, y: 3, w: 10, h: 9, base: null, titulo: 'PEDRA' },
    neve: { x: 41, y: 3, w: 10, h: 9, base: null, titulo: 'NEVE ✦ IA' },
  };
  const BRIDGES = [[12, 7], [13, 7], [14, 7], [25, 7], [26, 7], [27, 7], [38, 7], [39, 7], [40, 7]];
  const TREES = [[4, 4], [9, 5], [3, 9]];
  const TREES_NEVE = [[43, 4], [48, 5], [44, 10], [49, 11], [46, 6]];
  const SPAWN = { x: 7, y: 7 };

  const inRect = (r, tx, ty) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  const onLand = (tx, ty) =>
    Object.values(ISLES).some(r => inRect(r, tx, ty)) ||
    BRIDGES.some(([bx, by]) => bx === tx && by === ty);
  const blocked = new Set([...TREES, ...TREES_NEVE].map(([x, y]) => x + ',' + y));

  // --- escalas (ajuste fino de proporção vs cenário) ---
  const SCALE = { player: 1.6, mob: 1.6, goblin: 0.8, sheep: 0.85 };

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
    this.load.spritesheet('aihero-idle', A + 'player/hero_ia/idle.png', { frameWidth: 92, frameHeight: 92 });
    this.load.spritesheet('aihero-walk', A + 'player/hero_ia/walk.png', { frameWidth: 92, frameHeight: 92 });
  }

  function paintRect(scene, rect, base, depth, tex = 'flat') {
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      const c = x === 0 ? 0 : (x === rect.w - 1 ? 2 : 1);
      const r = y === 0 ? 0 : (y === rect.h - 1 ? 2 : 1);
      scene.add.image((rect.x + x) * TILE, (rect.y + y) * TILE, tex, base + r * 10 + c)
        .setOrigin(0).setDepth(depth);
    }
  }

  // pedra usa o bloco 4×4 do Tilemap_Elevation: col 0=oeste, 3=leste, 1/2=miolo;
  // linha 0=norte, 3=sul (borda contornada de baixo), 1/2=miolo. frame = linha*4 + col
  function paintStone(scene, rect, depth) {
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      const col = x === 0 ? 0 : (x === rect.w - 1 ? 3 : 1 + (x % 2));
      const row = y === 0 ? 0 : (y === rect.h - 1 ? 3 : 1 + (y % 2));
      scene.add.image((rect.x + x) * TILE, (rect.y + y) * TILE, 'elev', row * 4 + col)
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
    const W = WORLD_W * TILE, H = WORLD_H * TILE;
    this.add.tileSprite(0, 0, W, H, 'water').setOrigin(0).setDepth(-100);
    this.anims.create({ key: 'foam', frameRate: 9, repeat: -1,
      frames: this.anims.generateFrameNumbers('foam', { start: 0, end: 7 }) });

    for (const r of Object.values(ISLES)) foamRing(this, r);
    paintRect(this, ISLES.campo, 0, -80);
    paintRect(this, ISLES.deserto, 5, -80);
    paintStone(this, ISLES.pedra, -80);
    paintRect(this, ISLES.neve, 0, -80, 'snowflat');

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
      this.mobs.push(new HomeWanderer(this, walker, { radius: opts.radius ?? 150 }));
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
      this.mobs.push(new HomeWanderer(this, walker, { radius: 150 }));
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
      this.mobs.push(new HomeWanderer(this, walker, { radius: 165 }));
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
    const P = this.P = { skin: 'lpc', armor: 'leather', weapon: 'longsword', dir: 's', attacking: false };
    const doll = this.add.container(0, 0);
    const mkLayer = () => this.add.sprite(0, 24, 'body-walk', 2 * 9).setScale(SCALE.player / 2);
    const layers = this.layers = {
      wb: mkLayer(), body: mkLayer(), feet: mkLayer(), legs: mkLayer(),
      torso: mkLayer(), head: mkLayer(), hair: mkLayer(), wf: mkLayer(),
    };
    const aiSpr = this.aiSpr = this.add.sprite(0, 24, 'aihero-idle', 2)
      .setOrigin(0.5, 0.93).setVisible(false);
    doll.add([...Object.values(layers), aiSpr]);
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
    const setDoll = this.setDoll = (state, dir) => {
      P.dir = dir;
      const d4 = toCardinal(dir);
      const row = ROWS[d4];
      if (P.skin === 'ai') {
        Object.values(layers).forEach(l => l.setVisible(false));
        aiSpr.setVisible(true);
        if (state === 'walk') aiSpr.play('aihero-walk-' + d4, true);
        else { aiSpr.anims.stop(); aiSpr.setTexture('aihero-idle', row); }
        doll.setDepth(doll.y);
        return;
      }
      aiSpr.setVisible(false);
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
        this.tweens.add({ targets: aiSpr, scaleX: 1.18, scaleY: 0.92, duration: 90,
          yoyo: true, onComplete: () => { P.attacking = false; } });
        return;
      }
      P.attacking = true;
      setDoll('attack', P.dir);
      layers.body.once('animationcomplete', () => {
        P.attacking = false;
        setDoll('idle', P.dir);
      });
    };

    window.__equip = (kind, id) => {
      if (kind === 'weapon') P.weapon = id;
      else if (kind === 'armor') P.armor = id;
      else if (kind === 'skin') P.skin = id.replace('skin_', '');
      if (!P.attacking) setDoll(this.player.moving ? 'walk' : 'idle', P.dir);
      window.__markEquipped && window.__markEquipped(kind, id);
    };
    if (window.__markEquipped) {
      window.__markEquipped('weapon', P.weapon);
      window.__markEquipped('armor', P.armor);
      window.__markEquipped('skin', 'skin_' + P.skin);
    }

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(doll, true, 0.15, 0.15);

    this.keys = makeKeys(this);
    this.joy = new Joystick(this);
    new ActionButton(this, 'atk', attack);
    this.keys.space.on('down', attack);
    window.__scene = this;
  }

  function update(time, delta) {
    if (!this.P.attacking) this.player.update(keyboardVec(this.keys) || this.joy.vec, delta);
    this.mobs.forEach(m => m.update(delta));
  }

  new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#4a90c4',
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: { preload, create, update },
  });
})();
