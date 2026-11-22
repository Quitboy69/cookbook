import os
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
WORK = os.environ.get('YBWYE_DATA', os.path.join(HERE, 'work')) + '/'   # Download-/Zwischenordner (nicht im Repo)
import gzip, csv, json, sys, re, collections, time
csv.field_size_limit(10**9)
D = WORK
t0 = time.time()
f = gzip.open(D + 'off.csv.gz', 'rt', encoding='utf-8', errors='replace', newline='')
rd = csv.reader(f, delimiter='\t')
hdr = next(rd); ix = {h: i for i, h in enumerate(hdr)}
need = ['code','product_name','brands','categories_tags','countries_tags','product_quantity','serving_quantity','energy-kcal_100g','energy_100g','fat_100g','saturated-fat_100g','carbohydrates_100g','sugars_100g','fiber_100g','proteins_100g','salt_100g','sodium_100g','nutriscore_grade','unique_scans_n','completeness','pnns_groups_1','pnns_groups_2','generic_name','quantity','last_modified_t']
I = {k: ix[k] for k in need}
def num(v):
    if v is None or v == '': return None
    try: return float(v)
    except: return None
rows = []; total = 0; seen = collections.Counter()
for row in rd:
    total += 1
    if len(row) <= max(I.values()): continue
    c = row[I['countries_tags']]
    if 'en:austria' not in c and 'en:germany' not in c: continue
    code = row[I['code']]
    if not code.isdigit() or len(code) not in (8, 12, 13, 14): continue
    name = row[I['product_name']].strip()
    if len(name) < 2: continue
    kcal = num(row[I['energy-kcal_100g']])
    if kcal is None:
        kj = num(row[I['energy_100g']]); kcal = round(kj / 4.184, 1) if kj is not None else None
    kh = num(row[I['carbohydrates_100g']]); fat = num(row[I['fat_100g']]); pr = num(row[I['proteins_100g']]); su = num(row[I['sugars_100g']])
    if None in (kcal, kh, fat, pr, su): continue
    sat = num(row[I['saturated-fat_100g']]); fi = num(row[I['fiber_100g']])
    salt = num(row[I['salt_100g']])
    if salt is None:
        na = num(row[I['sodium_100g']]); salt = round(na * 2.5, 3) if na is not None else None
    if min(kcal, kh, fat, pr, su) < 0 or kcal > 950 or kh > 100.5 or fat > 100.5 or pr > 100.5 or su > kh + 0.6 or fat + kh + pr > 106: continue
    if sat is not None and (sat < 0 or sat > fat + 0.3): sat = None
    if salt is not None and (salt < 0 or salt > 100): salt = None
    # Plausibilität Energie
    calc = 4 * (kh + pr) + 9 * fat
    if calc > 20 and abs(calc - kcal) > max(60, 0.35 * calc): continue
    cats = row[I['categories_tags']]
    ml = 1 if ('en:beverages' in cats or 'en:drinks' in cats or 'en:waters' in cats or 'en:sodas' in cats) and 'en:beverage-preparations' not in cats and 'en:powdered-drinks' not in cats else 0
    brand = row[I['brands']].split(',')[0].strip()
    scans = num(row[I['unique_scans_n']]) or 0
    comp = num(row[I['completeness']]) or 0
    rows.append([code, name, brand, num(row[I['product_quantity']]) or 0, num(row[I['serving_quantity']]) or 0, [kcal, pr, kh, su, fat, sat, fi, salt], (row[I['nutriscore_grade']] or '')[:1], ml, row[I['pnns_groups_2']] or '', scans, comp, row[I['generic_name']], 'en:austria' in c])
    if total % 500000 == 0: print(total, len(rows), round(time.time() - t0), flush=True)
print('total', total, 'kept', len(rows), round(time.time() - t0), flush=True)
json.dump(rows, open(D + 'off_filtered.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('saved', flush=True)
