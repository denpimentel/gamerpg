#!/usr/bin/env python3
"""Remove o fundo de grama da casa gerada por IA e recorta o bounding box.
Estratégia: máscara de 'verde grama' (G dominante, B baixo) + flood-fill a partir
das bordas — só o fundo conectado à borda vira transparente, buracos internos ficam."""
import os
import numpy as np
from PIL import Image
from collections import deque

from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SRC = BASE / 'assets/ai_house/house_raw.png'
OUT_DIR = BASE / 'public/assets/64/buildings'
SCRATCH = BASE / '.ai_raw'
os.makedirs(SCRATCH, exist_ok=True)

im = Image.open(SRC).convert('RGBA')
a = np.array(im)
r, g, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)

# máscara "grama" amarelo-esverdeada: G >= R (não é madeira, que tem R>G) e B bem
# abaixo de G (não é telhado/toldo/bandeira, que têm B alto). Cobre o limão claro E as ondas.
grass = (g >= r - 6) & (b < g - 28) & (b < 150)

# flood-fill 4-conexo a partir de todas as bordas, restrito à máscara grama
H, W = grass.shape
bg = np.zeros((H, W), bool)
dq = deque()
for x in range(W):
    for y in (0, H - 1):
        if grass[y, x] and not bg[y, x]:
            bg[y, x] = True; dq.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if grass[y, x] and not bg[y, x]:
            bg[y, x] = True; dq.append((y, x))
while dq:
    y, x = dq.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < H and 0 <= nx < W and grass[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; dq.append((ny, nx))

out = a.copy()
out[bg, 3] = 0

# erode 1px na borda do sujeito p/ tirar a franja verde do anti-alias
subj = ~bg
er = subj.copy()
er[1:, :] &= subj[:-1, :]; er[:-1, :] &= subj[1:, :]
er[:, 1:] &= subj[:, :-1]; er[:, :-1] &= subj[:, 1:]
fringe = subj & ~er
out[fringe, 3] = 0

res = Image.fromarray(out).crop(Image.fromarray(out).getbbox())

# downscale de qualidade para o tamanho de jogo: ~8 tiles de largura (castelo é grande)
TILES_W = 8
target_w = TILES_W * 64
target_h = round(res.height * target_w / res.width)
res = res.resize((target_w, target_h), Image.LANCZOS)
# limpa a franja semitransparente que o LANCZOS deixa (alpha < 128 -> some)
arr = np.array(res); arr[arr[:, :, 3] < 128, 3] = 0; arr[arr[:, :, 3] >= 128, 3] = 255
res = Image.fromarray(arr)
os.makedirs(OUT_DIR, exist_ok=True)
res.save(f'{OUT_DIR}/casa_azul.png')

# sombra elíptica no chão (ancorar a casa; a arte IA não trazia sombra projetada)
from PIL import ImageDraw, ImageFilter
sh = Image.new('RGBA', res.size, (0, 0, 0, 0))
d = ImageDraw.Draw(sh)
sw, sy = int(res.width * 0.7), int(res.height * 0.10)
d.ellipse([(res.width - sw) // 2, res.height - sy - 6, (res.width + sw) // 2, res.height - 6],
          fill=(20, 30, 15, 120))
sh = sh.filter(ImageFilter.GaussianBlur(6))
sh.save(f'{OUT_DIR}/casa_azul_shadow.png')

# preview sobre a grama REAL do jogo (Tiny Swords) + sombra
tile = Image.open(BASE / 'public/assets/64/terrain/campo_deserto.png').convert('RGBA').crop((64, 64, 128, 128))
bgp = Image.new('RGBA', (res.width + 160, res.height + 120), (0, 0, 0, 0))
for yy in range(0, bgp.height, 64):
    for xx in range(0, bgp.width, 64):
        bgp.alpha_composite(tile, (xx, yy))
bgp.alpha_composite(sh, (80, 40))
bgp.alpha_composite(res, (80, 40))
bgp.save(SCRATCH / 'house_ongrass.png')

print(f'casa final: {res.size}px  =>  {res.width/64:.1f} × {res.height/64:.1f} tiles')
