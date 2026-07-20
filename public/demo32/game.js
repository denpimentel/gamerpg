/* Vila de Camwood — 32×32, LPC, movimento em grid 4 direções (estilo Tibia clássico) */
(function () {
  const { GridWalker, Wanderer, Joystick, keyboardVec, makeKeys, parseMap } = RPGLab;
  const TILE = 32;

  const MAP = parseMap([
    '##########################',
    '#T.....F........T......F.#',
    '#....................P...#',
    '#..r......d..............#',
    '#....@.....d.........r...#',
    '#.S........d.............#',
    '#.b........d.........F...#',
    '#.b.......ddd............#',
    '#T.........d.........T...#',
    '#..........d...F.........#',
    '#.....F....d.............#',
    '#..........dd......r.....#',
    '#T..........dd...........#',
    '#.............ddD........#',
    '#..T.....T.......d....T..#',
    '#........................#',
    '#.F..........F........F..#',
    '##########################',
  ]);

  const blocked = new Set();
  const block = (x, y) => blocked.add(x + ',' + y);
  let spawn = { x: 5, y: 4 };

  function preload() {
    const L = (k, f) => this.load.image(k, '../assets/32/tiles/' + f + '.png');
    ['grass_a', 'grass_b', 'grass_c', 'grass_d', 'pond', 'dirt_small', 'dirt_big',
     'sign', 'rock1', 'rock2', 'barrel1', 'tree_bushy1', 'tree_bushy2', 'tree_fir1', 'tree_fir2']
      .forEach(k => L(k, k));
    this.load.spritesheet('soldier', '../assets/32/sprites/soldier.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('slime', '../assets/32/sprites/slime.png', { frameWidth: 32, frameHeight: 32 });
  }

  function create() {
    const W = MAP.w * TILE, H = MAP.h * TILE;

    // chão: grama lisa + variações sutis espalhadas
    this.add.tileSprite(0, 0, W, H, 'grass_b').setOrigin(0).setDepth(-100);
    const rng = new Phaser.Math.RandomDataGenerator(['camwood']);
    for (let i = 0; i < 70; i++) {
      const x = rng.between(1, MAP.w - 2), y = rng.between(1, MAP.h - 2);
      this.add.image(x * TILE, y * TILE, rng.pick(['grass_c', 'grass_d']))
        .setOrigin(0).setDepth(-99);
    }

    // objetos do mapa
    MAP.each((ch, x, y) => {
      const cx = x * TILE + TILE / 2, bottom = (y + 1) * TILE;
      const put = (key) => this.add.image(cx, bottom, key).setOrigin(0.5, 1).setDepth(bottom);
      switch (ch) {
        case '#': put((x + y) % 2 ? 'tree_fir1' : 'tree_bushy1'); block(x, y); break;
        case 'T': put(rng.pick(['tree_bushy1', 'tree_bushy2'])); block(x, y); break;
        case 'F': put(rng.pick(['tree_fir1', 'tree_fir2'])); block(x, y); break;
        case 'r': put(rng.pick(['rock1', 'rock2'])); block(x, y); break;
        case 'b': put('barrel1'); block(x, y); break;
        case 'S': put('sign'); block(x, y); break;
        case 'd': this.add.image(cx, y * TILE + TILE / 2, 'dirt_small').setScale(1.35).setDepth(-50); break;
        case 'D': this.add.image(cx, y * TILE + TILE / 2, 'dirt_big').setDepth(-51); break;
        case 'P':
          this.add.image(x * TILE, y * TILE, 'pond').setOrigin(0).setDepth(-40);
          for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) block(x + i, y + j);
          break;
        case '@': spawn = { x, y }; break;
      }
    });

    // animações do soldado: linhas 0=n 1=w 2=s 3=e, 9 frames (0 = parado)
    const rows = { n: 0, w: 1, s: 2, e: 3 };
    for (const [d, r] of Object.entries(rows)) {
      this.anims.create({ key: 'p-walk-' + d, frameRate: 12, repeat: -1,
        frames: this.anims.generateFrameNumbers('soldier', { start: r * 9 + 1, end: r * 9 + 8 }) });
      this.anims.create({ key: 'p-idle-' + d, frameRate: 1,
        frames: [{ key: 'soldier', frame: r * 9 }] });
    }
    // slime: linhas 0=n 1=w 2=s 3=e (3 frames)
    for (const [d, r] of Object.entries(rows)) {
      this.anims.create({ key: 'sl-' + d, frameRate: 5, repeat: -1, yoyo: true,
        frames: this.anims.generateFrameNumbers('slime', { start: r * 3, end: r * 3 + 2 }) });
    }

    const walkableBase = (tx, ty) =>
      tx >= 0 && ty >= 0 && tx < MAP.w && ty < MAP.h && !blocked.has(tx + ',' + ty);

    // player
    const player = this.add.sprite(0, 0, 'soldier', 2 * 9).setOrigin(0.5, 0.78);
    this.player = new GridWalker(this, player, {
      tile: TILE, tx: spawn.x, ty: spawn.y, stepMs: 240, mode: 4,
      walkable: (tx, ty) => walkableBase(tx, ty) && !(tx === this.slime.tx && ty === this.slime.ty),
      setAnim: (st, dir) => {
        player.play((st === 'walk' ? 'p-walk-' : 'p-idle-') + dir, true);
        player.setDepth(player.y);
      },
    });

    // slime NPC vagando num pasto
    const slimeSpr = this.add.sprite(0, 0, 'slime', 6).setOrigin(0.5, 0.7);
    this.slime = new GridWalker(this, slimeSpr, {
      tile: TILE, tx: 14, ty: 10, stepMs: 420, mode: 4,
      walkable: (tx, ty) => walkableBase(tx, ty)
        && tx >= 9 && tx <= 19 && ty >= 8 && ty <= 14
        && !(tx === this.player.tx && ty === this.player.ty),
      setAnim: (st, dir) => { slimeSpr.play('sl-' + dir, true); slimeSpr.setDepth(slimeSpr.y); },
    });
    this.wander = new Wanderer(this, this.slime);

    // câmera
    const cam = this.cameras.main;
    cam.setZoom(2);
    cam.setBounds(0, 0, W, H);
    cam.startFollow(player, true, 0.15, 0.15);

    this.keys = makeKeys(this);
    this.joy = new Joystick(this);
    window.__scene = this;
  }

  function update() {
    this.player.update(keyboardVec(this.keys) || this.joy.vec);
    this.wander.update();
  }

  new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', backgroundColor: '#101a10',
    pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: { preload, create, update },
  });
})();
