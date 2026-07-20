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

  // Movimento livre (contínuo, px/s) com colisão AABB que desliza nas paredes.
  class FreeWalker {
    /**
     * opts: { tile, x|tx, y|ty, speed (px/s), mode (4|8), radius,
     *         walkablePx(px, py)->bool, setAnim(state, dir) }
     */
    constructor(scene, sprite, opts) {
      this.scene = scene;
      this.sprite = sprite;
      const tile = opts.tile || 64;
      this.speed = opts.speed || 90;
      this.mode = opts.mode || 8;
      this.radius = opts.radius != null ? opts.radius : 14;
      this.walkablePx = opts.walkablePx;
      this.setAnim = opts.setAnim;
      this.x = opts.x != null ? opts.x : opts.tx * tile + tile / 2;
      this.y = opts.y != null ? opts.y : opts.ty * tile + tile / 2;
      this.dir = 's';
      this.moving = false;
      sprite.setPosition(Math.round(this.x), Math.round(this.y));
      this.setAnim('idle', this.dir);
    }
    // caixa nos "pés": livre se o ponto e os 4 lados do raio couberem
    free(px, py) {
      const r = this.radius;
      return this.walkablePx(px, py)
        && this.walkablePx(px - r, py) && this.walkablePx(px + r, py)
        && this.walkablePx(px, py - r) && this.walkablePx(px, py + r);
    }
    update(vec, dt) {
      const secs = Math.min(dt || 16, 50) / 1000; // clamp evita salto após lag
      let state = 'idle';
      if (vec && (vec.x || vec.y)) {
        const len = Math.hypot(vec.x, vec.y) || 1;
        const nx = vec.x / len, ny = vec.y / len;
        const step = this.speed * secs;
        const q = quantize({ x: nx, y: ny }, this.mode);
        this.dir = DIR_NAMES[q.dx + ',' + q.dy];
        let moved = false;
        if (nx && this.free(this.x + nx * step, this.y)) { this.x += nx * step; moved = true; }
        if (ny && this.free(this.x, this.y + ny * step)) { this.y += ny * step; moved = true; }
        if (moved) this.sprite.setPosition(Math.round(this.x), Math.round(this.y));
        state = moved ? 'walk' : 'idle';
      }
      this.moving = state === 'walk';
      this.setAnim(state, this.dir);
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
        this.scene.time.delayedCall(500 + Math.random() * 1400, () => { this.vec = null; });
        this.schedule();
      });
    }
    update(dt) { this.walker.update(this.vec, dt); }
  }

  // Vagueia dentro de um raio do ponto de nascença, com atração elástica de volta:
  // quanto mais longe do "home", mais o próximo passeio puxa na direção do spot.
  class HomeWanderer {
    /** opts: { radius (px), moveMin, moveMax, pauseMin, pauseMax, pauseChance } */
    constructor(scene, walker, opts = {}) {
      this.scene = scene;
      this.walker = walker;
      this.home = { x: walker.x, y: walker.y };
      this.radius = opts.radius || 150;
      this.moveMin = opts.moveMin || 600;
      this.moveMax = opts.moveMax || 1500;
      this.pauseMin = opts.pauseMin || 500;
      this.pauseMax = opts.pauseMax || 1500;
      this.pauseChance = opts.pauseChance != null ? opts.pauseChance : 0.28;
      this.vec = null;
      this.next();
    }
    next() {
      if (Math.random() < this.pauseChance) {
        this.vec = null;
        const d = this.pauseMin + Math.random() * (this.pauseMax - this.pauseMin);
        this.scene.time.delayedCall(d, () => this.next());
        return;
      }
      // vetor até o spot de nascença
      const hx = this.home.x - this.walker.x, hy = this.home.y - this.walker.y;
      const dist = Math.hypot(hx, hy) || 1;
      const pull = Math.min(dist / this.radius, 1); // 0 no centro, 1 na borda
      const k = pull * pull;                        // acentua o retorno perto da borda
      const a = Math.random() * Math.PI * 2;
      let vx = Math.cos(a) * (1 - k) + (hx / dist) * k * 1.6;
      let vy = Math.sin(a) * (1 - k) + (hy / dist) * k * 1.6;
      const l = Math.hypot(vx, vy) || 1;
      this.vec = { x: vx / l, y: vy / l };
      const d = this.moveMin + Math.random() * (this.moveMax - this.moveMin);
      this.scene.time.delayedCall(d, () => this.next());
    }
    update(dt) { this.walker.update(this.vec, dt); }
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

  return { GridWalker, FreeWalker, Wanderer, HomeWanderer, Joystick, ActionButton, keyboardVec, makeKeys, parseMap, quantize };
})();
