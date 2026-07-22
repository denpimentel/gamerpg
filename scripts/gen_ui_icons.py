#!/usr/bin/env python3
"""Ícones pixel-art da UI, desenhados por código (CC0 próprio). Saída em ui/px/."""
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
OUT = BASE / 'public/assets/64/ui/px'
os.makedirs(OUT, exist_ok=True)


def render(grid, palette, name, scale=1):
    h = len(grid)
    w = max(len(r) for r in grid)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if ch in palette:
                px[x, y] = palette[ch]
    if scale != 1:
        im = im.resize((w * scale, h * scale), Image.NEAREST)
    im.save(f'{OUT}/{name}.png')


# — coração cheio (9x8) — . vazio  o contorno  X vermelho  h brilho
HEART = [
    '.oo.oo...',
    'ohhXoXX o'.replace(' ', 'o'),
    'oXhXXXXXo',
    'oXXXXXXXo',
    '.oXXXXXo.',
    '..oXXXo..',
    '...oXo...',
    '....o....',
]
pal_heart = {'o': (60, 12, 20, 255), 'X': (226, 42, 60, 255), 'h': (255, 150, 160, 255)}
render(HEART, pal_heart, 'heart_full')

# — coração vazio (só contorno) —
HEART_E = [
    '.oo.oo...',
    'o..o..o.o',
    'o.....o.o',
    'o......o.'.replace('.', 'o', 0),
    '.o.....o.',
    '..o...o..',
    '...o.o...',
    '....o....',
]
HEART_E = [
    '.oo.oo...',
    'o..o..o..',
    'o.....o..',
    'o.....o..',
    '.o....o..',
    '..o..o...',
    '...oo....',
    '....o....',
]
pal_e = {'o': (70, 40, 48, 255)}
render(HEART_E, pal_e, 'heart_empty')

# — moeda de ouro (9x9) —
COIN = [
    '..ooooo..',
    '.oYYYYYo.',
    'oYYhhhYYo',
    'oYhYYYhYo',
    'oYhYSYhYo',
    'oYhYYYhYo',
    'oYYhhhYYo',
    '.oYYYYYo.',
    '..ooooo..',
]
pal_coin = {'o': (120, 84, 10, 255), 'Y': (240, 190, 60, 255),
            'h': (255, 232, 150, 255), 'S': (180, 130, 30, 255)}
render(COIN, pal_coin, 'coin')

# — gema/cristal azul (9x9) losango (idade/nível) —
GEM = [
    '....o....',
    '...oCo...',
    '..oCCCo..',
    '.oChCCCo.',
    'oCCCCCCCo',
    '.oCCCCCo.',
    '..oCCCo..',
    '...oCo...',
    '....o....',
]
pal_gem = {'o': (20, 40, 80, 255), 'C': (90, 180, 240, 255), 'h': (200, 240, 255, 255)}
render(GEM, pal_gem, 'gem')

print('ícones px:', sorted(os.listdir(OUT)))
