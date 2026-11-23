"""Fitness-Musik: hart, aber entspannt – 808-Bass, Trap-Drums, Cowbell, dunkle Glocken, warmer Pad, leichtes Vinyl-Knistern.
Komplett synthetisiert, auf das 120-BPM-Raster des Schnitts (cues.json) gelegt. Drop beim Strava-Teil."""
import json, os, wave
import numpy as np
from scipy import signal
HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
cues = json.load(open(f'{HERE}/cues.json'))
BEAT = 60.0 / cues['bpm']; STEP = BEAT / 4; TB = cues['total_beats']; TOTAL = TB * BEAT
N = int((TOTAL + 0.25) * SR)
rng = np.random.default_rng(5)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
tt = lambda d: np.arange(int(d * SR)) / SR
def bus(): return [np.zeros(N), np.zeros(N)]
drums, b808, pad, mel, fx, rise, amb = bus(), bus(), bus(), bus(), bus(), bus(), bus()
def put(b, sig, t0, pan=0.5, gain=1.0):
    i = int(round(t0 * SR))
    if i >= N or i + len(sig) <= 0: return
    j = min(N, i + len(sig)); s = sig[:j - i] * gain
    b[0][i:j] += s * np.cos(pan * np.pi / 2); b[1][i:j] += s * np.sin(pan * np.pi / 2)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'highpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def bp(x, f0, f1, o=2): return signal.sosfilt(signal.butter(o, [f0, f1], 'bandpass', fs=SR, output='sos'), x)
noise = lambda n: rng.standard_normal(n)
def env(n, a, r):
    e = np.ones(n); ai = max(1, int(a * SR)); ri = max(1, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai) ** 1.5; e[-ri:] = np.minimum(e[-ri:], np.linspace(1, 0, ri) ** 1.5); return e
def saw(f, t, nh=10):
    o = np.zeros_like(t)
    for k in range(1, nh + 1):
        if f * k > 11000: break
        o += np.sin(2 * np.pi * f * k * t) / k
    return o * 0.64

# ---------- Klänge ----------
def kick_s():
    t = tt(0.5); ph = 2 * np.pi * (52 * t + (95 / 30) * (1 - np.exp(-30 * t)))
    body = np.sin(ph) * np.exp(-t * 8); click = hp(noise(len(t)), 2200) * np.exp(-t * 110) * 0.45
    return np.tanh((body + click) * 1.7) * 0.95
def clap_s():
    t = tt(0.35); n = bp(noise(len(t)), 1000, 8000)
    e = np.exp(-t * 16) + 0.9 * np.exp(-((t - 0.012) ** 2) * 5e4) + 0.8 * np.exp(-((t - 0.024) ** 2) * 5e4)
    return n * e * 0.6
def snare_s():
    t = tt(0.3); return hp(noise(len(t)), 1500) * np.exp(-t * 17) * 0.6 + np.sin(2 * np.pi * 200 * t) * np.exp(-t * 30) * 0.45
def hat_s(op=False):
    t = tt(0.32 if op else 0.06); return hp(noise(len(t)), 7500) * np.exp(-t * (10 if op else 85)) * (0.3 if op else 0.26)
def cowbell(f=830):
    t = tt(0.3); o = (np.sign(np.sin(2 * np.pi * f * t)) + np.sign(np.sin(2 * np.pi * f * 1.504 * t))) * 0.5
    return bp(o, 500, 4800) * np.exp(-t * 14) * 0.5 * env(len(t), 0.001, 0.05)
def bell(f, d=1.2):
    t = tt(d); o = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dk) for r, a, dk in ((1, 1.0, 2.4), (2.0, 0.5, 3.2), (2.76, 0.35, 4.5), (5.4, 0.18, 7.0)))
    return o * env(len(t), 0.002, 0.08) * 0.5
def pluck(f, d=0.4):
    t = tt(d); o = np.zeros_like(t)
    for k in range(1, 8):
        if f * k > 9000: break
        o += np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (4 + k * 6))
    return o * env(len(t), 0.002, 0.04)
def s808(f, d, up=0):
    d = max(d, 0.12); t = tt(d); fr = f * (1 + 0.6 * np.exp(-t * 38))
    if up: fr = fr * (2 ** ((up * np.clip((t - d * 0.55) / (d * 0.45), 0, 1)) / 12))   # Slide am Ende
    ph = 2 * np.pi * np.cumsum(fr) / SR
    o = np.tanh(np.sin(ph) * 2.4) * 0.75 + np.sin(2 * ph) * 0.06
    return o * np.exp(-t * 1.9) * env(len(t), 0.004, 0.045)
def padnote(f, d):
    t = tt(d); o = np.zeros_like(t)
    for det in (-0.14, 0.0, 0.14): o += saw(f * (1 + det / 100), t + rng.random() * 0.01, 5)
    return lp(o / 3, 1800) * env(len(t), 0.5, 0.7)
def impact(size=1.0):
    t = tt(3.0); f = 32 + 60 * np.exp(-t * 3.6); ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.tanh(np.sin(ph) * 1.8) * np.exp(-t * 1.4)
    thump = lp(noise(len(t)), 700) * np.exp(-t * 4.5) * 0.8
    crash = hp(noise(len(t)), 3500) * np.exp(-t * 1.9) * 0.28 * size
    return np.tanh((boom * 1.2 + thump + crash) * 1.1) * 0.95 * (0.7 + 0.3 * size)
def whoosh(d=0.6):
    t = tt(d); o = np.zeros(len(t)); n = 18
    for c in range(n):
        a, b = int(c * len(t) / n), int((c + 1) * len(t) / n); f = 350 * (5200 / 350) ** ((c + 1) / n)
        o[a:b] = bp(noise(b - a), f * 0.6, min(f * 1.5, 11000))
    return o * np.sin(np.pi * np.clip(t / d, 0, 1) ** 1.6) ** 2 * 0.5
def riser(d):
    t = tt(d); o = np.zeros(len(t)); n = max(4, int(d * 24))
    for c in range(n):
        a, b = int(c * len(t) / n), int((c + 1) * len(t) / n); f = 300 * (9000 / 300) ** ((c + 1) / n)
        o[a:b] = bp(noise(b - a), f * 0.6, min(f * 1.6, 12000))
    return (o * 0.9 + np.sin(2 * np.pi * np.cumsum(200 * (7.0 ** (t / d))) / SR) * 0.22) * (t / d) ** 2.2 * 0.6
def revcym(d):
    t = tt(d); return hp(noise(len(t)), 4500) * (t / d) ** 3.2 * 0.5
KICK, CLAP, SNARE, HAT, OHAT = kick_s(), clap_s(), snare_s(), hat_s(), hat_s(True)

# ---------- Struktur ----------
shots = cues['shots']
def section_at(beat):
    s = 'intro'
    for sh in shots:
        if sh['start'] <= beat + 1e-6: s = sh['sec']
    return s
sec_start, sec_end = {}, {}
for sh in shots: sec_start.setdefault(sh['sec'], sh['start']); sec_end[sh['sec']] = sh['start'] + sh['beats']
CH = [dict(root=33, tri=[57, 60, 64], mel=[76, 72, 69]), dict(root=29, tri=[53, 57, 60], mel=[72, 69, 65]),
      dict(root=36, tri=[55, 60, 64], mel=[79, 76, 72]), dict(root=31, tri=[50, 55, 59], mel=[74, 71, 67])]
P808 = {'groove1': [(0, 6, 0), (10, 4, 0)],
        'groove2': [(0, 3, 0), (3, 3, 0), (6, 4, 0), (10, 3, 0), (13, 3, 3)],
        'drop':    [(0, 3, 0), (3, 2, 0), (5, 3, 12), (8, 2, 0), (10, 3, 0), (13, 3, 7)],
        'late':    [(0, 8, 0), (10, 6, 3)]}
KICKS = {'groove1': {0, 10}, 'groove2': {0, 3, 10}, 'drop': {0, 3, 7, 10, 14}, 'late': {0, 10}}
COW = [0, 3, 6, 8, 11, 14]
kick_times = []

# Intro: Drone, Riser, Impact, Glocken
i_end = sec_end.get('intro', 8) * BEAT
dr = sum(saw(f, tt(i_end + 3.0), 4) * g for f, g in ((hz(33), .9), (hz(45), .55), (hz(52), .3)))
put(pad, lp(dr, 700) * (np.minimum(1, tt(i_end + 3.0) / 3.5) ** 2 * 0.5 + 0.12) * env(len(dr), 1.0, 2.5), 0.0, 0.5, 0.55)
put(rise, riser(2.0), 0.0, 0.5, 0.9); put(rise, revcym(2.0), 0.0, 0.5, 0.7)
for b_, n_ in ((5, 69), (6, 72), (7, 76)): put(mel, bell(hz(n_), 1.6), b_ * BEAT, 0.5, 0.4)
for b_ in (6, 7): kick_times.append(b_ * BEAT); put(drums, KICK, b_ * BEAT, 0.5, 0.55)

for bar in range(int(np.ceil(TB / 4))):
    beat0 = bar * 4; sec = section_at(beat0); ch = CH[bar % 4]
    if sec in ('outro', 'break', 'intro') and sec != 'break': continue
    tb = beat0 * BEAT
    # Pad + Knistern
    if sec in ('groove1', 'groove2', 'drop', 'late'):
        g = {'groove1': 0.16, 'groove2': 0.19, 'drop': 0.22, 'late': 0.2}[sec]
        for n_ in ch['tri']:
            put(pad, padnote(hz(n_), 2.6), tb, 0.1, g * 0.7); put(pad, padnote(hz(n_), 2.6), tb, 0.9, g * 0.7)
        if sec in ('groove1', 'late'):
            n = int(2 * SR); crack = np.zeros(n); k = rng.random(n) < 0.0004
            crack[k] = rng.standard_normal(k.sum()) * 0.5; put(amb, lp(crack, 6000) + hp(noise(n), 6000) * 0.004, tb, 0.5, 0.5)
    if sec == 'break':
        put(b808, s808(hz(ch['root']), 2.0), tb, 0.5, 0.5); continue
    # 808
    for (st, ln, up) in P808.get(sec, []):
        gain = {'groove1': 0.8, 'groove2': 0.95, 'drop': 1.0, 'late': 0.85}[sec]
        if sec == 'groove1' and beat0 < sec_start['groove1'] + 4 and st != 0: continue
        put(b808, s808(hz(ch['root'] + (12 if (sec == 'drop' and st == 5) else 0) + 12 * (1 if False else 0)), ln * STEP * 1.02, up), tb + st * STEP, 0.5, gain)
    # Drums
    for st in range(16):
        t0 = tb + st * STEP + (rng.random() - 0.5) * 0.004
        if st in KICKS.get(sec, ()):
            if sec == 'groove1' and beat0 < sec_start['groove1'] + 4 and st != 0: continue
            kick_times.append(t0); put(drums, KICK, t0, 0.5, 0.95)
        full = sec in ('groove2', 'drop')
        if (sec in ('groove1',) and beat0 >= sec_start['groove1'] + 8 and st in (4, 12)) or (full and st in (4, 12)):
            put(drums, CLAP, t0, 0.5, 0.75 if full else 0.5)
            if full: put(drums, SNARE, t0, 0.5, 0.4)
        if sec == 'late' and st == 8: put(drums, CLAP, t0, 0.5, 0.7); put(drums, SNARE, t0, 0.5, 0.35)
        # Hi-Hats
        v = [1, .35, .6, .35, .9, .35, .6, .5][st % 8]
        if sec == 'groove1' and st % 2 == 0: put(drums, HAT, t0, 0.62 if st % 4 == 0 else 0.38, 0.5 * v)
        if sec == 'groove2' and (st % 2 == 0 or st in (7, 15)): put(drums, HAT, t0, 0.35 + 0.3 * (st % 4) / 3, 0.55 * v)
        if sec == 'drop': put(drums, HAT, t0, 0.3 + 0.4 * (st % 4) / 3, 0.6 * v)
        if sec == 'late' and st % 2 == 0: put(drums, HAT, t0, 0.4, 0.4 * v)
        if sec in ('groove2', 'drop') and st == 14: put(drums, OHAT, t0, 0.65, 0.6)
        # Cowbell (Gym-Phonk-Rhythmus)
        cw = {'groove2': 0.0 if beat0 < sec_start.get('groove2', 0) + 8 else 0.28, 'drop': 0.38, 'late': 0.2}.get(sec, 0)
        if cw and st in COW: put(mel, cowbell(830 if st != 0 else 880), t0, 0.62, cw * (1.0 if st in (0, 8) else 0.75))
    # Hi-Hat-Roll am Ende jedes 4. Drop-Takts
    if sec == 'drop' and bar % 4 == 3:
        for k in range(12): put(drums, HAT, tb + 3.5 * BEAT + k * (0.5 * BEAT / 12), 0.5, 0.25 + 0.04 * k)
    # Melodie: dunkle Glocken
    if sec in ('groove2', 'drop', 'late'):
        if sec == 'groove2' and beat0 < sec_start['groove2'] + 8: pass
        else:
            gm = {'groove2': 0.22, 'drop': 0.34, 'late': 0.24}[sec]
            for k, st in enumerate((0, 6, 10)):
                put(mel, bell(hz(ch['mel'][k % 3]), 1.1), tb + st * STEP, 0.3 + 0.2 * k, gm)
    elif sec == 'groove1':
        for st in range(0, 16, 4): put(mel, pluck(hz(ch['mel'][(st // 4) % 3] - 12), 0.35), tb + st * STEP, 0.25 + 0.5 * (st / 12), 0.17)

# Break: Riser + Snare-Roll + "Suck-out"
mute = np.ones(N); bs, be = sec_start.get('break'), sec_end.get('break')
if bs is not None:
    d = (be - bs) * BEAT; put(rise, riser(d), bs * BEAT, 0.5, 1.0); put(rise, revcym(d), bs * BEAT, 0.5, 0.8)
    for k in range(int(d / 0.25)): put(drums, SNARE, bs * BEAT + k * 0.25, 0.5, 0.2 + 0.5 * (k * 0.25 / d))
    for k in range(int((d / 4) / 0.0625)): put(drums, SNARE, be * BEAT - d / 4 + k * 0.0625, 0.5, 0.5 + 0.02 * k)
    a = int((be * BEAT - 0.16) * SR); b = int(be * BEAT * SR); mute[a:b] = 0.0; mute[a - 400:a] = np.linspace(1, 0, 400)
# Hits / Whooshes / Finale
for sh in shots:
    t0 = sh['start'] * BEAT
    if sh.get('hit') is not None:
        th = (sh['start'] + sh['hit']) * BEAT; big = sh['drop'] or sh['final']
        put(fx, impact(1.25 if big else 0.8), th, 0.5, 1.0 if big else 0.7)
        if sh['drop']: put(fx, whoosh(1.2), th - 1.2, 0.5, 0.5)
        if big: put(b808, s808(hz(33), 3.2), th, 0.5, 1.0)
    if sh.get('whoosh') and sh.get('hit') is None: put(fx, whoosh(0.55), max(0, t0 - 0.42), 0.5, 0.55)
    if sh.get('final'):
        for n_ in (57, 64, 69, 76): put(mel, bell(hz(n_), 4.0), t0, 0.5, 0.3)
        put(pad, padnote(hz(57), 5.0), t0, 0.5, 0.35)

# Sidechain
duck = np.ones(N)
for tk in kick_times:
    a = int(tk * SR); b = min(N, a + int(0.25 * SR))
    if a < N: duck[a:b] = np.minimum(duck[a:b], 1 - 0.6 * np.exp(-np.arange(b - a) / SR / 0.07))
ap = lambda bs_, dp: [x * (1 - (1 - duck) * dp) for x in bs_]
pad_d, mel_d, b808_d = ap(pad, 1.0), ap(mel, 0.4), ap(b808, 0.55)
# Hall
n = int(2.0 * SR); t = np.arange(n) / SR
irl = lp(noise(n) * np.exp(-t * 3.0), 6000); irr = lp(noise(n) * np.exp(-t * 3.0), 6000)
irl, irr = irl / np.abs(irl).sum() * 40, irr / np.abs(irr).sum() * 40
wl = signal.fftconvolve(sum(p[0] * g for p, g in ((pad_d, .5), (mel_d, .6), (fx, .5), (rise, .25))), irl)[:N]
wr = signal.fftconvolve(sum(p[1] * g for p, g in ((pad_d, .5), (mel_d, .6), (fx, .5), (rise, .25))), irr)[:N]
G8, GM = 0.72, 1.4      # Bass etwas zurück, Melodie/Cowbell nach vorn
dl = sum(x[0] * g for x, g in ((drums, 1.1), (b808_d, G8), (pad_d, 1), (mel_d, GM), (rise, 1), (amb, 1))); dr_ = sum(x[1] * g for x, g in ((drums, 1.1), (b808_d, G8), (pad_d, 1), (mel_d, GM), (rise, 1), (amb, 1)))
dl = dl * mute + fx[0]; dr_ = dr_ * mute + fx[1]
mix = np.stack([dl + wl * 0.7, dr_ + wr * 0.7], 1)
mix = signal.sosfilt(signal.butter(2, 28, 'highpass', fs=SR, output='sos'), mix, axis=0)
mix = mix + 0.28 * np.stack([hp(mix[:, 0], 3200), hp(mix[:, 1], 3200)], 1)
mix = np.tanh(mix * 1.6) / np.tanh(1.6)                       # kräftige Sättigung = aggressiv
fade = np.ones(N); fo = int(2.4 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.6; fade[:int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
mix *= fade[:, None]; mix *= 0.92 / np.abs(mix).max()
w = wave.open(f'{HERE}/music2.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype('<i2').tobytes()); w.close()
mono = mix.mean(1)
print('Dauer %.1fs  Spitze %.2f' % (N / SR, np.abs(mix).max()))
for s_ in dict.fromkeys(sh['sec'] for sh in shots):
    a, b = int(sec_start[s_] * BEAT * SR), int(sec_end[s_] * BEAT * SR); print('%-8s %5.1f–%5.1fs  RMS %.3f' % (s_, a / SR, b / SR, np.sqrt(np.mean(mono[a:b] ** 2))))
f, P = signal.welch(mono, SR, nperseg=8192)
print(' | '.join('%d-%d: %.0fdB' % (a, b, 10 * np.log10(P[(f >= a) & (f < b)].sum() + 1e-12)) for a, b in ((20, 60), (60, 120), (120, 500), (500, 2000), (2000, 6000), (6000, 16000))), '| L/R %.2f' % np.corrcoef(mix[:, 0], mix[:, 1])[0, 1])
