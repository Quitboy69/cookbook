import os
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
WORK = os.environ.get('YBWYE_DATA', os.path.join(HERE, 'work')) + '/'   # Download-/Zwischenordner (nicht im Repo)
import json, collections, re, os, gzip
D = WORK
rows = json.load(open(D + 'off_filtered.json'))
# row: code, name, brand, qty, serving, n8, ns, ml, pnns2, scans, comp, generic_name, at
BRANDS_KEEP = ['haribo','maoam','katjes','trolli','milka','kinder','ferrero','ritter sport','lindt','toblerone','snickers','mars','twix','bounty','m&m','oreo','manner','pringles','chio','lay','funny-frisch','funny frisch','red bull','monster','coca-cola','coca cola','pepsi','fanta','sprite','almdudler','römerquelle','vöslauer','pago','rauch','granini','hohes c','nutella','kitkat','nestlé','nestle','dr. oetker','storck','werther','ricola','tic tac','mentos','kellogg','nesquik','lipton','haribo','bahlsen','leibniz','balisto','duplo','hanuta','knoppers','yogurette','raffaello','merci','after eight','smarties','ben & jerry','magnum','langnese','mövenpick','schärdinger','landliebe','müller','danone','activia','alpro','oatly','vitaminwell','clever','ja! natürlich','zotter','heindl','pickerl','soletti','kelly','pom-bär','pombär','snack','nic nac','lays','doritos','tyrrells','ültje','seeberger','corny','balance','farmer','kinder bueno','bueno','capri-sun','capri sun','punica','rio','vita coca','powerade','gatorade','rockstar','effect','booster','hell','sodastream','schweppes','red bull','j7','pfanner','spitz','jacobs','nespresso','tchibo','meinl','julius meinl','barista','emmi','ehrmann','weihenstephan','bärenmarke','tetra']
BK = [b for b in set(BRANDS_KEEP)]
def keep(r):
    s = r[9] + (1.5 if r[12] else 0)
    if s >= 3: return True
    b = (r[2] or '').lower()
    if s >= 1 and any(k in b for k in BK): return True
    return False
rows = [r for r in rows if keep(r)]
print('nach Auswahl', len(rows))
# Duplikate: gleiche Marke+Name+kcal+zucker → bestes behalten
seen = {}
for r in sorted(rows, key=lambda r: -(r[9] + r[10])):
    key = (re.sub(r'\W+', '', (r[2] + r[1]).lower()), round(r[5][0]), round(r[5][3]))
    if key not in seen: seen[key] = r
rows = sorted(seen.values(), key=lambda r: -(r[9] + (1.5 if r[12] else 0)))
print('nach Duplikaten', len(rows))
cats = [c for c, _ in collections.Counter(r[8] for r in rows).most_common(60)]
cats = [c for c in cats if c and c != 'unknown']
CI = {c: i for i, c in enumerate(cats)}
def f(x, d=1):
    if x is None: return -1
    return round(x, d)
out = []
for r in rows:
    n = r[5]
    name = re.sub(r'\s+', ' ', r[1]).strip()[:64]
    brand = re.sub(r'\s+', ' ', r[2]).strip()[:32]
    pack = int(round(r[3])) if 0 < r[3] <= 5000 else 0
    serv = int(round(r[4])) if 0 < r[4] <= 1000 else 0
    out.append([r[0], name, brand, pack, serv, f(n[0], 0), f(n[1]), f(n[2]), f(n[3]), f(n[4]), f(n[5]), f(n[6]), f(n[7], 2), r[6], r[7], CI.get(r[8], -1), int(min(r[9], 9999))])
data = {'v': 1, 'cats': cats, 'h': ['code', 'name', 'brand', 'pack', 'serving', 'kcal', 'prot', 'kh', 'sugar', 'fat', 'sat', 'fiber', 'salt', 'ns', 'ml', 'cat', 'scans'], 'p': out}
os.makedirs(os.path.join(REPO, 'www', 'data'), exist_ok=True)
js = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(REPO, 'www', 'data', 'products.json'), 'w').write(js)
print('Größe', round(len(js) / 1e6, 2), 'MB; gz', round(len(gzip.compress(js.encode())) / 1e6, 2), 'MB;', len(out), 'Produkte;', len(cats), 'Kategorien')
print(cats[:40])
for q in ['haribo', 'red bull', 'milka', 'manner', 'snickers', 'coca-cola', 'kinder', 'pringles', 'nutella', 'oreo', 'beef', 'tatar', 'spaghetti']:
    print(q, sum(1 for o in out if q in (o[2] + ' ' + o[1]).lower()))
