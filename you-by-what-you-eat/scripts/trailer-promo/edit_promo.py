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
 S('intro_a', 'intro', 0.0, 0.95, 2, 'intro', hit=0, fadein=0.3),
 S('intro_b', 'intro.b', 0.0, 1.1, 3, 'intro'),
 S('kat_a', 'kat', 0.0, 0.85, 2, 'groove1'),
 S('kat_b', 'kat.b', 0.0, 0.9, 2, 'groove1'),
 S('muskel_a', 'muskel', 0.0, 0.85, 2, 'groove1'),
 S('muskel_b', 'muskel.b', 0.0, 0.9, 2, 'groove1'),
 S('uebung_a', 'uebung', 0.0, 0.75, 2, 'groove1'),
 S('uebung_b', 'uebung.b', 0.0, 0.9, 2, 'groove1'),
 S('timer_a', 'timer', 0.0, 0.85, 2, 'groove2', hit=0),
 S('timer_b', 'timer.b', 0.0, 0.9, 2, 'groove2'),
 S('punkte_a', 'punkte', 0.0, 0.9, 2, 'groove2'),
 S('punkte_b', 'punkte.b', 0.0, 0.9, 2, 'groove2'),
 S('fort_a', 'fort', 0.0, 0.86, 2, 'groove2'),
 S('fort_b', 'fort.b', 0.0, 0.9, 2, 'groove2'),
 S('break_a', 'break', 0.0, 1.15, 3, 'break'),
 S('break_b', 'break.b', 0.0, 1.3, 3, 'break'),
 S('gruppe_a', 'gruppe', 0.0, 0.9, 2, 'drop', hit=0, drop=True),
 S('gruppe_b', 'gruppe.b', 0.0, 0.9, 2, 'drop'),
 S('live_a', 'live', 0.0, 0.85, 2, 'drop'),
 S('live_b', 'live.b', 0.0, 0.9, 2, 'drop'),
 S('sticker_a', 'sticker', 0.0, 0.85, 2, 'late'),
 S('sticker_b', 'sticker.b', 0.0, 0.9, 2, 'late'),
 S('eigene_a', 'eigene', 0.0, 0.9, 2, 'late'),
 S('eigene_b', 'eigene.b', 0.0, 0.9, 2, 'late'),
 S('rang_a', 'rang', 0.0, 0.9, 2, 'late'),
 S('rang_b', 'rang.b', 0.0, 0.9, 2, 'late'),
 S('duell_a', 'duell', 0.0, 0.9, 2, 'late'),
 S('duell_b', 'duell.b', 0.0, 0.9, 2, 'late'),
 S('strava_a', 'strava', 0.0, 0.9, 2, 'late'),
 S('strava_b', 'strava.b', 0.0, 0.9, 2, 'late'),
 S('jetzt_a', 'jetzt', 0.0, 0.85, 2, 'late'),
 S('jetzt_b', 'jetzt.b', 0.0, 0.85, 2, 'late'),
 S('outro', 'outro.start', 0.0, 6.5, 13, 'outro', hit=0, final=True, fadeout=1.6),
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
    s = SHOTS[i]; os.makedirs(f'{HERE}/shots_promo', exist_ok=True)
    lst = f'{HERE}/shots_promo/{i:02d}.txt'; out = f"{HERE}/shots_promo/{i:02d}_{s['name']}.mp4"
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
          open(f'{HERE}/cues_promo.json', 'w'), indent=1)
if '--render' in sys.argv:
    with ThreadPoolExecutor(3) as ex: outs = list(ex.map(render, range(len(SHOTS))))
    open(f'{HERE}/shots_promo/list.txt', 'w').write('\n'.join(f"file '{o}'" for o in outs))
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{HERE}/shots_promo/list.txt', '-c', 'copy', f'{HERE}/video_promo.mp4'])
    print('Video fertig' if r.returncode == 0 else 'Zusammenfügen fehlgeschlagen')
