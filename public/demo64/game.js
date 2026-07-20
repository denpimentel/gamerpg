/* Ilha de Elmsong — 64×64, Tiny Swords, grid 8 direções */
(function () {
  const { GridWalker, Wanderer, Joystick, ActionButton, keyboardVec, makeKeys } = RPGLab;
  const TILE = 64, WORLD_W = 26, WORLD_H = 18;

  // ilha principal e ilhota (retângulos em células do mundo)
  const ISLE = { x: 4, y: 4, w: 18, h: 10 };
  const SAND = { x: 15, y: 9, w: 6, h: 4 };
  const MINI = { x: 22, y: 2, w: 3, h: 3 };
  const TREES = [[6, 5], [10, 4], [19, 5], [5, 11], [12, 6], [17, 5]];
  const SPAWN = { x: 8, y: 8 };

  const onIsle = (tx, ty) =>
    (tx >= ISLE.x && tx < ISLE.x + ISLE.w && ty >= ISLE.y && ty < ISLE.y + ISLE.h) ||
    (tx >= MINI.x && tx < MINI.x + MINI.w && ty >= MINI.y && ty < MINI.y + MINI.h);
  const blocked = new Set(TREES.map(([x, y]) => x + ',' + y));

  function preload() {
    const A = '../assets/64/';
    this.load.image('water', A + 'Water.png');
    this.load.spritesheet('flat', A + 'Tilemap_Flat.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('foam', A + 'Foam.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('tree', A + 'Tree.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('warrior', A + 'Warrior_Blue.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('goblin', A + 'Torch_Red.png', { frameWidth: 192, frameHeight: 192 });
    this.load.spritesheet('sheep', A + 'HappySheep_Idle.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('rocks1', A + 'Rocks_01.png', { frameWidth: 64, frameHeight: 64 });
    for (let i = 1; i <= 13; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image('deco' + n, A + 'deco/' + n + '.png');
    }
  }

  // pinta um retângulo com o bloco 3×3 do tilemap flat (base 0 = grama, 5 = areia)
  function paintRect(scene, rect, base, depth) {
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      const c = x === 0 ? 0 : (x === rect.w - 1 ? 2 : 1);
      const r = y === 0 ? 0 : (y === rect.h - 1 ? 2 : 1);
      scene.add.image((rect.x + x) * TILE, (rect.y + y) * TILE, 'flat', base + r * 10 + c)
        .setOrigin(0).setDepth(depth);
    }
  }

  function foamRing(scene, rect) {
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      if (y === 0 || x === 0 || y === rect.h - 1 || x === rect.w - 1) {
        const f = scene.add.sprite((rect.x + x) * TILE + 32, (rect.y + y) * TILE + 32, 'foam')
          .setDepth(-90);
        f.play({ key: 'foam', startFrame: (x + y) % 8 });
      }
    }
  }

  function create() {
    const W = WORLD_W * TILE, H = WORLD_H * TILE;
    this.add.tileSprite(0, 0, W, H, 'water').setOrigin(0).setDepth(-100);

    this.anims.create({ key: 'foam', frameRate: 9, repeat: -1,
      frames: this.anims.generateFrameNumbers('foam', { start: 0, end: 7 }) });

    foamRing(this, ISLE);
    foamRing(this, MINI);
    paintRect(this, ISLE, 0, -80);
    paintRect(this, MINI, 0, -80);
    paintRect(this, SAND, 5, -79);

    // árvores animadas (balanço)
    this.anims.create({ key: 'tree-sway', frameRate: 5, repeat: -1, yoyo: true,
      frames: this.anims.generateFrameNumbers('tree', { start: 0, end: 3 }) });
    TREES.forEach(([x, y]) => {
      const t = this.add.sprite(x * TILE + 32, y * TILE + 56, 'tree').setOrigin(0.5, 0.85);
      t.setDepth(t.y).play({ key: 'tree-sway', startFrame: (x + y) % 4 });
    });

    // decoração (cogumelos, flores, pedras)
    const rng = new Phaser.Math.RandomDataGenerator(['elmsong']);
    for (let i = 0; i < 16; i++) {
      const tx = rng.between(ISLE.x + 1, ISLE.x + ISLE.w - 2);
      const ty = rng.between(ISLE.y + 1, ISLE.y + ISLE.h - 2);
      if (blocked.has(tx + ',' + ty)) continue;
      const n = String(rng.between(1, 13)).padStart(2, '0');
      this.add.image(tx * TILE + 32, ty * TILE + 60, 'deco' + n)
        .setOrigin(0.5, 1).setDepth(ty * TILE + 60);
    }
    // pedras na água
    [[2, 9], [24, 8], [12, 16]].forEach(([x, y]) =>
      this.add.sprite(x * TILE + 32, y * TILE + 32, 'rocks1', 0).setDepth(-85));

    // animações
    const mk = (key, sheet, s, e, rate, rep) => this.anims.create({
      key, frameRate: rate, repeat: rep,
      frames: this.anims.generateFrameNumbers(sheet, { start: s, end: e }) });
    mk('w-idle', 'warrior', 0, 5, 8, -1);
    mk('w-walk', 'warrior', 12, 17, 12, -1);
    mk('w-attack', 'warrior', 24, 29, 16, 0);
    mk('g-idle', 'goblin', 0, 6, 8, -1);
    mk('g-walk', 'goblin', 7, 12, 10, -1);
    mk('sheep-idle', 'sheep', 0, 1, 3, -1);

    const walkableBase = (tx, ty) => onIsle(tx, ty) && !blocked.has(tx + ',' + ty);

    // player (flip horizontal para esquerda; anim lateral serve para todas as direções)
    const player = this.add.sprite(0, 0, 'warrior', 0).setOrigin(0.5, 0.72);
    this.attacking = false;
    this.player = new GridWalker(this, player, {
      tile: TILE, tx: SPAWN.x, ty: SPAWN.y, stepMs: 210, mode: 8,
      walkable: (tx, ty) => walkableBase(tx, ty) && !(tx === this.gob.tx && ty === this.gob.ty),
      setAnim: (st, dir) => {
        if (dir.includes('w')) player.setFlipX(true);
        else if (dir.includes('e')) player.setFlipX(false);
        if (!this.attacking) player.play(st === 'walk' ? 'w-walk' : 'w-idle', true);
        player.setDepth(player.y);
      },
    });

    // goblin patrulhando a praia
    const gob = this.add.sprite(0, 0, 'goblin', 0).setOrigin(0.5, 0.72);
    this.gob = new GridWalker(this, gob, {
      tile: TILE, tx: 17, ty: 10, stepMs: 340, mode: 4,
      walkable: (tx, ty) => walkableBase(tx, ty)
        && tx >= SAND.x && tx < SAND.x + SAND.w && ty >= SAND.y && ty < SAND.y + SAND.h
        && !(tx === this.player.tx && ty === this.player.ty),
      setAnim: (st, dir) => {
        if (dir.includes('w')) gob.setFlipX(true);
        else if (dir.includes('e')) gob.setFlipX(false);
        gob.play(st === 'walk' ? 'g-walk' : 'g-idle', true);
        gob.setDepth(gob.y);
      },
    });
    this.gobWander = new Wanderer(this, this.gob);

    // ovelhas
    [[7, 6, ISLE], [13, 11, ISLE], [23, 3, MINI]].forEach(([sx, sy, zone], i) => {
      const s = this.add.sprite(0, 0, 'sheep', 0).setOrigin(0.5, 0.8);
      const w = new GridWalker(this, s, {
        tile: TILE, tx: sx, ty: sy, stepMs: 500, mode: 4,
        walkable: (tx, ty) => walkableBase(tx, ty)
          && tx >= zone.x && tx < zone.x + zone.w && ty >= zone.y && ty < zone.y + zone.h,
        setAnim: (st, dir) => {
          if (dir.includes('w')) s.setFlipX(true);
          else if (dir.includes('e')) s.setFlipX(false);
          s.play('sheep-idle', true);
          s.setDepth(s.y);
        },
      });
      this['sheep' + i] = new Wanderer(this, w, { pauseMin: 1500, pauseMax: 5000 });
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(player, true, 0.15, 0.15);

    this.keys = makeKeys(this);
    this.joy = new Joystick(this);
    const attack = () => {
      if (this.attacking) return;
      this.attacking = true;
      player.play('w-attack');
      player.once('animationcomplete-w-attack', () => {
        this.attacking = false;
        player.play('w-idle', true);
      });
    };
    new ActionButton(this, 'atk', attack);
    this.keys.space.on('down', attack);
    window.__scene = this;
  }

  function update() {
    if (!this.attacking) this.player.update(keyboardVec(this.keys) || this.joy.vec);
    this.gobWander.update();
    for (let i = 0; i < 3; i++) this['sheep' + i].update();
  }

  new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#4a90c4',
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: { preload, create, update },
  });
})();
