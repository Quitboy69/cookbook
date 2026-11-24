"""Schnitt v3: harte Schnitte im Takt, kein Zoom, keine Übergangs-Effekte, natürliches Tempo, 60 fps.
Abschnittsgrenzen liegen auf ganzen Takten (4 Beats, 120 BPM)."""
import json, subprocess, sys, os, bisect
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
BEAT, FPS = 0.5, 60
W_OUT, H_OUT = 1080, 2338
frames = json.load(open(f'{HERE}/frames.json')); M = dict((n, t) for n, t in json.load(open(f'{HERE}/markers.json')))
ts = [f[1] for f in frames]
def S(name, mk, off, raw, beats, sec, **k): return dict(name=name, mk=mk, off=off, raw=raw, beats=beats, sec=sec, **k)
SHOTS = [
 S('intro', 'intro.start', 0.0, 4.0, 8, 'intro', hit=4, fadein=0.6),
 S('onb1', 'onb.profile', 0.2, 2.2, 4, 'groove1'),
 S('onb2', 'onb.run', 0.3, 2.4, 4, 'groove1'),
 S('plan', 'onb.done', 0.0, 4.0, 6, 'groove1'),
 S('heute', 'heute.start', 0.2, 3.0, 6, 'groove1'),
 S('eat', 'heute.eat', 0.0, 4.4, 8, 'groove1'),
 S('w_foto', 'foto.word', 0.0, 1.5, 3, 'groove2', hit=0),
 S('pick', 'foto.pick', 1.4, 2.0, 4, 'groove2'),
 S('scan', 'foto.scan', 0.2, 3.2, 6, 'groove2'),
 S('result', 'foto.result', 0.0, 3.0, 6, 'groove2'),
 S('table', 'foto.table', 0.3, 3.0, 6, 'groove2'),
 S('sugar', 'foto.sugar', 0.0, 4.4, 8, 'groove2'),
 S('save', 'foto.save', 0.0, 3.2, 6, 'groove2'),
 S('search', 'search.start', 1.0, 4.2, 6, 'groove2'),
 S('w_lauf', 'lauf.word', 0.0, 1.5, 3, 'groove2', hit=0),
 S('lauf', 'lauf.card', 0.0, 3.4, 6, 'groove2'),
 S('lsheet', 'lauf.sheet', 0.3, 3.2, 6, 'groove2'),
 S('ltimer', 'lauf.timer', 0.0, 2.0, 4, 'break'),
 S('w_strava', 'strava.word', 0.0, 2.0, 4, 'drop', hit=0, drop=True),
 S('s_row', 'strava.row', 0.0, 3.2, 6, 'drop'),
 S('s_hero', 'strava.hero', 0.0, 3.0, 6, 'drop'),
 S('s_steps', 'strava.steps', 0.0, 3.2, 6, 'drop'),
 S('s_keys', 'strava.keys', 0.0, 3.6, 6, 'drop'),
 S('s_connect', 'strava.connect', 0.0, 2.1, 4, 'drop'),
 S('s_auth', 'strava.auth', 0.0, 1.7, 4, 'drop', hit=0),
 S('s_back', 'strava.back', 0.0, 6.5, 12, 'drop'),
 S('s_new', 'strava.newrun', 0.0, 4.2, 8, 'drop'),
 S('s_train', 'strava.training', 0.0, 4.0, 8, 'drop'),
 S('s_heute', 'strava.heute', 0.0, 4.2, 8, 'drop'),
 S('gpx1', 'gpx.start', 2.0, 3.2, 6, 'late'),
 S('gpx2', 'gpx.sheet', 0.0, 4.2, 8, 'late'),
 S('auto', 'auto.start', 0.6, 3.2, 6, 'late'),
 S('bon', 'bon.scan', 0.0, 4.4, 8, 'late'),
 S('outro', 'outro.start', 0.0, 6.5, 16, 'outro', hit=0, final=True, fadeout=1.6),
]
pos = 0
for s in SHOTS:
    s['start'] = pos; pos += s['beats']; s['d'] = s['beats'] * BEAT; s['a'] = M[s['mk']] + s['off']; s['speed'] = s['raw'] / s['d']
TB = pos
secs = {}
for s in SHOTS: secs.setdefault(s['sec'], [s['start'], 0]); secs[s['sec']][1] = s['start'] + s['beats']
print('Beats', TB, '=', TB * BEAT, 's  Abschnitte', secs)
for s in SHOTS:
    if s['speed'] > 1.5 or s['speed'] < 0.75: print('  Tempo', s['name'], round(s['speed'], 2))

def slice_list(a, b, path):
    k0 = max(0, bisect.bisect_right(ts, a) - 1); k1 = max(k0, bisect.bisect_left(ts, b) - 1); out = []
    for k in range(k0, k1 + 1):
        t0 = max(ts[k], a); t1 = min(ts[k + 1] if k + 1 < len(ts) else b, b)
        out += [f"file '{frames[k][0]}'", f"duration {max(0.001, t1 - t0):.4f}"]
    out.append(f"file '{frames[k1][0]}'"); open(path, 'w').write('\n'.join(out))

def render(i):
    s = SHOTS[i]; os.makedirs(f'{HERE}/shots3', exist_ok=True)
    lst = f'{HERE}/shots3/{i:02d}.txt'; out = f"{HERE}/shots3/{i:02d}_{s['name']}.mp4"
    slice_list(s['a'], s['a'] + s['raw'] + 0.2, lst)
    nfr = int(round(s['d'] * FPS))
    vf = f"setpts=PTS/{s['speed']:.5f},fps={FPS},scale={W_OUT}:{H_OUT}:flags=lanczos,unsharp=5:5:0.45:5:5:0,eq=contrast=1.04:saturation=1.06"
    if s.get('fadein'): vf += f",fade=t=in:st=0:d={s['fadein']}"
    if s.get('fadeout'): vf += f",fade=t=out:st={s['d'] - s['fadeout']:.3f}:d={s['fadeout']}"
    vf += ',format=yuv420p'
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', vf, '-frames:v', str(nfr), '-r', str(FPS),
                        '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-g', '120', '-pix_fmt', 'yuv420p', '-threads', '2', out], capture_output=True, text=True)
    if r.returncode: print('FEHLER', s['name'], r.stderr[-300:])
    return out

json.dump({'bpm': 120, 'total_beats': TB, 'sections': secs,
           'shots': [dict(name=s['name'], start=s['start'], beats=s['beats'], sec=s['sec'], hit=s.get('hit'), drop=bool(s.get('drop')), final=bool(s.get('final'))) for s in SHOTS]},
          open(f'{HERE}/cues3.json', 'w'), indent=1)
if '--render' in sys.argv:
    with ThreadPoolExecutor(3) as ex: outs = list(ex.map(render, range(len(SHOTS))))
    open(f'{HERE}/shots3/list.txt', 'w').write('\n'.join(f"file '{o}'" for o in outs))
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{HERE}/shots3/list.txt', '-c', 'copy', f'{HERE}/video3.mp4'])
    print('Video fertig' if r.returncode == 0 else 'Zusammenfügen fehlgeschlagen')
