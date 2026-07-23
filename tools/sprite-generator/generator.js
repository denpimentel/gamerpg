const canvas = document.querySelector('#preview');
const ctx = canvas.getContext('2d', { alpha: true });

const elements = {
  baseWidth: document.querySelector('#baseWidth'),
  baseHeight: document.querySelector('#baseHeight'),
  scale: document.querySelector('#scale'),
  scaleValue: document.querySelector('#scaleValue'),
  anchor: document.querySelector('#anchor'),
  direction: document.querySelector('#direction'),
  directionTitle: document.querySelector('#previewTitle'),
  dimensionsBadge: document.querySelector('#dimensionsBadge'),
  layerInput: document.querySelector('#layerInput'),
  layerList: document.querySelector('#layerList'),
  emptyState: document.querySelector('#emptyState'),
  clearLayers: document.querySelector('#clearLayers'),
  resetProject: document.querySelector('#resetProject'),
  exportPng: document.querySelector('#exportPng'),
  showGrid: document.querySelector('#showGrid'),
  canvasStage: document.querySelector('#canvasStage'),
  groundLine: document.querySelector('#groundLine'),
};

const state = {
  layers: [],
  width: 64,
  height: 64,
  scale: 1,
  anchor: 'bottom-center',
  direction: 'south',
};

const directionNames = {
  south: 'Sul',
  west: 'Oeste',
  east: 'Leste',
  north: 'Norte',
};

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function syncSettings() {
  state.width = clampNumber(elements.baseWidth.value, 8, 1024, 64);
  state.height = clampNumber(elements.baseHeight.value, 8, 1024, 64);
  state.scale = clampNumber(elements.scale.value, 0.25, 4, 1);
  state.anchor = elements.anchor.value;
  state.direction = elements.direction.value;

  elements.baseWidth.value = state.width;
  elements.baseHeight.value = state.height;
  elements.scaleValue.value = `${state.scale}×`;
  elements.scaleValue.textContent = `${state.scale}×`;
  elements.dimensionsBadge.textContent = `${state.width} × ${state.height} px`;
  elements.directionTitle.textContent = directionNames[state.direction] ?? state.direction;

  canvas.width = state.width;
  canvas.height = state.height;
  render();
}

function getPlacement(image) {
  const drawWidth = image.naturalWidth * state.scale;
  const drawHeight = image.naturalHeight * state.scale;

  if (state.anchor === 'center') {
    return {
      x: (state.width - drawWidth) / 2,
      y: (state.height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    };
  }

  if (state.anchor === 'top-left') {
    return { x: 0, y: 0, width: drawWidth, height: drawHeight };
  }

  return {
    x: (state.width - drawWidth) / 2,
    y: state.height - drawHeight,
    width: drawWidth,
    height: drawHeight,
  };
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  for (const layer of state.layers) {
    if (!layer.visible || !layer.image.complete) continue;
    const placement = getPlacement(layer.image);
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(layer.image, placement.x, placement.y, placement.width, placement.height);
    ctx.restore();
  }

  renderLayerList();
}

function renderLayerList() {
  elements.layerList.innerHTML = '';
  elements.emptyState.hidden = state.layers.length > 0;

  state.layers.forEach((layer, index) => {
    const item = document.createElement('li');
    item.className = 'layer-item';

    const thumbnail = document.createElement('img');
    thumbnail.className = 'layer-thumb';
    thumbnail.src = layer.url;
    thumbnail.alt = '';

    const meta = document.createElement('div');
    meta.className = 'layer-meta';
    meta.innerHTML = `<strong>${escapeHtml(layer.name)}</strong><span>${layer.image.naturalWidth || '?'} × ${layer.image.naturalHeight || '?'} px</span>`;

    const actions = document.createElement('div');
    actions.className = 'layer-actions';
    actions.append(
      makeLayerButton(layer.visible ? '👁' : '—', layer.visible ? 'Ocultar' : 'Mostrar', () => {
        layer.visible = !layer.visible;
        render();
      }),
      makeLayerButton('↑', 'Subir camada', () => moveLayer(index, 1)),
      makeLayerButton('↓', 'Descer camada', () => moveLayer(index, -1)),
      makeLayerButton('×', 'Remover camada', () => removeLayer(index)),
    );

    item.append(thumbnail, meta, actions);
    elements.layerList.appendChild(item);
  });
}

function makeLayerButton(text, title, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'layer-button';
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', action);
  return button;
}

function moveLayer(index, offset) {
  const target = index + offset;
  if (target < 0 || target >= state.layers.length) return;
  [state.layers[index], state.layers[target]] = [state.layers[target], state.layers[index]];
  render();
}

function removeLayer(index) {
  const [layer] = state.layers.splice(index, 1);
  if (layer?.url) URL.revokeObjectURL(layer.url);
  render();
}

function clearLayers() {
  state.layers.forEach((layer) => URL.revokeObjectURL(layer.url));
  state.layers = [];
  elements.layerInput.value = '';
  render();
}

async function addFiles(fileList) {
  const files = [...fileList].filter((file) => ['image/png', 'image/webp'].includes(file.type));

  for (const file of files) {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';

    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    }).catch(() => {
      URL.revokeObjectURL(url);
    });

    if (!image.naturalWidth) continue;
    state.layers.push({
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      name: file.name,
      url,
      image,
      visible: true,
      opacity: 1,
    });
  }

  elements.layerInput.value = '';
  render();
}

function exportPng() {
  if (!state.layers.length) {
    alert('Adicione pelo menos uma camada antes de exportar.');
    return;
  }

  render();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sprite-${state.direction}-${state.width}x${state.height}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function resetProject() {
  clearLayers();
  elements.baseWidth.value = 64;
  elements.baseHeight.value = 64;
  elements.scale.value = 1;
  elements.anchor.value = 'bottom-center';
  elements.direction.value = 'south';
  syncSettings();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

[elements.baseWidth, elements.baseHeight, elements.scale, elements.anchor, elements.direction]
  .forEach((element) => element.addEventListener('input', syncSettings));

elements.layerInput.addEventListener('change', (event) => addFiles(event.target.files));
elements.clearLayers.addEventListener('click', clearLayers);
elements.resetProject.addEventListener('click', resetProject);
elements.exportPng.addEventListener('click', exportPng);
elements.showGrid.addEventListener('change', () => {
  elements.canvasStage.classList.toggle('checkerboard', elements.showGrid.checked);
});

['dragenter', 'dragover'].forEach((eventName) => {
  elements.canvasStage.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.canvasStage.classList.add('dragging');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  elements.canvasStage.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.canvasStage.classList.remove('dragging');
  });
});

elements.canvasStage.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));

syncSettings();
