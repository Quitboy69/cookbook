import os
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
WORK = os.environ.get('YBWYE_DATA', os.path.join(HERE, 'work')) + '/'   # Download-/Zwischenordner (nicht im Repo)
import csv, re, sys, pickle, os
B = WORK + 'usda/FoodData_Central_sr_legacy_food_csv_2018-04/'
CACHE = B + 'cache.pkl'
IDS = {'1008': 'kcal', '1003': 'prot', '1005': 'kh', '2000': 'sugar', '1063': 'sugar2', '1004': 'fat', '1258': 'sat', '1079': 'fiber', '1093': 'na'}
def load():
    if os.path.exists(CACHE): return pickle.load(open(CACHE, 'rb'))
    foods = {r['fdc_id']: r['description'] for r in csv.DictReader(open(B + 'food.csv'))}
    cats = {r['id']: r['description'] for r in csv.DictReader(open(B + 'food_category.csv'))}
    fcat = {r['fdc_id']: cats.get(r['food_category_id'], '') for r in csv.DictReader(open(B + 'food.csv'))}
    vals = {}
    for r in csv.DictReader(open(B + 'food_nutrient.csv')):
        k = IDS.get(r['nutrient_id'])
        if k and r['fdc_id'] in foods:
            try: vals.setdefault(r['fdc_id'], {})[k] = float(r['amount'])
            except: pass
    out = {}
    for i, d in foods.items():
        v = vals.get(i, {})
        if 'kcal' not in v: continue
        s = v.get('sugar', v.get('sugar2'))
        out[i] = dict(desc=d, cat=fcat.get(i, ''), kcal=v['kcal'], prot=v.get('prot', 0), kh=v.get('kh', 0), sugar=s, fat=v.get('fat', 0), sat=v.get('sat'), fiber=v.get('fiber'), na=v.get('na'))
    pickle.dump(out, open(CACHE, 'wb'))
    return out
DB = load()
def find(pat, n=12, must=None):
    rx = re.compile(pat, re.I)
    res = [(i, d) for i, d in DB.items() if rx.search(d['desc'])]
    res.sort(key=lambda x: len(x[1]['desc']))
    return res[:n]
if __name__ == '__main__':
    for pat in sys.argv[1:]:
        print('==', pat)
        for i, d in find(pat, 10):
            print(i, d['desc'][:90], '|', d['kcal'], d['prot'], d['kh'], d['sugar'], d['fat'], d['sat'], d['fiber'], d['na'])
