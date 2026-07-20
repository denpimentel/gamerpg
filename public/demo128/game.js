/* Clareira de Ravenwood — assets 128px prerendered (Reiner's Tilesets), grid 8 direções */
(function () {
  const { GridWalker, Wanderer, Joystick, ActionButton, keyboardVec, makeKeys } = RPGLab;
  const TILE = 64, W_T = 22, H_T = 15; // grid de movimento 64px sobre arte 128

  const SPAWN = { x: 5, y: 7 };
  // árvores: célula bloqueada (tronco); frame do sheet trees2 (128×256, 16 frames)
  // frames verdes do trees2 (grid 128×128): 0 carvalho, 1 frondosa, 2 copada,
  // 4/5 pinheiros, 9 lima, 10 maçã
  const TREES = [
    [2, 2, 0], [5, 1, 4], [9, 2, 1], [13, 1, 9], [17, 2, 5], [20, 2, 0],
    [1, 5, 2], [20, 6, 10], [3, 9, 4], [19, 10, 1], [1, 12, 0], [6, 12, 5],
    [11, 12, 9], [16, 12, 2], [20, 13, 4], [9, 6, 10], [14, 8, 0],
  ];
  const BUSHES = [[4, 4, 19], [8, 10, 24], [12, 3, 7], [16, 6, 15], [18, 12, 53], [2, 7, 54], [7, 3, 52]];
  const LANTERNS = [[6, 5], [10, 8], [14, 5], [18, 9]];
  // estrada de terra horizontal (bandas do frame 1 emendam nas laterais)
  const DIRT = Array.from({ length: 13 }, (_, i) => [4 + i, 7]);

  const blocked = new Set([...TREES, ...BUSHES].map(([x, y]) => x + ',' + y));

  function preload() {
    const A = '../assets/128/';
    this.load.image('grass', A + 'grass_big.png');
    this.load.spritesheet('trees', A + 'trees2.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('bush', A + 'bushes.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('earth', A + 'earth_to_grass.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('lantern', A + 'lantern.png', { frameWidth: 64, frameHeight: 144 });
    this.load.spritesheet('f-walk', A + 'freya_walking.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('f-attack', A + 'freya_attack.png', { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('sk-walk', A + 'skel_walk.png', { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('sk-idle', A + 'skel_idle.png', { frameWidth: 96, frameHeight: 96 });
  }

  const DIR_ROW = { n: 0, ne: 1, e: 2, se: 3, s: 4, sw: 5, w: 6, nw: 7 };

  function create() {
    const W = W_T * TILE, H = H_T * TILE;
    this.add.tileSprite(0, 0, W, H, 'grass').setOrigin(0).setDepth(-100);

    // estrada de terra contínua
    DIRT.forEach(([x, y]) =>
      this.add.image(x * TILE + 32, y * TILE + 32, 'earth', 1).setDepth(-90));

    // árvores e arbustos (origem no pé, profundidade por y)
    TREES.forEach(([x, y, f]) => {
      const t = this.add.image(x * TILE + 32, (y + 1) * TILE, 'trees', f).setOrigin(0.5, 0.9);
      t.setDepth((y + 1) * TILE);
    });
    BUSHES.forEach(([x, y, f]) => {
      const b = this.add.image(x * TILE + 32, (y + 1) * TILE, 'bush', f).setOrigin(0.5, 0.9);
      b.setDepth((y + 1) * TILE);
    });
    LANTERNS.forEach(([x, y], i) => {
      const l = this.add.image(x * TILE + 32, (y + 1) * TILE - 8, 'lantern', (i % 2) * 3).setOrigin(0.5, 1);
      l.setDepth((y + 1) * TILE - 8);
    });

    // animações da Freya: 8 direções (linhas), walk 8f / attack 13f
    for (const [d, r] of Object.entries(DIR_ROW)) {
      this.anims.create({ key: 'fw-' + d, frameRate: 14, repeat: -1,
        frames: this.anims.generateFrameNumbers('f-walk', { start: r * 8, end: r * 8 + 7 }) });
      this.anims.create({ key: 'fi-' + d, frameRate: 1,
        frames: [{ key: 'f-walk', frame: r * 8 }] });
      this.anims.create({ key: 'fa-' + d, frameRate: 20, repeat: 0,
        frames: this.anims.generateFrameNumbers('f-attack', { start: r * 13, end: r * 13 + 12 }) });
      this.anims.create({ key: 'skw-' + d, frameRate: 12, repeat: -1,
        frames: this.anims.generateFrameNumbers('sk-walk', { start: r * 9, end: r * 9 + 8 }) });
      this.anims.create({ key: 'ski-' + d, frameRate: 8, repeat: -1,
        frames: this.anims.generateFrameNumbers('sk-idle', { start: r * 7, end: r * 7 + 6 }) });
    }

    const walkableBase = (tx, ty) =>
      tx >= 1 && ty >= 1 && tx < W_T - 1 && ty < H_T - 1 && !blocked.has(tx + ',' + ty);

    const player = this.add.sprite(0, 0, 'f-walk', 4 * 8).setOrigin(0.5, 0.8);
    this.attacking = false;
    this.player = new GridWalker(this, player, {
      tile: TILE, tx: SPAWN.x, ty: SPAWN.y, stepMs: 230, mode: 8,
      walkable: (tx, ty) => walkableBase(tx, ty) && !(tx === this.skel.tx && ty === this.skel.ty),
      setAnim: (st, dir) => {
        if (!this.attacking) player.play((st === 'walk' ? 'fw-' : 'fi-') + dir, true);
        player.setDepth(player.y);
      },
    });

    // esqueleto patrulhando o lado leste
    const skel = this.add.sprite(0, 0, 'sk-idle', 4 * 7).setOrigin(0.5, 0.8);
    this.skel = new GridWalker(this, skel, {
      tile: TILE, tx: 16, ty: 10, stepMs: 380, mode: 8,
      walkable: (tx, ty) => walkableBase(tx, ty)
        && tx >= 12 && tx <= 19 && ty >= 4 && ty <= 12
        && !(tx === this.player.tx && ty === this.player.ty),
      setAnim: (st, dir) => {
        skel.play((st === 'walk' ? 'skw-' : 'ski-') + dir, true);
        skel.setDepth(skel.y);
      },
    });
    this.skelWander = new Wanderer(this, this.skel);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(player, true, 0.15, 0.15);

    this.keys = makeKeys(this);
    this.joy = new Joystick(this);
    const attack = () => {
      if (this.attacking) return;
      this.attacking = true;
      const d = this.player.dir;
      player.play('fa-' + d);
      player.once('animationcomplete-fa-' + d, () => {
        this.attacking = false;
        player.play('fi-' + d, true);
      });
    };
    new ActionButton(this, 'atk', attack);
    this.keys.space.on('down', attack);
    window.__scene = this;
  }

  function update() {
    if (!this.attacking) this.player.update(keyboardVec(this.keys) || this.joy.vec);
    this.skelWander.update();
  }

  new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#141810',
    pixelArt: false,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: { preload, create, update },
  });
})();
