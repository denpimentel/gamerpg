/* Ilha de Elmsong 2.0 — 3 biomas, 15 monstros (CC0), paper doll LPC com inventário */
(function () {
  const { GridWalker, Wanderer, Joystick, ActionButton, keyboardVec, makeKeys } = RPGLab;
  const TILE = 64, WORLD_W = 42, WORLD_H = 15;

  // --- mundo: 3 ilhas + pontes ---
  const ISLES = {
    campo: { x: 2, y: 3, w: 10, h: 9, base: 0, titulo: 'CAMPO' },
    deserto: { x: 15, y: 3, w: 10, h: 9, base: 5, titulo: 'DESERTO' },
    pedra: { x: 28, y: 3, w: 10, h: 9, base: null, titulo: 'PEDRA' },
  };
  const BRIDGES = [[12, 7], [13, 7], [14, 7], [25, 7], [26, 7], [27, 7]];
  const TREES = [[4, 4], [9, 5], [3, 9]];
  const SPAWN = { x: 7, y: 7 };

  const inRect = (r, tx, ty) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  const onLand = (tx, ty) =>
    Object.values(ISLES).some(r => inRect(r, tx, ty)) ||
    BRIDGES.some(([bx, by]) => bx === tx && by === ty);
  const blocked = new Set(TREES.map(([x, y]) => x + ',' + y));

  // --- paper doll ---
  const ROWS = { n: 0, w: 1, s: 2, e: 3 };
  const COLS = { walk: 9, slash: 6, thrust: 8 };
  const CLOTH = ['body', 'feet', 'legs', 'head'];
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

  // --- monstros: [nome, pasta, arqIdle, fw, fh, arqWalk?, bioma, célula] ---
  const MOBS = [
    ['Galinha', 'Chicken', 'Idle (32x34).png', 32, 34, 'Run (32x34).png', 'campo', [4, 6]],
    ['Coelho', 'Bunny', 'Idle (34x44).png', 34, 44, 'Run (34x44).png', 'campo', [8, 4]],
    ['Abelha', 'Bee', 'Idle (36x34).png', 36, 34, null, 'campo', [6, 9]],
    ['Slime', 'Slime', 'Idle-Run (44x30).png', 44, 30, null, 'campo', [9, 8]],
    ['Caracol', 'Snail', 'Idle (38x24).png', 38, 24, 'Walk (38x24).png', 'deserto', [17, 5]],
    ['Rino', 'Rino', 'Idle (52x34).png', 52, 34, 'Run (52x34).png', 'deserto', [20, 6]],
    ['Javali', 'AngryPig', 'Idle (36x30).png', 36, 30, 'Walk (36x30).png', 'deserto', [22, 9]],
    ['Tronco', 'Trunk', 'Idle (64x32).png', 64, 32, 'Run (64x32).png', 'deserto', [17, 10]],
    ['Morcego', 'Bat', 'Idle (46x30).png', 46, 30, 'Flying (46x30).png', 'pedra', [30, 5]],
    ['Fantasma', 'Ghost', 'Idle (44x30).png', 44, 30, null, 'pedra', [33, 4]],
    ['Cogumelo', 'Mushroom', 'Idle (32x32).png', 32, 32, 'Run (32x32).png', 'pedra', [35, 8]],
    ['Rabanete', 'Radish', 'Idle 1 (30x38).png', 30, 38, 'Run (30x38).png', 'pedra', [31, 10]],
  ];

  function preload() {
    const A = '../assets/64/';
    this.load.image('water', A + 'Water.png');
    this.load.spritesheet('flat', A + 'Tilemap_Flat.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('elev', A + 'Tilemap_Elevation.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('bridge', A + 'Bridge_All.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('foam', A + 'Foam.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('tree', A + 'Tree.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('goblin', A + 'Torch_Red.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('tnt', A + 'TNT_Red.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('sheep', A + 'HappySheep_Idle.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('rocks1', A + 'Rocks_01.png', { frameWidth: 64, frameHeight: 64 });
    for (let i = 1; i <= 18; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image('deco' + n, A + 'deco/' + n + '.png');
    }
    // camadas LPC (64px por frame)
    for (const c of [...CLOTH, ...Object.values(TORSOS)]) {
      for (const anim of ['walk', 'slash', 'thrust']) {
        this.load.spritesheet(`${c}-${anim}`, `${A}lpc/${c}/${anim}.png`, { frameWidth: 64, frameHeight: 64 });
      }
    }
    for (const [w, files] of Object.entries(WEAPON_FILES)) {
      for (const [anim, , fs] of files) {
        this.load.spritesheet(`w-${w}-${anim}`, `${A}lpc/weapon_${w}/${anim}.png`, { frameWidth: fs, frameHeight: fs });
      }
    }
    for (const [, dir, idle, fw, fh, walk] of MOBS) {
      this.load.spritesheet(`en-${dir}-idle`, `${A}enemies/${dir}/${idle}`, { frameWidth: fw, frameHeight: fh });
      if (walk) this.load.spritesheet(`en-${dir}-walk`, `${A}enemies/${dir}/${walk}`, { frameWidth: fw, frameHeight: fh });
    }
  }

  function paintRect(scene, rect, base, depth) {
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      const c = x === 0 ? 0 : (x === rect.w - 1 ? 2 : 1);
      const r = y === 0 ? 0 : (y === rect.h - 1 ? 2 : 1);
      scene.add.image((rect.x + x) * TILE, (rect.y + y) * TILE, 'flat', base + r * 10 + c)
        .setOrigin(0).setDepth(depth);
    }
  }
  function paintStone(scene, rect, depth) {
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      const c = x === 0 ? 0 : (x === rect.w - 1 ? 2 : 1);
      const r = y === 0 ? 0 : (y === rect.h - 1 ? 2 : 1);
      scene.add.image((rect.x + x) * TILE, (rect.y + y) * TILE, 'elev', r * 4 + c)
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

    // ------- monstros -------
    const mk = (key, sheet, s, e, rate, rep) => {
      if (!this.anims.exists(key)) this.anims.create({ key, frameRate: rate, repeat: rep,
        frames: this.anims.generateFrameNumbers(sheet, { start: s, end: e }) });
    };
    this.mobs = [];
    const spawnMob = (nome, texIdle, texWalk, cell, zone, opts = {}) => {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, opts.dy ?? 26, texIdle, 0).setOrigin(0.5, 1).setScale(opts.scale ?? 2);
      const lbl = this.add.text(0, opts.ly ?? -58, nome, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#fff',
        stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5);
      cont.add([spr, lbl]);
      mk(texIdle + ':a', texIdle, 0, -1, opts.rate ?? 9, -1);
      if (texWalk) mk(texWalk + ':a', texWalk, 0, opts.walkEnd ?? -1, opts.rate ?? 9, -1);
      const walker = new GridWalker(this, cont, {
        tile: TILE, tx: cell[0], ty: cell[1], stepMs: opts.stepMs ?? 420, mode: 4,
        walkable: (tx, ty) => walkableBase(tx, ty) && inRect(zone, tx, ty),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(opts.faceRight ? true : false);
          else if (dir.includes('e')) spr.setFlipX(opts.faceRight ? false : true);
          spr.play((st === 'walk' && texWalk ? texWalk : texIdle) + ':a', true);
          cont.setDepth(cont.y);
        },
      });
      this.mobs.push(new Wanderer(this, walker, { pauseMin: 1200, pauseMax: 3800 }));
    };
    for (const [nome, dir, , , , walk, isle, cell] of MOBS) {
      spawnMob(nome, `en-${dir}-idle`, walk ? `en-${dir}-walk` : null, cell, ISLES[isle]);
    }
    // goblins Tiny Swords (192px, sheets grandes)
    mk('gob-idle', 'goblin', 0, 6, 8, -1); mk('gob-walk', 'goblin', 7, 12, 10, -1);
    mk('tnt-idle', 'tnt', 0, 6, 8, -1); mk('tnt-walk', 'tnt', 7, 12, 10, -1);
    const spawnGoblin = (nome, tex, cell, zone) => {
      const cont = this.add.container(0, 0);
      const spr = this.add.sprite(0, 36, tex, 0).setOrigin(0.5, 0.85);
      const lbl = this.add.text(0, -66, nome, { fontFamily: 'sans-serif', fontSize: '12px',
        color: '#ffd76a', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
      cont.add([spr, lbl]);
      const walker = new GridWalker(this, cont, {
        tile: TILE, tx: cell[0], ty: cell[1], stepMs: 380, mode: 4,
        walkable: (tx, ty) => walkableBase(tx, ty) && inRect(zone, tx, ty),
        setAnim: (st, dir) => {
          if (dir.includes('w')) spr.setFlipX(true);
          else if (dir.includes('e')) spr.setFlipX(false);
          spr.play(tex === 'goblin' ? (st === 'walk' ? 'gob-walk' : 'gob-idle')
                                    : (st === 'walk' ? 'tnt-walk' : 'tnt-idle'), true);
          cont.setDepth(cont.y);
        },
      });
      this.mobs.push(new Wanderer(this, walker));
    };
    spawnGoblin('Goblin Tocha', 'goblin', [36, 6], ISLES.pedra);
    spawnGoblin('Goblin TNT', 'tnt', [23, 4], ISLES.deserto);
    // ovelhas (ambiente)
    mk('sheep-idle', 'sheep', 0, -1, 3, -1);
    [[3, 8], [10, 9], [16, 4]].forEach(([sx, sy], i) => {
      const s = this.add.sprite(0, 0, 'sheep', 0).setOrigin(0.5, 0.8);
      const w = new GridWalker(this, s, {
        tile: TILE, tx: sx, ty: sy, stepMs: 520, mode: 4,
        walkable: (tx, ty) => walkableBase(tx, ty),
        setAnim: (st, dir) => {
          if (dir.includes('w')) s.setFlipX(true);
          else if (dir.includes('e')) s.setFlipX(false);
          s.play('sheep-idle', true); s.setDepth(s.y);
        },
      });
      this.mobs.push(new Wanderer(this, w, { pauseMin: 1800, pauseMax: 5200 }));
    });

    // ------- player paper doll -------
    const P = this.P = { armor: 'leather', weapon: 'longsword', dir: 's', attacking: false };
    const doll = this.add.container(0, 0);
    const mkLayer = () => this.add.sprite(0, 24, 'body-walk', 2 * 9).setScale(2);
    const layers = this.layers = {
      wb: mkLayer(), body: mkLayer(), feet: mkLayer(), legs: mkLayer(),
      torso: mkLayer(), head: mkLayer(), wf: mkLayer(),
    };
    doll.add(Object.values(layers));

    const texFor = (layer, anim) => {
      if (layer === 'torso') return `${TORSOS[P.armor]}-${anim}`;
      if (layer === 'wf') return `w-${P.weapon}-${anim}`;
      if (layer === 'wb') return `w-${P.weapon}-${anim}_behind`;
      return `${layer}-${anim}`;
    };
    const applyOrigin = (spr) => {
      const big = spr.frame.width === 192;
      spr.setOrigin(0.5, big ? (0.95 * 64 + 64) / 192 : 0.95);
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

    this.player = new GridWalker(this, doll, {
      tile: TILE, tx: SPAWN.x, ty: SPAWN.y, stepMs: 210, mode: 8,
      walkable: walkableBase,
      setAnim: (st, dir) => { if (!P.attacking) setDoll(st, dir); },
    });

    const attack = () => {
      if (P.attacking) return;
      P.attacking = true;
      setDoll('attack', P.dir);
      layers.body.once('animationcomplete', () => {
        P.attacking = false;
        setDoll('idle', P.dir);
      });
    };

    window.__equip = (kind, id) => {
      if (kind === 'weapon') P.weapon = id;
      else P.armor = id;
      if (!P.attacking) setDoll(this.player.moving ? 'walk' : 'idle', P.dir);
      window.__markEquipped && window.__markEquipped(kind, id);
    };
    window.__markEquipped && (window.__markEquipped('weapon', P.weapon), window.__markEquipped('armor', P.armor));

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(doll, true, 0.15, 0.15);

    this.keys = makeKeys(this);
    this.joy = new Joystick(this);
    new ActionButton(this, 'atk', attack);
    this.keys.space.on('down', attack);
    window.__scene = this;
  }

  function update() {
    if (!this.P.attacking) this.player.update(keyboardVec(this.keys) || this.joy.vec);
    this.mobs.forEach(m => m.update());
  }

  new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#4a90c4',
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: { preload, create, update },
  });
})();
