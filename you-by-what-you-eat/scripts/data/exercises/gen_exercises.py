"""Übungsbibliothek erzeugen: ex1-3.py (deutsche Texte, Level, Geräte) + free-exercise-db (Muskeln, Fotos) → src/exercises.js + www/ex/*.webp
   Aufruf: python3 scripts/data/exercises/gen_exercises.py --img"""
import json, os, sys, io, urllib.request, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ex1 import E1; from ex2 import E2; from ex3 import E3
from PIL import Image
# Datensatz: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json (Public Domain) – Pfad per EXDB oder neben diesem Skript
DB = json.load(open(os.environ.get('EXDB', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exercises.json'))))
BY = {x['id']: x for x in DB}
APP = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))
OUT = f'{APP}/www/ex'
MAP = {'abdominals': 'abs', 'abductors': 'abductors', 'adductors': 'adductors', 'biceps': 'biceps', 'calves': 'calves', 'chest': 'chest', 'forearms': 'forearms',
       'glutes': 'glutes', 'hamstrings': 'hamstrings', 'lats': 'lats', 'lower back': 'lowerback', 'middle back': 'midback', 'neck': 'neck', 'quadriceps': 'quads',
       'shoulders': 'shoulders', 'traps': 'traps', 'triceps': 'triceps'}
ALL = E1 + E2 + E3
seen = set(); rows = []; missing = []
for (did, name, lvl, eq, typ, mode, steps, tip, ex) in ALL:
    if did in seen: print('doppelt', did); continue
    seen.add(did)
    d = BY.get(did)
    if not d: missing.append(did); continue
    if 'm' in ex: prim, sec = ex['m']
    else:
        prim = [MAP[m] for m in d['primaryMuscles'] if m in MAP]; sec = [MAP[m] for m in d['secondaryMuscles'] if m in MAP and MAP[m] not in prim]
    key = did.lower().replace('-', '_').replace('__', '_')
    rows.append(dict(id=key, src=did, n=name, l=lvl, eq=eq, t=typ, mo=mode, s=steps, tip=tip, p=prim, s2=sec, uni=ex.get('uni', 0), tags=ex.get('tags', []), imgs=len(d['images'])))
print('Übungen:', len(rows), 'fehlend:', missing)
def fetch(r):
    os.makedirs(f"{OUT}/{r['id']}", exist_ok=True); n = 0
    for i in range(min(2, r['imgs'])):
        dst = f"{OUT}/{r['id']}/{i}.webp"
        if os.path.exists(dst): n += 1; continue
        url = f"https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/{r['src']}/{i}.jpg"
        try:
            data = urllib.request.urlopen(url, timeout=30).read()
            im = Image.open(io.BytesIO(data)).convert('RGB'); w = 420; h = round(im.size[1] * w / im.size[0])
            im.resize((w, h), Image.LANCZOS).save(dst, 'WEBP', quality=68, method=6); n += 1
        except Exception as e: print('Bild fehlt', r['src'], i, e)
    return r['id'], n
if '--img' in sys.argv:
    with cf.ThreadPoolExecutor(8) as ex: res = list(ex.map(fetch, rows))
    for r, (k, n) in zip(rows, res): r['imgs'] = n
    print('Bilder:', sum(n for _, n in res))
for r in rows: r.pop('src')
js = ('/* Übungsbibliothek – erzeugt von scripts/data/gen_exercises.py. Fotos: free-exercise-db (Public Domain / Unlicense).\n'
      '   Felder: id, n Name, l Level 1-4, eq Gerät, t Typ, mo reps|time, s Schritte, tip, p primäre Muskeln, s2 sekundäre, uni je Seite, tags, imgs */\n'
      'export const EXERCISES = ' + json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(f'{APP}/src/exercises.js', 'w').write(js)
print('exercises.js', len(js) // 1024, 'KB')
import collections
print('Level:', collections.Counter(r['l'] for r in rows)); print('Gerät:', collections.Counter(r['eq'] for r in rows)); print('Typ:', collections.Counter(r['t'] for r in rows))
print('Muskeln:', collections.Counter(m for r in rows for m in r['p']))
