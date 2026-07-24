/* Death Knight basic integration.
 * Rebuilds the uploaded 128px source sheets into aligned 92px sheets at runtime,
 * then applies a minimal boss treatment without changing the base game code.
 */
(function () {
  'use strict';

  const CELL = 92;
  const CONTENT = 88;
  const BASELINE = 90;
  const ROOT = '../assets/64/creatures/neve/ghost_knight/';
  const DIRECTIONS = ['n', 'w', 's', 'e'];
  const SOURCE_ROW = { n: 1, w: 0, s: 2, e: 3 };
  const ROW_INDEX = { n: 0, w: 1, s: 2, e: 3 };

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Falha ao carregar ' + url));
      image.src = url;
    });
  }

  function findComponents(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const width = canvas.width;
    const height = canvas.height;
    const visited = new Uint8Array(width * height);
    const components = [];
    const neighbors = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];

    for (let start = 0; start < visited.length; start += 1) {
      if (visited[start] || pixels[start * 4 + 3] <= 12) continue;
      const stack = [start];
      visited[start] = 1;
      let area = 0;
      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;

      while (stack.length) {
        const index = stack.pop();
        const x = index % width;
        const y = Math.floor(index / width);
        area += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        for (const offset of neighbors) {
          const next = index + offset;
          if (next < 0 || next >= visited.length || visited[next]) continue;
          const nx = next % width;
          const ny = Math.floor(next / width);
          if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue;
          if (pixels[next * 4 + 3] <= 12) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }

      if (area >= 300) {
        components.push({
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          area,
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
        });
      }
    }
    return components;
  }

  function groupRows(components) {
    const rows = [[], [], [], []];
    for (const component of components) {
      const row = Math.max(0, Math.min(3, Math.floor(component.centerY / 128)));
      rows[row].push(component);
    }
    rows.forEach(row => row.sort((a, b) => a.centerX - b.centerX));
    return rows;
  }

  function normalizeFrames(frames) {
    const maxWidth = Math.max(...frames.map(frame => frame.width));
    const maxHeight = Math.max(...frames.map(frame => frame.height));
    const scale = Math.min(CONTENT / maxWidth, CONTENT / maxHeight);
    return frames.map(frame => ({
      source: frame,
      width: Math.max(1, Math.round(frame.width * scale)),
      height: Math.max(1, Math.round(frame.height * scale)),
    }));
  }

  function buildSheet(image, action, columns) {
    const rows = groupRows(findComponents(image));
    const outputRows = action === 'idle' ? 1 : 4;
    const canvas = document.createElement('canvas');
    canvas.width = CELL * columns;
    canvas.height = CELL * outputRows;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;

    DIRECTIONS.forEach((direction, outputRow) => {
      const sourceFrames = rows[SOURCE_ROW[direction]].slice();
      let chosen;
      if (action === 'idle') {
        chosen = [sourceFrames[Math.min(1, sourceFrames.length - 1)]];
      } else {
        chosen = sourceFrames.slice(0, columns);
        while (chosen.length < columns && chosen.length) chosen.push(chosen[chosen.length - 1]);
      }
      if (!chosen.length) throw new Error('Nenhum frame encontrado: ' + action + '/' + direction);

      const normalized = normalizeFrames(chosen);
      normalized.forEach((frame, column) => {
        const targetRow = action === 'idle' ? 0 : outputRow;
        const dx = column * CELL + Math.floor((CELL - frame.width) / 2);
        const dy = targetRow * CELL + BASELINE - frame.height;
        const source = frame.source;
        context.drawImage(
          image,
          source.x, source.y, source.width, source.height,
          dx, dy, frame.width, frame.height
        );
      });
    });
    return canvas.toDataURL('image/png');
  }

  function patchPhaser(assets) {
    const loaderPrototype = Phaser.Loader.LoaderPlugin.prototype;
    const originalSpritesheet = loaderPrototype.spritesheet;
    loaderPrototype.spritesheet = function (key, url, config) {
      if (key === 'aighost_knight-idle')
        return originalSpritesheet.call(this, key, assets.idle, { frameWidth: CELL, frameHeight: CELL });
      if (key === 'aighost_knight-walk')
        return originalSpritesheet.call(this, key, assets.walk, { frameWidth: CELL, frameHeight: CELL });
      if (key === 'aighost_knight-attack')
        return originalSpritesheet.call(this, key, assets.attack, { frameWidth: CELL, frameHeight: CELL });
      return originalSpritesheet.call(this, key, url, config);
    };

    const factoryPrototype = Phaser.GameObjects.GameObjectFactory.prototype;
    const originalSprite = factoryPrototype.sprite;
    factoryPrototype.sprite = function (x, y, texture, frame) {
      const sprite = originalSprite.call(this, x, y, texture, frame);
      if (texture === 'aighost_knight-idle') {
        sprite.__deathKnightBoss = true;
        sprite.setScale(1.34);
      }
      return sprite;
    };

    const originalText = factoryPrototype.text;
    factoryPrototype.text = function (x, y, text, style) {
      if (text === 'Cavaleiro Fantasma ✦IA') {
        text = 'Cavaleiro da Morte · CHEFE DO GELO';
        y = -88;
        style = Object.assign({}, style || {}, {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#b9f6ff',
          stroke: '#06131a',
          strokeThickness: 4,
        });
      }
      return originalText.call(this, x, y, text, style);
    };
  }

  function cardinal(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
    return dy >= 0 ? 's' : 'n';
  }

  function installBossRuntime() {
    const scene = window.__scene;
    if (!scene || scene.__deathKnightBasicInstalled || !scene.foes) return false;
    const boss = scene.foes.find(foe => foe && foe.spr &&
      (foe.spr.__deathKnightBoss || String(foe.spr.texture && foe.spr.texture.key).includes('aighost_knight')));
    if (!boss) return false;

    scene.__deathKnightBasicInstalled = true;
    boss.isBoss = true;

    for (const [direction, row] of Object.entries(ROW_INDEX)) {
      const key = 'death-knight-attack-' + direction;
      if (!scene.anims.exists(key)) {
        scene.anims.create({
          key,
          frameRate: 12,
          repeat: 0,
          frames: scene.anims.generateFrameNumbers('aighost_knight-attack', {
            start: row * 8,
            end: row * 8 + 7,
          }),
        });
      }
    }

    const normalWanderUpdate = boss.wander && boss.wander.update
      ? boss.wander.update.bind(boss.wander) : null;
    if (normalWanderUpdate) {
      boss.wander.update = function (delta) {
        if (boss.__attackingUntil && scene.time.now < boss.__attackingUntil) return;
        return normalWanderUpdate(delta);
      };
    }

    const normalStrike = scene.mobStrike.bind(scene);
    scene.mobStrike = function (foe) {
      if (foe !== boss) return normalStrike(foe);
      const hpBefore = scene.P.hp;
      const direction = cardinal(foe.walker, scene.player);
      boss.__attackingUntil = scene.time.now + 680;
      normalStrike(foe);
      scene.setHp(Math.max(0, hpBefore - 8));
      foe.spr.play('death-knight-attack-' + direction, true);
      foe.spr.once('animationcomplete', function () {
        if (!foe.spr.active) return;
        foe.spr.anims.stop();
        foe.spr.setTexture('aighost_knight-idle', ROW_INDEX[direction]);
      });
    };

    console.info('[DeathKnight] Teste básico instalado no bioma de neve.');
    return true;
  }

  window.__deathKnightReady = (async function () {
    const cache = '?v=dk-basic-1';
    const [idleSource, walkSource, attackSource] = await Promise.all([
      loadImage(ROOT + 'idle.png' + cache),
      loadImage(ROOT + 'walk.png' + cache),
      loadImage(ROOT + 'attack.png' + cache),
    ]);
    const assets = {
      idle: buildSheet(idleSource, 'idle', 4),
      walk: buildSheet(walkSource, 'walk', 6),
      attack: buildSheet(attackSource, 'attack', 8),
    };
    patchPhaser(assets);
    const timer = setInterval(function () {
      if (installBossRuntime()) clearInterval(timer);
    }, 50);
    setTimeout(function () { clearInterval(timer); }, 15000);
  })();
})();