#!/usr/bin/env python3
"""Reorganiza public/assets/64 numa estrutura por bioma + upscale 2x (Scale2x) dos
monstros pixelados. Idempotente: reconstrói a árvore 'nova' a partir das pastas atuais.

Estrutura final:
  terrain/    atlases de chão/água (compartilhados)
  props/      decoração + árvores (por bioma quando faz sentido)
  creatures/<bioma>/<nome>/{idle,walk}.png
  player/equip/<camada>/<anim>.png  +  player/hero_ia/{idle,walk}.png
  ui/icons/
  _source/    originais 64px e artefatos IA (não carregados em runtime)
"""
import os
import re
import shutil
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'public/assets/64')


def scale2x_img(img):
    a = np.array(img.convert('RGBA'))
    pad = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    E, B, H_, D, F = pad[1:-1, 1:-1], pad[0:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, 0:-2], pad[1:-1, 2:]
    eq = lambda x, y: np.all(x == y, axis=-1)
    bh, df = eq(B, H_), eq(D, F)
    out = np.empty((a.shape[0] * 2, a.shape[1] * 2, 4), a.dtype)
    out[0::2, 0::2] = np.where((eq(B, D) & ~bh & ~df)[..., None], D, E)
    out[0::2, 1::2] = np.where((eq(B, F) & ~bh & ~df)[..., None], F, E)
    out[1::2, 0::2] = np.where((eq(H_, D) & ~bh & ~df)[..., None], D, E)
    out[1::2, 1::2] = np.where((eq(H_, F) & ~bh & ~df)[..., None], F, E)
    return Image.fromarray(out)


def scale2x_sheet(src, dst, fw, fh):
    """Scale2x quadro a quadro (evita vazamento entre frames colados)."""
    im = Image.open(src).convert('RGBA')
    cols, rows = im.width // fw, im.height // fh
    out = Image.new('RGBA', (im.width * 2, im.height * 2), (0, 0, 0, 0))
    for r in range(rows):
        for c in range(cols):
            frame = im.crop((c * fw, r * fh, c * fw + fw, r * fh + fh))
            out.paste(scale2x_img(frame), (c * fw * 2, r * fh * 2))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    out.save(dst)


def cp(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)


def cp_scale2x_single(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    scale2x_img(Image.open(src)).save(dst)


N = os.path.join(A, '_new')            # árvore nova (depois vira a definitiva)
if os.path.exists(N):
    shutil.rmtree(N)

# ---------- TERRAIN ----------
cp(f'{A}/Water.png', f'{N}/terrain/water.png')
cp(f'{A}/Foam.png', f'{N}/terrain/foam.png')
cp(f'{A}/Bridge_All.png', f'{N}/terrain/bridge.png')
cp(f'{A}/Shadows.png', f'{N}/terrain/shadows.png')
cp(f'{A}/Rocks_01.png', f'{N}/terrain/rocks_01.png')
cp(f'{A}/Rocks_02.png', f'{N}/terrain/rocks_02.png')
cp(f'{A}/Tilemap_Flat.png', f'{N}/terrain/campo_deserto.png')   # grama (col 0-2) + areia (col 5-7)
cp(f'{A}/Tilemap_Elevation.png', f'{N}/terrain/pedra.png')
cp(f'{A}/ai/Tilemap_Snow.png', f'{N}/terrain/neve.png')         # recolor do campo_deserto

# ---------- PROPS ----------
cp(f'{A}/Tree.png', f'{N}/props/tree_campo.png')
cp(f'{A}/ai/tree.png', f'{N}/props/tree_neve.png')
for i in range(1, 20):
    n = f'{i:02d}'
    if os.path.exists(f'{A}/deco/{n}.png'):
        cp(f'{A}/deco/{n}.png', f'{N}/props/deco/{n}.png')

# ---------- CREATURES (PA monsters: Scale2x 2x, frame a frame) ----------
# (bioma, nome, pasta_enemies, fw, fh, arq_idle, arq_walk|None)
PA = [
    ('campo', 'chicken', 'Chicken', 32, 34, 'Idle (32x34).png', 'Run (32x34).png'),
    ('campo', 'bunny', 'Bunny', 34, 44, 'Idle (34x44).png', 'Run (34x44).png'),
    ('campo', 'bee', 'Bee', 36, 34, 'Idle (36x34).png', None),
    ('campo', 'slime', 'Slime', 44, 30, 'Idle-Run (44x30).png', None),
    ('deserto', 'snail', 'Snail', 38, 24, 'Idle (38x24).png', 'Walk (38x24).png'),
    ('deserto', 'rino', 'Rino', 52, 34, 'Idle (52x34).png', 'Run (52x34).png'),
    ('deserto', 'angrypig', 'AngryPig', 36, 30, 'Idle (36x30).png', 'Walk (36x30).png'),
    ('deserto', 'trunk', 'Trunk', 64, 32, 'Idle (64x32).png', 'Run (64x32).png'),
    ('pedra', 'bat', 'Bat', 46, 30, 'Idle (46x30).png', 'Flying (46x30).png'),
    ('pedra', 'ghost', 'Ghost', 44, 30, 'Idle (44x30).png', None),
    ('pedra', 'mushroom', 'Mushroom', 32, 32, 'Idle (32x32).png', 'Run (32x32).png'),
    ('pedra', 'radish', 'Radish', 30, 38, 'Idle 1 (30x38).png', 'Run (30x38).png'),
]
for bioma, nome, folder, fw, fh, idle, walk in PA:
    base = f'{N}/creatures/{bioma}/{nome}'
    scale2x_sheet(f'{A}/enemies/{folder}/{idle}', f'{base}/idle.png', fw, fh)
    if walk:
        scale2x_sheet(f'{A}/enemies/{folder}/{walk}', f'{base}/walk.png', fw, fh)

# AI mobs (já suaves em 92px — copiar sem upscale)
for nome in ('yeti', 'golem', 'wolf'):
    cp(f'{A}/ai/{nome}_idle.png', f'{N}/creatures/neve/{nome}/idle.png')
    cp(f'{A}/ai/{nome}_walk.png', f'{N}/creatures/neve/{nome}/walk.png')

# Goblins Tiny Swords (sheets 192px inteiros)
cp(f'{A}/Torch_Red.png', f'{N}/creatures/pedra/goblin_tocha/sheet.png')
cp(f'{A}/TNT_Red.png', f'{N}/creatures/deserto/goblin_tnt/sheet.png')
# Ovelha (comum a todos)
cp(f'{A}/HappySheep_Idle.png', f'{N}/creatures/common/sheep/idle.png')

# ---------- PLAYER ----------
for layer in os.listdir(f'{A}/lpc2x'):
    src = f'{A}/lpc2x/{layer}'
    if os.path.isdir(src):
        for f in os.listdir(src):
            cp(f'{src}/{f}', f'{N}/player/equip/{layer}/{f}')
cp(f'{A}/ai/hero_idle.png', f'{N}/player/hero_ia/idle.png')
cp(f'{A}/ai/hero_walk.png', f'{N}/player/hero_ia/walk.png')

# ---------- UI ----------
for f in os.listdir(f'{A}/icons'):
    cp(f'{A}/icons/{f}', f'{N}/ui/icons/{f}')

# ---------- _SOURCE (não runtime: originais 64px + pipeline PixelLab intacto) ----------
shutil.copytree(f'{A}/lpc', f'{N}/_source/lpc_64')   # originais 64px do paper doll (upscale reprodutível)
shutil.copytree(f'{A}/ai', f'{N}/_source/ai_gen')    # estado/raw/wang/sheets do PixelLab (gen_neve.py)

print('árvore nova montada em', os.path.relpath(N, ROOT))
# resumo
for d in sorted(os.listdir(N)):
    nfiles = sum(len(fs) for _, _, fs in os.walk(f'{N}/{d}'))
    print(f'  {d}/  ({nfiles} arquivos)')
