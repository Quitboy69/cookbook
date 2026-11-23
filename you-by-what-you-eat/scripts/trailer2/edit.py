"""Schnitt: zerlegt die Rohaufnahme in Einstellungen (Shots), passt sie auf ein 120-BPM-Raster an,
fügt Kamerabewegung, Farbkorrektur, Übergänge, Vignette, Korn und Glow hinzu. Schreibt cues.json für die Musik."""
import json, subprocess, sys, os, bisect, math
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
W_SRC, H_SRC = 1170, 2532
W_OUT, H_OUT = 1080, 2340
BEAT = 0.5   # 120 BPM
FPS = 30
frames = json.load(open(f'{HERE}/frames.json'))
M = dict((n, t) for n, t in json.load(open(f'{HERE}/markers.json')))
ts = [f[1] for f in frames]; END = ts[-1]

# name, Marker, Versatz, Rohlänge (s), Takte in Beats, Übergang hinein, Dauer, Zoom (z0, z1, cx, cy), Musik-Sektion, hit, whoosh
S = lambda *a, **k: dict(zip(['name', 'mk', 'off', 'raw', 'beats', 'tin', 'ov', 'zoom', 'sec'], a), **k)
SHOTS = [
 S('intro',     'intro.start',     0.0, 4.3, 8,  'fadeblack', 0.01, (1.00, 1.10, .5, .45), 'intro', hit=4),
 S('onb1',      'onb.profile',     0.3, 2.6, 4,  'fadeblack', 0.45, (1.12, 1.00, .5, .35), 'groove1'),
 S('onb2',      'onb.run',         0.2, 3.0, 4,  'smoothleft', 0.18, (1.00, 1.08, .5, .40), 'groove1'),
 S('plan',      'onb.done',        0.0, 5.0, 6,  'fade', 0.15, (1.00, 1.10, .5, .40), 'groove1'),
 S('heute',     'heute.start',     0.2, 3.2, 6,  'circleopen', 0.30, (1.08, 1.00, .5, .30), 'groove1', whoosh=True),
 S('eat',       'heute.eat',       0.0, 4.2, 6,  'smoothup', 0.18, (1.00, 1.08, .5, .55), 'groove1'),
 S('w_foto',    'foto.word',       0.0, 1.6, 3,  'fadewhite', 0.12, (1.00, 1.18, .5, .5), 'groove2', hit=0),
 S('scan',      'foto.scan',       0.0, 3.8, 6,  'zoomin', 0.25, (1.00, 1.10, .5, .45), 'groove2', whoosh=True),
 S('result',    'foto.result',     0.0, 2.4, 4,  'fade', 0.12, (1.06, 1.12, .5, .30), 'groove2'),
 S('table',     'foto.table',      0.0, 2.8, 4,  'smoothup', 0.15, (1.00, 1.10, .5, .50), 'groove2'),
 S('sugar',     'foto.sugar',      0.0, 5.5, 8,  'circleopen', 0.30, (1.00, 1.12, .5, .55), 'groove2', whoosh=True),
 S('save',      'foto.save',       0.0, 3.6, 4,  'fade', 0.15, (1.10, 1.00, .5, .45), 'groove2'),
 S('search',    'search.start',    0.0, 6.5, 6,  'smoothleft', 0.18, (1.00, 1.08, .5, .40), 'groove2'),
 S('w_lauf',    'lauf.word',       0.0, 1.6, 3,  'fadewhite', 0.12, (1.00, 1.18, .5, .5), 'groove2', hit=0),
 S('lauf',      'lauf.card',       0.0, 5.0, 6,  'zoomin', 0.25, (1.00, 1.08, .5, .35), 'groove2', whoosh=True),
 S('lsheet',    'lauf.sheet',      0.3, 3.5, 4,  'smoothleft', 0.15, (1.00, 1.08, .5, .50), 'groove2'),
 S('ltimer',    'lauf.timer',      0.0, 2.8, 4,  'smoothup', 0.15, (1.10, 1.00, .5, .45), 'break'),
 S('w_strava',  'strava.word',     0.0, 2.2, 4,  'fadeblack', 0.20, (1.00, 1.20, .5, .5), 'drop', hit=0, drop=True),
 S('s_row',     'strava.row',      0.0, 3.4, 6,  'fade', 0.20, (1.00, 1.08, .5, .65), 'drop'),
 S('s_hero',    'strava.hero',     0.0, 2.6, 4,  'smoothup', 0.15, (1.06, 1.00, .5, .35), 'drop'),
 S('s_steps',   'strava.steps',    0.0, 3.4, 6,  'smoothleft', 0.18, (1.00, 1.08, .5, .50), 'drop'),
 S('s_keys',    'strava.keys',     0.0, 3.6, 4,  'fade', 0.12, (1.00, 1.10, .5, .45), 'drop'),
 S('s_connect', 'strava.connect',  0.0, 2.6, 4,  'smoothleft', 0.15, (1.10, 1.00, .5, .55), 'drop'),
 S('s_auth',    'strava.auth',     0.0, 1.7, 3,  'fadewhite', 0.10, (1.00, 1.16, .5, .5), 'drop', hit=0),
 S('s_back',    'strava.back',     0.0, 8.5, 14, 'circleopen', 0.35, (1.00, 1.10, .5, .55), 'drop', whoosh=True),
 S('s_new',     'strava.newrun',   0.0, 4.2, 8,  'zoomin', 0.25, (1.00, 1.08, .5, .50), 'drop', whoosh=True),
 S('s_train',   'strava.training', 0.0, 4.0, 6,  'smoothup', 0.18, (1.00, 1.12, .5, .45), 'drop'),
 S('s_week',    'strava.week',     0.0, 3.2, 4,  'smoothleft', 0.15, (1.00, 1.06, .5, .50), 'drop'),
 S('s_heute',   'strava.heute',    0.0, 4.8, 6,  'circleopen', 0.30, (1.08, 1.00, .5, .35), 'drop', whoosh=True),
 S('gpx1',      'gpx.start',       0.3, 5.3, 5,  'slideleft', 0.20, (1.00, 1.08, .5, .50), 'late'),
 S('gpx2',      'gpx.sheet',       0.0, 5.0, 6,  'smoothleft', 0.15, (1.00, 1.10, .5, .60), 'late'),
 S('auto',      'auto.start',      0.6, 3.6, 5,  'fade', 0.15, (1.06, 1.00, .5, .40), 'late'),
 S('bon',       'bon.scan',        0.0, 5.0, 6,  'smoothup', 0.18, (1.00, 1.08, .5, .45), 'late'),
 S('ich',       'ich.start',       1.0, 4.0, 4,  'smoothleft', 0.15, (1.00, 1.06, .5, .50), 'late'),
 S('outro',     'outro.start',     0.0, 6.5, 16, 'fadeblack', 0.50, (1.00, 1.06, .5, .50), 'outro', hit=0, final=True),
]

def slice_list(a, b, path):
    a = max(0.0, a)                      # Ende nicht kappen: das letzte Bild wird einfach gehalten
    k0 = max(0, bisect.bisect_right(ts, a) - 1)
    k1 = max(k0, bisect.bisect_left(ts, b) - 1)
    lines = []
    for k in range(k0, k1 + 1):
        t0 = max(ts[k], a); t1 = min(ts[k + 1] if k + 1 < len(ts) else b, b)
        d = max(0.001, t1 - t0)
        lines += [f"file '{frames[k][0]}'", f"duration {d:.4f}"]
    lines.append(f"file '{frames[k1][0]}'")
    open(path, 'w').write('\n'.join(lines))

os.makedirs(f'{HERE}/shots', exist_ok=True)
# Zeitplan
beat_pos = 0; plan = []
for i, s in enumerate(SHOTS):
    s['start_beat'] = beat_pos; s['d'] = s['beats'] * BEAT
    nxt = SHOTS[i + 1]['ov'] if i + 1 < len(SHOTS) else 0.0
    s['D'] = s['d'] + nxt                       # Länge inkl. Überblendung in den nächsten Shot
    a = M[s['mk']] + s['off']
    s['a'] = a; s['speed'] = s['raw'] / s['D']
    beat_pos += s['beats']
TOTAL_BEATS = beat_pos
print('Beats gesamt:', TOTAL_BEATS, '=', TOTAL_BEATS * BEAT, 's')
for s in SHOTS:
    if s['a'] + s['raw'] > END + 6: print('! Rohmaterial zu kurz für', s['name'])

def render(i):
    s = SHOTS[i]; out = f"{HERE}/shots/{i:02d}_{s['name']}.mp4"
    lst = f"{HERE}/shots/{i:02d}.txt"; slice_list(s['a'], s['a'] + s['raw'], lst)
    z0, z1, cx, cy = s['zoom']; T = s['D']
    zexpr = f"({z0}+({z1}-{z0})*min(t/{T:.3f},1))"
    vf = (f"setpts=PTS/{s['speed']:.5f},fps={FPS},"
          f"scale=w='trunc({W_SRC}*{zexpr}/2)*2':h='trunc({H_SRC}*{zexpr}/2)*2':eval=frame:flags=bicubic,"
          f"crop={W_SRC}:{H_SRC}:x='clip({cx}*in_w-{W_SRC/2},0,in_w-{W_SRC})':y='clip({cy}*in_h-{H_SRC/2},0,in_h-{H_SRC})',"
          f"scale={W_OUT}:{H_OUT}:flags=lanczos,"
          f"eq=contrast=1.10:saturation=1.10:brightness=-0.015:gamma=0.97,format=yuv420p,"
          f"split[a][b];[b]scale=270:-2,gblur=sigma=5,scale={W_OUT}:{H_OUT},eq=brightness=-0.10:saturation=1.2,format=gbrp[g];"
          f"[a]format=gbrp[a2];[a2][g]blend=all_mode=screen:all_opacity=0.28,format=yuv420p,vignette=angle=0.62,format=yuv420p[v]")
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-filter_complex', '[0:v]' + vf, '-map', '[v]', '-t', f'{T:.3f}', '-r', str(FPS),
           '-c:v', 'libx264', '-preset', 'fast', '-crf', '15', '-pix_fmt', 'yuv420p', '-threads', '2', out]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print('FEHLER', s['name'], r.stderr[-400:]); sys.exit(1)
    return out

if '--render' in sys.argv:
    with ThreadPoolExecutor(2) as ex: outs = list(ex.map(render, range(len(SHOTS))))
    print('Shots gerendert:', len(outs))

# Cues für die Musik
cues = {'bpm': 120, 'total_beats': TOTAL_BEATS, 'shots': [dict(name=s['name'], start=s['start_beat'], beats=s['beats'], sec=s['sec'], hit=s.get('hit'), whoosh=bool(s.get('whoosh')) or s['tin'] in ('zoomin', 'circleopen', 'slideleft'), drop=bool(s.get('drop')), final=bool(s.get('final')), tin=s['tin'], ov=s['ov']) for s in SHOTS]}
json.dump(cues, open(f'{HERE}/cues.json', 'w'), indent=1)

if '--assemble' in sys.argv:
    inputs = []; 
    for i, s in enumerate(SHOTS): inputs += ['-i', f"{HERE}/shots/{i:02d}_{s['name']}.mp4"]
    fc = []; prev = '[0:v]'; S_t = 0.0
    for i in range(1, len(SHOTS)):
        S_t += SHOTS[i - 1]['d']
        s = SHOTS[i]; lab = f'[x{i}]'
        fc.append(f"{prev}[{i}:v]xfade=transition={s['tin']}:duration={s['ov']:.3f}:offset={S_t:.3f}{lab}")
        prev = lab
    total = TOTAL_BEATS * BEAT
    # Filmkorn (vorgerechneter Loop, schnell) und Ausblenden
    gi = len(SHOTS)
    fc.append(f"[{gi}:v]scale={W_OUT}:{H_OUT}:flags=bilinear,format=yuv420p[gr]")
    fc.append(f"{prev}[gr]blend=all_mode=overlay:all_opacity=0.11:shortest=1,fade=t=in:st=0:d=0.5,fade=t=out:st={total - 1.2:.2f}:d=1.2,format=yuv420p[v]")
    if not os.path.exists(f'{HERE}/grain.mp4'):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x808080:s=540x1170:r=30:d=2,format=gray,noise=alls=70:allf=t+u,format=yuv420p', '-c:v', 'libx264', '-crf', '12', f'{HERE}/grain.mp4'], check=True)
    inputs += ['-stream_loop', '-1', '-i', f'{HERE}/grain.mp4']
    cmd = ['ffmpeg', '-v', 'error', '-stats', '-y'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[v]', '-t', f'{total:.3f}', '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-maxrate', '8000k', '-bufsize', '16000k',
           '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-threads', '4', f'{HERE}/video_noaudio.mp4']
    open(f'{HERE}/assemble.sh', 'w').write(' '.join("'" + c + "'" if (' ' in c or ';' in c or '[' in c) else c for c in cmd))
    r = subprocess.run(cmd)
    print('Zusammengesetzt:', r.returncode)
