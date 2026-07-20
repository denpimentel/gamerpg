#!/usr/bin/env python3
"""Gera os assets do bioma NEVE via PixelLab API.
Uso: python3 scripts/gen_neve.py <tileset|tree|hero|monsters|status|poll>
Idempotente: estado em public/assets/64/ai/state.json; outputs prontos são pulados.
"""
import base64
import io
import json
import os
import sys
import time
import urllib.request
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AI = os.path.join(ROOT, 'public/assets/64/_source/ai_gen')
RAW = os.path.join(ROOT, '.ai_raw')  # dumps de debug (gitignored via .ai_raw)
STATE_F = os.path.join(AI, 'state.json')
API = 'https://api.pixellab.ai/v2'
os.makedirs(AI, exist_ok=True)
os.makedirs(RAW, exist_ok=True)


def env():
    out = {}
    for ln in open(os.path.join(ROOT, '.env')):
        ln = ln.strip()
        if ln and not ln.startswith('#') and '=' in ln:
            k, v = ln.split('=', 1)
            out[k.strip()] = v.strip().strip('"')
    return out


E = env()
KEYS = dict(p.split(':', 1) for p in E['PIXELLAB_KEYS'].split(';'))


def call(keyname, method, path, body=None, timeout=300):
    req = urllib.request.Request(API + path,
        headers={'Authorization': f'Bearer {KEYS[keyname]}', 'Content-Type': 'application/json'},
        data=json.dumps(body).encode() if body is not None else None, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            ct = r.headers.get('Content-Type', '')
            raw = r.read()
            return r.status, (json.loads(raw) if 'json' in ct else raw)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:600]


def dump(tag, obj):
    try:
        open(os.path.join(RAW, f'{tag}.json'), 'w').write(json.dumps(obj, default=str)[:200000])
    except Exception:
        pass


def remaining(keyname):
    st, d = call(keyname, 'GET', '/balance')
    if st not in (200, 201, 202):
        return 0
    return float((d.get('subscription') or {}).get('generations') or 0)


def pick_key(min_gens=8):
    best, bestv = None, -1
    for name in KEYS:
        v = remaining(name)
        if v > bestv:
            best, bestv = name, v
    if bestv < min_gens:
        print(f'AVISO: melhor chave {best} tem só {bestv} gerações')
    print(f'usando chave {best} ({bestv} gens)')
    return best


def load_state():
    return json.load(open(STATE_F)) if os.path.exists(STATE_F) else {}


def save_state(s):
    json.dump(s, open(STATE_F, 'w'), indent=1)


def save_b64_png(b64, dest):
    data = base64.b64decode(b64)
    assert data[:4] == b'\x89PNG', 'não é PNG'
    open(dest, 'wb').write(data)
    print('salvo', os.path.relpath(dest, ROOT), len(data), 'bytes')


def poll(fn, label, interval=8, max_s=600):
    t0 = time.time()
    while time.time() - t0 < max_s:
        done, info = fn()
        if done:
            return info
        print(f'  aguardando {label}... ({int(time.time()-t0)}s) {info}')
        time.sleep(interval)
    raise SystemExit(f'timeout esperando {label}')


# ---------- TILESET ----------
def stage_tileset():
    s = load_state()
    if os.path.exists(os.path.join(AI, 'tileset_raw.png')):
        print('tileset_raw.png já existe — pulando')
        return
    t = s.get('tileset', {})
    if not t.get('id'):
        key = t.get('key') or pick_key()
        st, resp = call(key, 'POST', '/create-tileset', {
            'lower_description': 'calm teal ocean water',
            'upper_description': 'thick white snow with soft blue shadows, sparkling',
            'transition_description': 'snowy shoreline edge',
            'mode': 'standard',
            'tile_size': {'width': 32, 'height': 32},
            'view': 'high top-down',
            'transition_size': 0,
            'outline': 'lineless',
            'shading': 'medium shading',
            'detail': 'medium detail',
            'seed': 1234,
        })
        dump('tileset_create', resp)
        print('create-tileset:', st, str(resp)[:300] if st != 200 else list(resp.keys()))
        if st not in (200, 201, 202):
            raise SystemExit(1)
        tid = resp.get('tileset_id') or resp.get('id')
        s['tileset'] = {'key': key, 'id': tid}
        save_state(s)
    t = s['tileset']

    def check():
        st, d = call(t['key'], 'GET', f"/tilesets/{t['id']}")
        if st not in (200, 201, 202):
            return False, f'http {st}'
        ts = d.get('tileset') or {}
        tiles = ts.get('tiles') or []
        ready = [x for x in tiles if isinstance(x.get('image'), dict) and x['image'].get('base64')]
        if tiles and len(ready) == len(tiles):
            return True, d
        return False, f'{len(ready)}/{len(tiles)} tiles prontos'

    d = poll(check, 'tileset', max_s=1200)
    ts = d['tileset']
    from PIL import Image
    snow_dir = os.path.join(AI, 'snow')
    os.makedirs(snow_dir, exist_ok=True)
    for tile in ts['tiles']:
        c = tile['corners']
        sig = ''.join('U' if c[k] == 'upper' else 'L' for k in ('NW', 'NE', 'SW', 'SE'))
        data = base64.b64decode(tile['image']['base64'])
        p = os.path.join(snow_dir, f't_{sig}.png')
        open(p, 'wb').write(data)
        im = Image.open(p).convert('RGBA')
        im.resize((64, 64), Image.NEAREST).save(p)
    json.dump(d.get('metadata') or {}, open(os.path.join(AI, 'tileset_meta.json'), 'w'), indent=1, default=str)
    # marca concluído (o check de topo usa tileset_raw.png como flag)
    Image.new('RGBA', (1, 1)).save(os.path.join(AI, 'tileset_raw.png'))
    print(f"tileset ok — {len(ts['tiles'])} tiles em {os.path.relpath(snow_dir, ROOT)}")


# ---------- TREE (map object) ----------
def stage_tree():
    s = load_state()
    if os.path.exists(os.path.join(AI, 'tree.png')):
        print('tree.png já existe — pulando')
        return
    t = s.get('tree', {})
    if not t.get('id'):
        key = t.get('key') or pick_key(min_gens=3)
        st, resp = call(key, 'POST', '/map-objects', {
            'description': 'tall snow-covered pine tree, fantasy game asset, snow on branches',
            'image_size': {'width': 128, 'height': 192},
            'view': 'high top-down',
            'outline': 'selective outline',
            'shading': 'medium shading',
            'detail': 'medium detail',
            'seed': 77,
        })
        dump('tree_create', resp)
        print('map-objects:', st, str(resp)[:300] if st != 200 else list(resp.keys()))
        if st not in (200, 201, 202):
            raise SystemExit(1)
        oid = resp.get('object_id') or resp.get('id')
        if not oid and isinstance(resp.get('image'), dict):
            save_b64_png(resp['image']['base64'], os.path.join(AI, 'tree.png'))
            return
        s['tree'] = {'key': key, 'id': oid}
        save_state(s)
    t = s['tree']

    def check():
        st, d = call(t['key'], 'GET', f"/map-objects/{t['id']}")
        if st not in (200, 201, 202):
            return False, f'http {st}'
        dump('tree_get', d)
        img = (d.get('image') or {})
        if isinstance(img, dict) and img.get('base64'):
            return True, d
        if d.get('status') == 'completed' and (d.get('download_url') or d.get('image_url')):
            return True, d
        return False, f"status={d.get('status')} campos={list(d.keys())[:10]}"

    d = poll(check, 'tree')
    img = d.get('image') or {}
    if isinstance(img, dict) and img.get('base64'):
        save_b64_png(img['base64'], os.path.join(AI, 'tree.png'))
    else:
        url = d.get('download_url') or d.get('image_url')
        data = urllib.request.urlopen(url, timeout=60).read()
        open(os.path.join(AI, 'tree.png'), 'wb').write(data)
        print('tree.png baixado via url,', len(data), 'bytes')


# ---------- PERSONAGENS (herói + monstros) ----------
CHARS = {
    'hero': {
        'desc': 'brave ice knight hero with shining blue steel armor, white fur cape, sword on back, heroic fantasy RPG character',
        'size': 64, 'template': None,
    },
    'yeti': {
        'desc': 'small cute baby yeti monster, white shaggy fur, big blue eyes, fantasy RPG creature',
        'size': 64, 'template': None,
    },
    'golem': {
        'desc': 'ice golem monster made of jagged blue ice crystals, glowing frozen core, fantasy RPG enemy',
        'size': 64, 'template': None,
    },
    'wolf': {
        'desc': 'fierce arctic ice wolf, white and pale blue fur, frost breath, fantasy RPG creature',
        'size': 64, 'template': 'dog',
    },
}


def create_char(name, spec):
    s = load_state()
    c = s.get('char_' + name, {})
    if c.get('character_id'):
        return c
    key = c.get('key') or pick_key()
    body = {
        'description': spec['desc'],
        'image_size': {'width': spec['size'], 'height': spec['size']},
        'view': 'low top-down',
        'outline': 'single color black outline',
        'shading': 'basic shading',
        'detail': 'medium detail',
        'seed': 42,
    }
    if spec['template']:
        body['template_id'] = spec['template']
    st, resp = call(key, 'POST', '/create-character-with-4-directions', body)
    dump(f'char_{name}_create', resp)
    print(f'create-character {name}:', st, str(resp)[:300] if st != 200 else list(resp.keys()))
    if st not in (200, 201, 202):
        raise SystemExit(1)
    c = {'key': key,
         'character_id': resp.get('character_id') or resp.get('id'),
         'job_id': resp.get('job_id') or (resp.get('background_job') or {}).get('id')}
    s['char_' + name] = c
    save_state(s)
    return c


def wait_char_ready(name, c):
    def check():
        st, d = call(c['key'], 'GET', f"/characters/{c['character_id']}")
        if st not in (200, 201, 202):
            return False, f'http {st}'
        dump(f'char_{name}_get', {k: v for k, v in d.items() if k != 'rotation_urls'} | {'rotation_urls_n': len(d.get('rotation_urls') or [])})
        urls = d.get('rotation_urls') or []
        if urls:
            return True, d
        return False, f"sem rotation_urls ainda (anims={d.get('animation_count')})"
    return poll(check, f'char {name}')


def add_walk(name, c):
    s = load_state()
    if s.get('char_' + name, {}).get('walk_requested'):
        return
    # templates quadrúpedes (dog etc.) usam ids de animação diferentes
    anim_id = 'walk-6-frames' if CHARS[name].get('template') else 'walk'
    st, resp = call(c['key'], 'POST', '/characters/animations', {
        'character_id': c['character_id'],
        'mode': 'template',
        'template_animation_id': anim_id,
        'animation_name': 'walk',
    })
    dump(f'char_{name}_anim', resp)
    print(f'walk {name}:', st, str(resp)[:250] if st != 200 else list(resp.keys()))
    if st != 200 and st != 409:
        raise SystemExit(1)
    s['char_' + name]['walk_requested'] = True
    save_state(s)


def export_char(name, c):
    """Baixa rotações (idle) + frames do walk e monta spritesheets (linhas n,w,s,e)."""
    from PIL import Image
    out_idle = os.path.join(AI, f'{name}_idle.png')
    out_walk = os.path.join(AI, f'{name}_walk.png')
    if os.path.exists(out_walk):
        print(f'{name}: sheets já existem — pulando export')
        return

    def check():
        st, d = call(c['key'], 'GET', f"/characters/{c['character_id']}")
        if st not in (200, 201, 202):
            return False, f'http {st}'
        walk = next((a for a in (d.get('animations') or []) if a.get('animation_type') in ('walk', 'walk-6-frames')), None)
        dirs = (walk or {}).get('directions') or []
        if walk and len(dirs) >= 4 and all(x.get('frames') for x in dirs):
            return True, d
        return False, f'walk dirs prontos: {len(dirs)}'

    d = poll(check, f'walk {name}', interval=10, max_s=900)
    fetch = lambda url: Image.open(io.BytesIO(urllib.request.urlopen(
        urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read())).convert('RGBA')

    order = ['north', 'west', 'south', 'east']
    rot = d['rotation_urls']
    idles = [fetch(rot[k]) for k in order]
    S = idles[0].width
    sheet = Image.new('RGBA', (S, S * 4), (0, 0, 0, 0))
    for i, im in enumerate(idles):
        sheet.paste(im, (0, i * S))
    sheet.save(out_idle)

    walk = next(a for a in d['animations'] if a.get('animation_type') in ('walk', 'walk-6-frames'))
    by_dir = {x['direction']: x['frames'] for x in walk['directions']}
    ncols = max(len(v) for v in by_dir.values())
    ws = Image.new('RGBA', (S * ncols, S * 4), (0, 0, 0, 0))
    for r, k in enumerate(order):
        for col, url in enumerate(by_dir.get(k, [])):
            ws.paste(fetch(url), (col * S, r * S))
    ws.save(out_walk)
    json.dump({'frame': S, 'walk_cols': ncols}, open(os.path.join(AI, f'{name}_meta.json'), 'w'))
    print(f'{name}: sheets exportados (frame {S}px, walk {ncols}f) ✓')


def stage_hero():
    c = create_char('hero', CHARS['hero'])
    wait_char_ready('hero', c)
    add_walk('hero', c)
    export_char('hero', c)


def stage_monsters():
    for name in ('yeti', 'golem', 'wolf'):
        print(f'=== {name} ===')
        c = create_char(name, CHARS[name])
        wait_char_ready(name, c)
        add_walk(name, c)
        export_char(name, c)


def stage_status():
    s = load_state()
    print(json.dumps(s, indent=1))
    for name in KEYS:
        print(f'{name}: {remaining(name)} gens')


def stage_all():
    stage_tileset()
    stage_tree()
    stage_hero()
    stage_monsters()
    print('\n=== TUDO PRONTO ===')


if __name__ == '__main__':
    stage = sys.argv[1] if len(sys.argv) > 1 else 'status'
    {'tileset': stage_tileset, 'tree': stage_tree, 'hero': stage_hero,
     'monsters': stage_monsters, 'status': stage_status, 'all': stage_all}[stage]()
