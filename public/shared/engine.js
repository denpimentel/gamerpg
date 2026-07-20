/* RPGLab — utilitários compartilhados dos demos (Phaser 4, UMD global) */
window.RPGLab = (function () {
  const DIR_NAMES = {
    '1,0': 'e', '-1,0': 'w', '0,1': 's', '0,-1': 'n',
    '1,1': 'se', '1,-1': 'ne', '-1,1': 'sw', '-1,-1': 'nw',
  };

  // vetor contínuo -> passo de grid (4 ou 8 direções)
  function quantize(vec, mode) {
    if (!vec) return null;
    const ang = Math.atan2(vec.y, vec.x);
    if (mode === 8) {
      const oct = Math.round(ang / (Math.PI / 4));
      const map = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      const [dx, dy] = map[((oct % 8) + 8) % 8];
      return { dx, dy };
    }
    return Math.abs(vec.x) >= Math.abs(vec.y)
      ? { dx: Math.sign(vec.x), dy: 0 }
      : { dx: 0, dy: Math.sign(vec.y) };
  }

  class GridWalker {
    /**
     * opts: { tile, tx, ty, offX, offY, stepMs, mode (4|8), walkable(tx,ty),
     *         setAnim(state, dir), feetY (0..1 origem vertical já aplicada no sprite) }
     */
    constructor(scene, sprite, opts) {
      this.scene = scene;
      this.sprite = sprite;
      Object.assign(this, {
        tile: opts.tile, tx: opts.tx, ty: opts.ty,
        offX: opts.offX || 0, offY: opts.offY || 0,
        stepMs: opts.stepMs || 260, mode: opts.mode || 4,
        walkable: opts.walkable, setAnim: opts.setAnim,
      });
      this.moving = false;
      this.wasMoving = false;
      this.dir = 's';
      sprite.setPosition(this.px(this.tx), this.py(this.ty));
      this.setAnim('idle', this.dir);
    }
    px(tx) { return this.offX + tx * this.tile + this.tile / 2; }
    py(ty) { return this.offY + ty * this.tile + this.tile / 2; }

    update(vec) {
      if (this.moving) return;
      const q = quantize(vec, this.mode);
      if (!q || (!q.dx && !q.dy)) {
        if (this.wasMoving) { this.setAnim('idle', this.dir); this.wasMoving = false; }
        return;
      }
      let { dx, dy } = q;
      this.dir = DIR_NAMES[dx + ',' + dy];
      let nx = this.tx + dx, ny = this.ty + dy;
      if (!this.walkable(nx, ny)) {
        // desliza no eixo livre (diagonal contra parede)
        if (dx && dy) {
          if (this.walkable(this.tx + dx, this.ty)) { ny = this.ty; dy = 0; nx = this.tx + dx; }
          else if (this.walkable(this.tx, this.ty + dy)) { nx = this.tx; dx = 0; ny = this.ty + dy; }
          else { this.setAnim('idle', this.dir); this.wasMoving = false; return; }
          this.dir = DIR_NAMES[dx + ',' + dy];
        } else { this.setAnim('idle', this.dir); this.wasMoving = false; return; }
      }
      this.moving = true;
      this.wasMoving = true;
      this.tx = nx; this.ty = ny;
      this.setAnim('walk', this.dir);
      const dur = (dx && dy) ? this.stepMs * 1.35 : this.stepMs;
      this.scene.tweens.add({
        targets: this.sprite,
        x: this.px(nx), y: this.py(ny),
        duration: dur,
        onComplete: () => { this.moving = false; },
      });
    }
  }

  // NPC que vagueia aleatoriamente dentro de uma área
  class Wanderer {
    constructor(scene, walker, opts = {}) {
      this.walker = walker;
      this.pauseMin = opts.pauseMin || 900;
      this.pauseMax = opts.pauseMax || 2600;
      this.vec = null;
      this.scene = scene;
      this.schedule();
    }
    schedule() {
      const delay = this.pauseMin + Math.random() * (this.pauseMax - this.pauseMin);
      this.scene.time.delayedCall(delay, () => {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], null, null];
        const d = dirs[(Math.random() * dirs.length) | 0];
        this.vec = d ? { x: d[0], y: d[1] } : null;
        this.scene.time.delayedCall(300 + Math.random() * 900, () => { this.vec = null; });
        this.schedule();
      });
    }
    update() { this.walker.update(this.vec); }
  }

  class Joystick {
    constructor(scene) {
      this.scene = scene;
      this.vec = null;
      this.pid = null;
      const mk = (r, a) => scene.add.circle(0, 0, r, 0xffffff, a)
        .setScrollFactor(0).setDepth(1e6).setVisible(false);
      this.base = mk(60, 0.12);
      this.ring = mk(60, 0).setStrokeStyle(2, 0xffffff, 0.35).setVisible(false);
      this.knob = mk(26, 0.28);
      scene.input.addPointer(2);
      scene.input.on('pointerdown', (p) => {
        if (this.pid !== null) return;
        if (p.x > scene.scale.width * 0.62) return; // lado direito = botões
        this.pid = p.id;
        [this.base, this.ring, this.knob].forEach(o => o.setVisible(true).setPosition(p.x, p.y));
        this.ox = p.x; this.oy = p.y;
      });
      scene.input.on('pointermove', (p) => {
        if (p.id !== this.pid) return;
        let dx = p.x - this.ox, dy = p.y - this.oy;
        const len = Math.hypot(dx, dy);
        if (len > 8) this.vec = { x: dx / len, y: dy / len };
        const c = Math.min(len, 54);
        this.knob.setPosition(this.ox + (dx / (len || 1)) * c, this.oy + (dy / (len || 1)) * c);
      });
      const end = (p) => {
        if (p.id !== this.pid) return;
        this.pid = null; this.vec = null;
        [this.base, this.ring, this.knob].forEach(o => o.setVisible(false));
      };
      scene.input.on('pointerup', end);
      scene.input.on('pointerupoutside', end);
    }
  }

  class ActionButton {
    constructor(scene, label, cb) {
      this.scene = scene;
      const place = () => this.reposition();
      this.circle = scene.add.circle(0, 0, 44, 0xffffff, 0.14)
        .setScrollFactor(0).setDepth(1e6).setStrokeStyle(2, 0xffffff, 0.4)
        .setInteractive({ useHandCursor: true });
      this.txt = scene.add.text(0, 0, label, { fontFamily: 'sans-serif', fontSize: '15px', color: '#fff' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(1e6).setAlpha(0.9);
      this.circle.on('pointerdown', () => {
        this.circle.setFillStyle(0xffffff, 0.35);
        scene.time.delayedCall(140, () => this.circle.setFillStyle(0xffffff, 0.14));
        cb();
      });
      place();
      scene.scale.on('resize', place);
    }
    reposition() {
      const { width, height } = this.scene.scale;
      this.circle.setPosition(width - 76, height - 86);
      this.txt.setPosition(width - 76, height - 86);
    }
  }

  // teclado (setas + WASD) -> vetor
  function keyboardVec(keys) {
    let x = 0, y = 0;
    if (keys.left.isDown || keys.a.isDown) x -= 1;
    if (keys.right.isDown || keys.d.isDown) x += 1;
    if (keys.up.isDown || keys.w.isDown) y -= 1;
    if (keys.down.isDown || keys.s.isDown) y += 1;
    return (x || y) ? { x, y } : null;
  }

  function makeKeys(scene) {
    return scene.input.keyboard.addKeys('up,down,left,right,w,a,s,d,space');
  }

  // mapa por strings: retorna { grid, w, h, find(ch) }
  function parseMap(rows) {
    const grid = rows.map(r => r.split(''));
    return {
      grid, w: grid[0].length, h: grid.length,
      each(cb) { grid.forEach((row, y) => row.forEach((ch, x) => cb(ch, x, y))); },
      at(x, y) { return (grid[y] && grid[y][x]) || '#'; },
    };
  }

  return { GridWalker, Wanderer, Joystick, ActionButton, keyboardVec, makeKeys, parseMap, quantize };
})();
