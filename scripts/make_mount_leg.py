#!/usr/bin/env python3
"""Desenha a 'perninha do lado de cá' (montado) em pixel art — pose de MONTARIA.
Perfil de lado: quadril/bunda no topo (a cinturinha abaixo do cinto), coxa DOBRADA
saindo do quadril p/ frente-baixo, joelho, canela vertical e bota apontando p/ frente.
O quadril fica ATRÁS (conecta no corpo), a bota À FRENTE. Vira p/ LESTE; jogo espelha
p/ oeste. Saída: public/assets/64/player/mount_leg.png (Scale2x 2x)."""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public/assets/64/player')
os.makedirs(OUT, exist_ok=True)

# paleta amostrada do sprite (calça bege + sombra roxa; bota marrom escura)
C = {
    '.': (0, 0, 0, 0),
    'o': (0x28, 0x18, 0x20, 255),   # contorno
    'p': (0xe5, 0xe6, 0xc7, 255),   # calça highlight
    'P': (0xc4, 0xb5, 0x9f, 255),   # calça média
    's': (0x95, 0x80, 0x80, 255),   # calça sombra
    'd': (0x4d, 0x4a, 0x5d, 255),   # calça sombra profunda
    'b': (0x6b, 0x52, 0x3a, 255),   # bota
    'B': (0x8a, 0x6d, 0x4a, 255),   # bota highlight
}

# perfil de montaria (vira leste): quadril/bunda no topo-ATRÁS (col baixa=trás),
# coxa dobra p/ frente-baixo, joelho, canela vertical, bota p/ FRENTE (col alta=direita)
ART = [
    '...ooooo.........',   # 0  topo do quadril
    '..opppppo........',   # 1  quadril / bunda (a cinturinha abaixo do cinto)
    '.oppppppPo.......',   # 2  quadril
    '.oppppPPPPo......',   # 3  quadril -> coxa
    '.opppPPPPPPo.....',   # 4  coxa (grossa)
    '..opPPPPPPPPo....',   # 5  coxa desce p/ frente-baixo
    '..oopPPPPPPsdo...',   # 6  coxa
    '....ooPPPPssdo...',   # 7  joelho (dobra)
    '......oPPPsddo...',   # 8  canela topo
    '......oPPPsdo....',   # 9  canela
    '......oPPPsdo....',   # 10 canela (vertical, fina)
    '......oPPPsdo....',   # 11 canela
    '......oPPPsdo....',   # 12 canela
    '......oPPPsdo....',   # 13 canela baixa
    '......oPPPsdo....',   # 14 tornozelo
    '.....obBBBbo.....',   # 15 cano da bota
    '.....obBBBbo.....',   # 16 cano da bota
    '.....obBBBBbo....',   # 17 bota
    '.....obBBBBBbbo..',   # 18 pé começa a apontar p/ frente
    '.....obBBBBBBBbo.',   # 19 pé aponta p/ frente (direita)
    '.....oobBBBBBBBbo',   # 20 ponta do pé
    '.......ooooooooo.',   # 21 sola
]
h = len(ART)
w = max(len(r) for r in ART)
arr = np.zeros((h, w, 4), np.uint8)
for y, row in enumerate(ART):
    for x, ch in enumerate(row):
        arr[y, x] = C.get(ch, C['.'])
leg = Image.fromarray(arr)
leg = leg.crop(leg.getbbox())


def scale2x(img):
    a = np.array(img.convert('RGBA'))
    pad = np.pad(a, ((1, 1), (1, 1), (0, 0)), mode='edge')
    E, Bp, H, D, F = pad[1:-1, 1:-1], pad[0:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, 0:-2], pad[1:-1, 2:]
    eq = lambda x, y: np.all(x == y, axis=-1)
    bh, df = eq(Bp, H), eq(D, F)
    out = np.empty((a.shape[0] * 2, a.shape[1] * 2, 4), a.dtype)
    out[0::2, 0::2] = np.where((eq(Bp, D) & ~bh & ~df)[..., None], D, E)
    out[0::2, 1::2] = np.where((eq(Bp, F) & ~bh & ~df)[..., None], F, E)
    out[1::2, 0::2] = np.where((eq(H, D) & ~bh & ~df)[..., None], D, E)
    out[1::2, 1::2] = np.where((eq(H, F) & ~bh & ~df)[..., None], F, E)
    return Image.fromarray(out)


leg2 = scale2x(leg)
leg2.save(f'{OUT}/mount_leg.png')
# preview ampliado
leg2.resize((leg2.width * 6, leg2.height * 6), Image.NEAREST).save(
    '/tmp/claude-1000/-home-calney-Labfy-gamerpg/05959a59-b521-4885-9897-f924249a1615/scratchpad/leg_drawn.png')
print(f'mount_leg.png: {leg2.size}px (perna desenhada, vira leste)')
