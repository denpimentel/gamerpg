#!/usr/bin/env python3
"""Pipeline genérico: transforma um BICHO DO JOGO em MONTARIA via PixelLab.

Uso:
  python3 scripts/gen_montaria.py slime \
    --desc "big round green slime blob mount, large enough for a knight to sit on top, cute face, gooey" \
    --ref public/assets/64/creatures/campo/slime/idle.png --ref-fw 88 --ref-fh 60 \
    --anim-desc "squishy bouncing hop moving forward, body squashes down then stretches up"

O sprite original entra como REFERÊNCIA de identidade visual (direção sul) + paleta
forçada; a IA completa as 4 direções e a animação de andar (v3, 6 frames).
Saída: public/assets/64/player/mount/<nome>/{idle,walk}.png + meta.json + ícone
ui/icons/mount_<nome>.png — mesmo formato do porco (AI_MOUNTS).
Idempotente: estado em _source/ai_gen/state.json (chaves mount_<nome>).
"""
import argparse
import base64
import io
import json
import os
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI = os.path.join(ROOT, 'public/assets/64/_source/ai_gen')
STATE_F = os.path.join(AI, 'state.json')
API = 'https://api.pixellab.ai/v2'

E = {}
for ln in open(os.path.join(ROOT, '.env')):
    ln = ln.strip()
    if ln and not ln.startswith('#') and '=' in ln:
        k, v = ln.split('=', 1)
        E[k.strip()] = v.strip().strip('"')
KEYS = dict(p.split(':', 1) for p in E['PIXELLAB_KEYS'].split(';'))


def call(keyname, method, path, body=None, timeout=300):
    req = urllib.request.Request(API + path,
        headers={'Authorization': f'Bearer {KEYS[keyname]}', 'Content-Type': 'application/json'},
        data=json.dumps(body).encode() if body is not None else None, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]


def remaining(k):
    st, d = call(k, 'GET', '/balance')
    return float((d.get('subscription') or {}).get('generations') or 0) if st == 200 else 0


def pick_key(min_gens=10):
    best = max(KEYS, key=remaining)
    print(f'usando chave {best} ({remaining(best)} gens)')
    return best


def poll(fn, label, interval=9, max_s=900):
    t0 = time.time()
    while time.time() - t0 < max_s:
        done, info = fn()
        if done:
            return info
        print(f'  aguardando {label}... ({int(time.time()-t0)}s) {info}')
        time.sleep(interval)
    raise SystemExit(f'timeout esperando {label}')


def load_state():
    return json.load(open(STATE_F)) if os.path.exists(STATE_F) else {}


def save_state(s):
    json.dump(s, open(STATE_F, 'w'), indent=1)


def ref_b64(path, fw, fh, size):
    """Frame 0 do sprite do jogo, centralizado num canvas size×size com pés no chão."""
    from PIL import Image
    im = Image.open(os.path.join(ROOT, path)).convert('RGBA').crop((0, 0, fw, fh))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((size - fw) // 2, size - fh - 4))
    buf = io.BytesIO()
    canvas.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('nome')
    ap.add_argument('--desc', required=True)
    ap.add_argument('--ref', required=True, help='sheet idle do bicho no jogo')
    ap.add_argument('--ref-fw', type=int, required=True)
    ap.add_argument('--ref-fh', type=int, required=True)
    ap.add_argument('--anim-desc', default='walking forward')
    ap.add_argument('--size', type=int, default=64, help='image_size pedido (frames saem 92)')
    args = ap.parse_args()

    from PIL import Image
    tag = 'mount_' + args.nome
    s = load_state()
    c = s.get(tag, {})

    # 1) personagem 4 direções com o sprite do jogo como referência sul + paleta forçada
    if not c.get('character_id'):
        key = pick_key()
        ref = ref_b64(args.ref, args.ref_fw, args.ref_fh, args.size)
        st, resp = call(key, 'POST', '/create-character-with-4-directions', {
            'description': args.desc,
            'image_size': {'width': args.size, 'height': args.size},
            'view': 'low top-down',
            'outline': 'single color black outline',
            'shading': 'basic shading',
            'detail': 'medium detail',
            'directions': {'south': {'type': 'base64', 'base64': ref}},
            'color_image': {'type': 'base64', 'base64': ref},
            'force_colors': True,
            'seed': 7,
        })
        print('create-character:', st, str(resp)[:250] if st not in (200, 201, 202) else list(resp.keys()))
        if st not in (200, 201, 202):
            raise SystemExit(1)
        c = {'key': key, 'character_id': resp.get('character_id') or resp.get('id')}
        s[tag] = c
        save_state(s)

    def char():
        st, d = call(c['key'], 'GET', f"/characters/{c['character_id']}")
        return d if st == 200 else {}

    def rot_ready():
        # rotation_urls vem preenchido ANTES das imagens existirem no CDN — valida baixando a 'south'
        rot = char().get('rotation_urls') or {}
        if not rot.get('south'):
            return False, 'sem rotation_urls'
        try:
            data = urllib.request.urlopen(urllib.request.Request(
                rot['south'], headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read()
            if data[:4] == b'\x89PNG':
                return True, 'ok'
        except Exception as ex:
            return False, f'CDN ainda sem imagem ({ex})'
        return False, 'imagem invalida'

    poll(rot_ready, f'rotações {args.nome}')

    # 2) animação de andar no estilo da criatura (v3 custom, 6 frames)
    if not c.get('walk_requested'):
        st, resp = call(c['key'], 'POST', '/characters/animations', {
            'character_id': c['character_id'],
            'mode': 'v3',
            'action_description': args.anim_desc,
            'animation_name': 'walk',
            'frame_count': 6,
            'keep_first_frame': False,
        })
        print('walk v3:', st, str(resp)[:250] if st not in (200, 201, 202) else list(resp.keys()))
        if st not in (200, 201, 202):
            raise SystemExit(1)
        c['walk_requested'] = True
        save_state(s)

    def walk_dirs(d):
        # o v3 pode fatiar direções em VÁRIAS entradas de animação — mescla todas as 'walk'
        merged = {}
        for a in (d.get('animations') or []):
            if (a.get('display_name') or '') == 'walk' or 'walk' in (a.get('animation_type') or ''):
                for x in (a.get('directions') or []):
                    if x.get('frames'):
                        merged[x['direction']] = x['frames']
        return merged

    def walk_ready():
        d = char()
        m = walk_dirs(d)
        if len(m) >= 4:
            return True, d
        return False, f'walk dirs prontos: {sorted(m)}'

    d = poll(walk_ready, f'walk {args.nome}', max_s=1500)

    # 3) exporta sheets no formato AI_MOUNTS (idle 1col, walk Ncols, linhas n/w/s/e)
    fetch = lambda url: Image.open(io.BytesIO(urllib.request.urlopen(
        urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read())).convert('RGBA')
    order = ['north', 'west', 'south', 'east']
    rot = d['rotation_urls']
    idles = [fetch(rot[k]) for k in order]
    S = idles[0].width
    out_dir = os.path.join(ROOT, 'public/assets/64/player/mount', args.nome)
    os.makedirs(out_dir, exist_ok=True)
    sheet = Image.new('RGBA', (S, S * 4), (0, 0, 0, 0))
    for i, im in enumerate(idles):
        sheet.paste(im, (0, i * S))
    sheet.save(f'{out_dir}/idle.png')
    by_dir = walk_dirs(d)
    cols = max(len(v) for v in by_dir.values())
    ws = Image.new('RGBA', (S * cols, S * 4), (0, 0, 0, 0))
    for r, k in enumerate(order):
        for col, url in enumerate(by_dir.get(k, [])):
            ws.paste(fetch(url), (col * S, r * S))
    ws.save(f'{out_dir}/walk.png')
    json.dump({'frame': S, 'walk_cols': cols}, open(f'{out_dir}/meta.json', 'w'))

    # 4) ícone do inventário (idle sul)
    icon = idles[2].crop(idles[2].getbbox()).resize((96, 96), Image.NEAREST)
    icon.save(os.path.join(ROOT, f'public/assets/64/ui/icons/mount_{args.nome}.png'))

    print(f'\n=== {args.nome}: PRONTO (frame {S}px, walk {cols}f) ===')
    print(f'Cole no AI_MOUNTS do game.js (calibre offs/dy/bob visualmente):')
    print(f"    {args.nome}: {{ frame: {S}, walkCols: {cols}, speed: 200, dy: 46, rate: 12,")
    print(f"             bob: [0, -2, -4, -2, 0, -1],")
    print(f"             offs: {{ n: [0, -10], w: [0, -10], s: [0, -10], e: [0, -10] }} }},")


main()
