#!/usr/bin/env python3
"""FX de skills de arma (docs/SKILLS-VFX.md) → public/assets/64/effects/.

Fontes: Slash Effect Collection (CC0, greyscale = tintável em runtime) e
Kenney Particle Pack (CC0, brancos = tintáveis) em assets/effects_research/,
mais smoke do Kenney p/ poeira. Só recorte bbox + downscale — cor fica no engine.
"""
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/effects_research'
OUT = ROOT / 'public/assets/64/effects'
SLASH = SRC / 'oga/slash_collection/Slash Effect Collection'
KENNEY = SRC / 'kenney/PNG (Transparent)'

JOBS = [  # (fonte, destino, largura_max)
    (SLASH / 'Big/Slash.png', 'fx_slash.png', 150),
    (SLASH / 'Huge/Lunge Thrust.png', 'fx_lunge.png', 190),
    (SLASH / 'Big/Circular.png', 'fx_ring.png', 160),
    (SLASH / 'Small/small_0016.png', 'fx_orb.png', 56),
    (KENNEY / 'flame_05.png', 'fx_p_fire.png', 40),
    (KENNEY / 'spark_04.png', 'fx_p_spark.png', 72),
    (KENNEY / 'star_02.png', 'fx_p_ice.png', 40),
    (KENNEY / 'smoke_07.png', 'fx_p_dust.png', 48),
]

OUT.mkdir(parents=True, exist_ok=True)
for src, dst, w in JOBS:
    im = Image.open(src).convert('RGBA')
    im = im.crop(im.getbbox())
    h = max(1, round(im.height * w / im.width))
    im = im.resize((w, h), Image.LANCZOS)
    im.save(OUT / dst)
    print(dst, im.size)
