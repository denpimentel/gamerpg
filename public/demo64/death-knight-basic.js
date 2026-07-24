/* Death Knight basic integration v3.
 * Extracts the real transparent figures from the uploaded AI sheets and rebuilds
 * them into large 192x192 cells. This avoids 64/92px compression and frame bleed.
 */
(function () {
  'use strict';

  const CELL = 192;
  const BASELINE = 180;
  const ALPHA_MIN = 12;
  const MAIN_AREA = 1000;
  const MIN_PARTICLE_AREA = 5;
  const ROOT = '../assets/64/creatures/neve/ghost_knight/';
  const SOURCE_ROW = { n: 1, w: 0, s: 2, e: 3 };
  const OUTPUT_ROW = { n: 0, w: 1, s: 2, e: 3 };
  const ACTIONS = {
    idle: { columns: 4, fps: 6 },
    walk: { columns: 6, fps: 10 },
    attack: { columns: 8, fps: 12 },
  };

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Falha ao carregar ' + url));
      image.src = url;
    });
  }

  function analyze(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const labels = new Int32Array(width * height);
    labels.fill(-1);
    const components = [];
    let componentId = 0;

    for (let start = 0; start < width * height; start += 1) {
      if (labels[start] !== -1 || pixels[start * 4 + 3] <= ALPHA_MIN) continue;

      const stack = [start];
      labels[start] = componentId;
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

        const y0 = Math.max(0, y - 1);
        const y1 = Math.min(height - 1, y + 1);
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(width - 1, x + 1);
        for (let ny = y0; ny <= y1; ny += 1) {
          for (let nx = x0; nx <= x1; nx += 1) {
            const next = ny * width + nx;
            if (labels[next] !== -1 || pixels[next * 4 + 3] <= ALPHA_MIN) continue;
            labels[next] = componentId;
            stack.push(next);
          }
        }
      }

      components.push({
        id: componentId,
        area,
        x: minX,
        y: minY,
        x2: maxX + 1,
        y2: maxY + 1,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      });
      componentId += 1;
    }

    return { imageData, labels, components, width, height };
  }

  function sourceBand(component, rowHeight) {
    return Math.max(0, Math.min(3, Math.floor(component.centerY / rowHeight)));
  }

  function chooseMainFrames(analysis, columns) {
    const rowHeight = analysis.height / 4;
    const rows = [[], [], [], []];
    analysis.components
      .filter(component => component.area >= MAIN_AREA)
      .forEach(component => rows[sourceBand(component, rowHeight)].push(component));
    rows.forEach(row => row.sort((a, b) => a.centerX - b.centerX));

    rows.forEach(row => {
      if (!row.length) throw new Error('Linha sem frames no spritesheet do Cavaleiro da Morte.');
      while (row.length < columns) row.push(row[row.length - 1]);
      if (row.length > columns) row.length = columns;
    });
    return rows;
  }

  function assignParts(analysis, mainRows) {
    const rowHeight = analysis.height / 4;
    const assignments = new Map();
    mainRows.flat().forEach(main => assignments.set(main.id, new Set([main.id])));

    for (const component of analysis.components) {
      if (component.area < MIN_PARTICLE_AREA || assignments.has(component.id)) continue;
      const row = sourceBand(component, rowHeight);
      let nearest = null;
      let nearestDistance = Infinity;
      for (const main of mainRows[row]) {
        const dx = component.centerX - main.centerX;
        const dy = component.centerY - main.centerY;
        const distance = Math.hypot(dx, dy * 1.3);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = main;
        }
      }
      if (nearest && nearestDistance <= 120) assignments.get(nearest.id).add(component.id);
    }
    return assignments;
  }

  function renderFrame(analysis, ids) {
    const selected = analysis.components.filter(component => ids.has(component.id));
    const x = Math.min(...selected.map(component => component.x));
    const y = Math.min(...selected.map(component => component.y));
    const x2 = Math.max(...selected.map(component => component.x2));
    const y2 = Math.max(...selected.map(component => component.y2));

    const width = x2 - x;
    const height = y2 - y;
    const frame = document.createElement('canvas');
    frame.width = width;
    frame.height = height;
    const frameContext = frame.getContext('2d');
    const output = frameContext.createImageData(width, height);

    for (let sy = y; sy < y2; sy += 1) {
      for (let sx = x; sx < x2; sx += 1) {
        const sourceIndex = sy * analysis.width + sx;
        if (!ids.has(analysis.labels[sourceIndex])) continue;
        const targetIndex = ((sy - y) * width + (sx - x)) * 4;
        const pixelIndex = sourceIndex * 4;
        output.data[targetIndex] = analysis.imageData.data[pixelIndex];
        output.data[targetIndex + 1] = analysis.imageData.data[pixelIndex + 1];
        output.data[targetIndex + 2] = analysis.imageData.data[pixelIndex + 2];
        output.data[targetIndex + 3] = analysis.imageData.data[pixelIndex + 3];
      }
    }
    frameContext.putImageData(output, 0, 0);
    return frame;
  }

  function buildSheet(image, action) {
    const config = ACTIONS[action];
    const analysis = analyze(image);
    const mainRows = chooseMainFrames(analysis, config.columns);
    const assignments = assignParts(analysis, mainRows);
    const output = document.createElement('canvas');
    output.width = CELL * config.columns;
    output.height = CELL * 4;
    const outputContext = output.getContext('2d');
    outputContext.imageSmoothingEnabled = false;

    for (const [direction, sourceRow] of Object.entries(SOURCE_ROW)) {
      const targetRow = OUTPUT_ROW[direction];
      mainRows[sourceRow].forEach((main, column) => {
        const ids = assignments.get(main.id) || new Set([main.id]);
        const frame = renderFrame(analysis, ids);
        const maxWidth = CELL - 12;
        const maxHeight = CELL - 14;
        const scale = Math.min(1, maxWidth / frame.width, maxHeight / frame.height);
        const drawWidth = Math.max(1, Math.round(frame.width * scale));
        const drawHeight = Math.max(1, Math.round(frame.height * scale));
        const dx = column * CELL + Math.round((CELL - drawWidth) / 2);
        const dy = targetRow * CELL + BASELINE - drawHeight;
        outputContext.drawImage(frame, dx, dy, drawWidth, drawHeight);
      });
    }
    return output.toDataURL('image/png');
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
      if (texture === 'aighost_knight-idle') frame = OUTPUT_ROW.s * ACTIONS.idle.columns;
      const sprite = originalSprite.call(this, x, y, texture, frame);
      if (texture === 'aighost_knight-idle') {
        sprite.__deathKnightBoss = true;
        sprite.setOrigin(0.5, BASELINE / CELL).setScale(0.9);
      }
      return sprite;
    };

    const originalText = factoryPrototype.text;
    factoryPrototype.text = function (x, y, text, style) {
      if (text === 'Cavaleiro Fantasma ✦IA') {
        text = 'Cavaleiro da Morte · CHEFE DO GELO';
        y = -102;
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

  function cardinalDirection(direction) {
    if (direction === 'n' || direction === 's' || direction === 'e' || direction === 'w') return direction;
    if (direction && direction.includes('s')) return 's';
    if (direction && direction.includes('n')) return 'n';
    if (direction && direction.includes('e')) return 'e';
    return 'w';
  }

  function directionToPlayer(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'e' : 'w';
    return dy >= 0 ? 's' : 'n';
  }

  function installBossRuntime() {
    const scene = window.__scene;
    if (!scene || scene.__deathKnightBasicInstalled || !Array.isArray(scene.foes)) return false;
    const boss = scene.foes.find(foe => foe && foe.spr &&
      String(foe.spr.texture && foe.spr.texture.key).includes('aighost_knight'));
    if (!boss) return false;

    scene.__deathKnightBasicInstalled = true;
    boss.isBoss = true;
    boss.hp = 120;
    boss.maxHp = 120;
    boss.damage = 8;

    for (const [direction, row] of Object.entries(OUTPUT_ROW)) {
      for (const [action, config] of Object.entries(ACTIONS)) {
        const key = `death-knight-${action}-${direction}`;
        if (!scene.anims.exists(key)) {
          scene.anims.create({
            key,
            frameRate: config.fps,
            repeat: action === 'attack' ? 0 : -1,
            frames: scene.anims.generateFrameNumbers(`aighost_knight-${action}`, {
              start: row * config.columns,
              end: row * config.columns + config.columns - 1,
            }),
          });
        }
      }
    }

    boss.walker.setAnim = function (state, direction) {
      const cardinal = cardinalDirection(direction);
      const action = state === 'walk' ? 'walk' : 'idle';
      boss.spr.play(`death-knight-${action}-${cardinal}`, true);
      boss.cont.setDepth(boss.cont.y);
    };
    boss.walker.setAnim('idle', 's');

    const normalStrike = scene.mobStrike.bind(scene);
    scene.mobStrike = function (foe) {
      if (foe !== boss) return normalStrike(foe);
      const hpBefore = scene.P.hp;
      const direction = directionToPlayer(foe.walker, scene.player);
      normalStrike(foe);
      scene.setHp(Math.max(0, hpBefore - 8));
      foe.spr.play(`death-knight-attack-${direction}`, true);
      foe.spr.once('animationcomplete', function () {
        if (!foe.spr || !foe.spr.active) return;
        foe.walker.setAnim(foe.walker.moving ? 'walk' : 'idle', direction);
      });
    };

    console.info('[DeathKnight] v3: frames grandes 192x192, sem compressão para 64/92.');
    return true;
  }

  window.__deathKnightReady = (async function () {
    const cache = '?v=dk-large-v3';
    const [idleImage, walkImage, attackImage] = await Promise.all([
      loadImage(ROOT + 'idle.png' + cache),
      loadImage(ROOT + 'walk.png' + cache),
      loadImage(ROOT + 'attack.png' + cache),
    ]);
    const assets = {
      idle: buildSheet(idleImage, 'idle'),
      walk: buildSheet(walkImage, 'walk'),
      attack: buildSheet(attackImage, 'attack'),
    };
    patchPhaser(assets);
    const timer = setInterval(function () {
      if (installBossRuntime()) clearInterval(timer);
    }, 50);
    setTimeout(function () { clearInterval(timer); }, 15000);
  })();
})();
