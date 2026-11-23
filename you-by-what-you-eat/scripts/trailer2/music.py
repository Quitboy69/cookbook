"""Cinematic-Trailer-Musik, komplett synthetisiert (numpy/scipy), exakt auf das Beat-Raster des Schnitts (cues.json) gelegt.
Aufbau: Intro-Drone + Riser + Impact → Groove → Groove 2 → Snare-Roll-Break → DROP (Strava) → Late → Outro-Impact."""
import json, sys, os, wave
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
cues = json.load(open(f'{HERE}/cues.json'))
BEAT = 60.0 / cues['bpm']; TB = cues['total_beats']; TOTAL = TB * BEAT
N = int((TOTAL + 0.25) * SR)
rng = np.random.default_rng(11)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
tt = lambda d: np.arange(int(d * SR)) / SR

def bus(): return [np.zeros(N), np.zeros(N)]
drums, bass, pad, arp, lead, fx, rise = bus(), bus(), bus(), bus(), bus(), bus(), bus()
def put(b, sig, t0, pan=0.5, gain=1.0):
    i = int(t0 * SR)
    if i >= N or i + len(sig) <= 0: return
    j = min(N, i + len(sig)); s = sig[:j - i] * gain
    b[0][i:j] += s * np.cos(pan * np.pi / 2); b[1][i:j] += s * np.sin(pan * np.pi / 2)

# ---------- Klangerzeuger ----------
def saw(f, t, nh=10):
    o = np.zeros_like(t)
    for k in range(1, nh + 1):
        if f * k > 11000: break
        o += np.sin(2 * np.pi * f * k * t) / k
    return o * 0.64
def sqr(f, t, nh=9):
    o = np.zeros_like(t)
    for k in range(1, nh + 1, 2):
        if f * k > 11000: break
        o += np.sin(2 * np.pi * f * k * t) / k
    return o * 0.8
def env(n, a, r, hold=None):
    e = np.ones(n); ai = max(1, int(a * SR)); ri = max(1, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai) ** 1.5; e[-ri:] = np.minimum(e[-ri:], np.linspace(1, 0, ri) ** 1.5); return e
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'highpass', fs=SR, output='sos'), x)
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'lowpass', fs=SR, output='sos'), x)
def bp(x, f0, f1, o=2): return signal.sosfilt(signal.butter(o, [f0, f1], 'bandpass', fs=SR, output='sos'), x)
noise = lambda n: rng.standard_normal(n)

def kick_s():
    t = tt(0.55); ph = 2 * np.pi * (46 * t + (115 / 26) * (1 - np.exp(-26 * t)))
    body = np.sin(ph) * np.exp(-t * 6.5); click = hp(noise(len(t)), 2500) * np.exp(-t * 90) * 0.35
    return np.tanh((body + click) * 1.5) * 0.95
def clap_s():
    t = tt(0.4); n = bp(noise(len(t)), 900, 7500)
    e = np.exp(-t * 14) + 0.9 * np.exp(-((t - 0.011) ** 2) * 6e4) + 0.8 * np.exp(-((t - 0.022) ** 2) * 6e4)
    return n * e * 0.55
def snare_s():
    t = tt(0.3); return (hp(noise(len(t)), 1200) * np.exp(-t * 16) * 0.6 + np.sin(2 * np.pi * 185 * t) * np.exp(-t * 28) * 0.5)
def hat_s(op=False):
    t = tt(0.3 if op else 0.07); return hp(noise(len(t)), 7000) * np.exp(-t * (11 if op else 70)) * (0.32 if op else 0.28)
KICK, CLAP, SNARE, HAT, OHAT = kick_s(), clap_s(), snare_s(), hat_s(), hat_s(True)

def pluck(f, d=0.5):
    t = tt(d); o = np.zeros_like(t)
    for k in range(1, 9):
        if f * k > 10000: break
        o += np.sin(2 * np.pi * f * k * t) / k * np.exp(-t * (3.5 + k * 5.5))
    return o * env(len(t), 0.002, 0.04)
def padnote(f, d, nh=6):
    t = tt(d); o = np.zeros_like(t)
    for det in (-0.13, 0.0, 0.13):
        o += saw(f * (1 + det / 100), t + rng.random() * 0.01, nh)
    return o / 3 * env(len(t), 0.45, 0.6)
def subnote(f, d, drive=1.6):
    t = tt(d); return np.tanh(np.sin(2 * np.pi * f * t) * drive) * 0.7 * env(len(t), 0.008, 0.06)
def basspluck(f, d=0.24):
    t = tt(d); o = saw(f, t, 8) * np.exp(-t * 7); return lp(o, 1400) * 0.9 * env(len(t), 0.003, 0.03)
def leadnote(f, d):
    t = tt(d); w = 2 * np.pi * 5.2
    tw = t + (0.004 / w) * (1 - np.cos(w * t)) * np.minimum(1, t / 0.4)      # sanftes Vibrato (Zeitverzerrung)
    o = 0.6 * saw(f, tw, 12) + 0.35 * sqr(f * 1.005, tw, 9)
    return lp(o, 5200) * env(len(t), 0.03, 0.25)
def impact(size=1.0):
    t = tt(3.2); f = 30 + 62 * np.exp(-t * 3.4); ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * np.exp(-t * 1.5)
    thump = lp(noise(len(t)), 700) * np.exp(-t * 4.5) * 0.9
    metal = sum(np.sin(2 * np.pi * fm * t) * np.exp(-t * dm) for fm, dm in ((197, 3.0), (313, 3.6), (468, 4.2), (731, 5.0))) * 0.12
    crash = hp(noise(len(t)), 3500) * np.exp(-t * 1.9) * 0.30 * size
    return np.tanh((boom * 1.2 + thump + metal + crash) * 1.1) * 0.95 * (0.7 + 0.3 * size)
def whoosh(d=0.7):
    t = tt(d); o = np.zeros(len(t)); n = 20
    for c in range(n):
        a, b = int(c * len(t) / n), int((c + 1) * len(t) / n); f = 350 * (5200 / 350) ** ((c + 1) / n)
        o[a:b] = bp(noise(b - a), f * 0.6, min(f * 1.5, 11000))
    e = np.sin(np.pi * np.clip(t / d, 0, 1) ** 1.6) ** 2
    return o * e * 0.55
def riser(d):
    t = tt(d); o = np.zeros(len(t)); n = max(4, int(d * 24))
    for c in range(n):
        a, b = int(c * len(t) / n), int((c + 1) * len(t) / n); f = 300 * (9000 / 300) ** ((c + 1) / n)
        o[a:b] = bp(noise(b - a), f * 0.6, min(f * 1.6, 12000))
    sweep = np.sin(2 * np.pi * np.cumsum(200 * (7.0 ** (t / d))) / SR) * 0.25
    return (o * 0.9 + sweep) * (t / d) ** 2.2 * 0.6
def revcym(d):
    t = tt(d); return hp(noise(len(t)), 4500) * (t / d) ** 3.2 * 0.5

# ---------- Struktur aus dem Schnitt ----------
shots = cues['shots']
def section_at(beat):
    s = 'intro'
    for sh in shots:
        if sh['start'] <= beat + 1e-6: s = sh['sec']
    return s
sec_start = {}
for sh in shots: sec_start.setdefault(sh['sec'], sh['start'])
sec_end = {}
for i, sh in enumerate(shots): sec_end[sh['sec']] = sh['start'] + sh['beats']
CH = [dict(root=45, tri=[57, 60, 64], up=[69, 72, 76, 81]), dict(root=41, tri=[53, 57, 60], up=[65, 69, 72, 77]),
      dict(root=48, tri=[55, 60, 64], up=[67, 72, 76, 79]), dict(root=43, tri=[50, 55, 59], up=[62, 67, 71, 74])]
LEAD = [[(76, 2), (74, 1), (72, 1)], [(72, 2), (69, 1), (72, 1)], [(76, 2), (79, 1), (76, 1)], [(74, 2), (71, 1), (74, 1)]]
ARP = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2]
kick_times = []

# Intro: Drone, Riser, Impact
for sh in shots:
    if sh['sec'] == 'intro': pass
i_end = sec_end.get('intro', 8) * BEAT
drone = sum(saw(f, tt(i_end + 3.0), 5) * g for f, g in ((hz(33), .9), (hz(45), .6), (hz(52), .35)))
sw = np.minimum(1, tt(i_end + 3.0) / 3.5) ** 2 * 0.5 + 0.12
put(pad, lp(drone, 900) * sw * env(len(drone), 1.0, 2.5), 0.0, 0.5, 0.55)
put(rise, riser(2.0), 0.0, 0.5, 0.9); put(rise, revcym(2.0), 0.0, 0.5, 0.7)
for b_, n_ in ((5, 57), (6, 60), (7, 64)):
    put(arp, pluck(hz(n_), 1.4), b_ * BEAT, 0.5, 0.45)
for b_ in (6, 7): kick_times.append(b_ * BEAT); put(drums, KICK, b_ * BEAT, 0.5, 0.55)

# Taktweise
nsteps = TB * 4
for i in range(nsteps):
    beat = i / 4.0; t0 = beat * BEAT; bar = int(beat // 4); bi = beat - bar * 4
    sec = section_at(beat); ch = CH[bar % 4]; st = i % 16
    first = lambda: abs(bi - round(bi)) < 1e-6
    onbeat = abs(beat - round(beat)) < 1e-6; ibeat = int(round(beat)) % 4
    off8 = abs((beat * 2) - round(beat * 2)) < 1e-6 and not onbeat
    vel = 1.0 if st % 4 == 0 else (0.7 if st % 2 == 0 else 0.5)
    if sec in ('groove1', 'groove2', 'drop', 'late', 'outro') and st == 0 and sec != 'outro':
        # Pad pro Takt
        g = {'groove1': 0.20, 'groove2': 0.26, 'drop': 0.34, 'late': 0.26}[sec]
        for n_ in ch['tri']:
            put(pad, padnote(hz(n_ + 12), 2.0 * 1.35), t0, 0.1, g * 0.75); put(pad, padnote(hz(n_ + 12), 2.0 * 1.35), t0, 0.9, g * 0.75)
        if sec in ('drop',):
            put(pad, padnote(hz(ch['up'][0] + 12), 2.0 * 1.35), t0, 0.2, 0.14); put(pad, padnote(hz(ch['up'][0] + 12), 2.0 * 1.35), t0, 0.8, 0.14)
    # Bass
    if sec in ('groove1', 'groove2', 'drop') and (i % 2 == 0):
        gb = {'groove1': 0.55, 'groove2': 0.75, 'drop': 0.9}[sec]
        note = ch['root'] + (12 if (sec == 'drop' and (i // 2) % 4 == 3) else 0)
        put(bass, subnote(hz(note), 0.24), t0, 0.5, gb); put(bass, basspluck(hz(note + 12)), t0, 0.5, gb * 0.55)
    if sec == 'late' and st == 0:
        put(bass, subnote(hz(ch['root']), 2.0 * 1.05), t0, 0.5, 0.85)
    if sec == 'break' and st == 0:
        put(bass, subnote(hz(ch['root']), 2.0), t0, 0.5, 0.8)
    # Arpeggio (16tel)
    if sec in ('groove1', 'groove2', 'drop', 'late'):
        ga = {'groove1': 0.20 if beat < sec_start.get('groove1', 8) + 8 else 0.30, 'groove2': 0.36, 'drop': 0.40, 'late': 0.27}[sec]
        if sec == 'groove1' and beat < sec_start.get('groove1', 8) + 4: ga = 0.0 if i % 2 else 0.18
        if ga > 0:
            n_ = ch['up'][ARP[st] % 4] + (12 if st in (0, 8) else 0) - (12 if sec == 'late' else 0)
            put(arp, pluck(hz(n_), 0.32), t0, 0.14 + 0.72 * ((i % 4) / 3.0), ga * (1.0 if st % 4 == 0 else 0.78))
    # Drums
    if sec == 'groove1':
        half = beat >= sec_start['groove1'] + 8
        if st in (0, 8) and onbeat and ibeat in (0, 2): kick_times.append(t0); put(drums, KICK, t0, 0.5, 0.8)
        if off8 or onbeat: put(drums, HAT, t0, 0.62 if i % 8 == 0 else 0.4, 0.5 * vel)
        if half and onbeat and ibeat in (1, 3): put(drums, CLAP, t0, 0.5, 0.55)
    if sec in ('groove2', 'drop'):
        gd = 1.0 if sec == 'drop' else 0.85
        if onbeat: kick_times.append(t0); put(drums, KICK, t0, 0.5, 0.95 * gd)
        if onbeat and ibeat in (1, 3): put(drums, CLAP, t0, 0.5, 0.8 * gd); put(drums, SNARE, t0, 0.5, 0.35 * gd)
        put(drums, HAT, t0, 0.35 + 0.3 * ((i % 4) / 3.0), 0.55 * vel * gd)
        if off8 and st % 4 == 2: put(drums, OHAT, t0, 0.65, 0.55 * gd)
        if sec == 'drop' and st == 0 and bar % 4 == 0 and beat > sec_start['drop'] + 0.1: put(fx, impact(0.5)[: int(2.2 * SR)], t0, 0.5, 0.28)
        if sec == 'drop' and ibeat == 3 and onbeat and bar % 4 == 3:   # Snare-Fill vor dem 4. Takt
            for k in range(8): put(drums, SNARE, t0 + k * BEAT / 8, 0.5, 0.18 + 0.05 * k)
    if sec == 'late':
        if onbeat and ibeat == 0: kick_times.append(t0); put(drums, KICK, t0, 0.5, 0.85)
        if abs(beat - (bar * 4 + 2.5)) < 1e-6: kick_times.append(t0); put(drums, KICK, t0, 0.5, 0.7)
        if onbeat and ibeat == 2: put(drums, CLAP, t0, 0.5, 0.7); put(drums, SNARE, t0, 0.5, 0.3)
        if off8 or onbeat: put(drums, HAT, t0, 0.4, 0.4 * vel)

# Lead-Hook (Drop + Late + zweite Hälfte Groove 2)
def lead_bars(b0, b1, gain, oct_up=False):
    for bar in range(b0, b1):
        pos = bar * 4.0
        t = pos
        for (n_, dur) in LEAD[bar % 4]:
            f = hz(n_ + (12 if oct_up else 0)); d = dur * BEAT * 1.02
            put(lead, leadnote(f, d + 0.3), t * BEAT, 0.5, gain); put(lead, leadnote(f * 0.5, d + 0.3), t * BEAT, 0.5, gain * 0.5)
            t += dur
g2s, g2e = sec_start.get('groove2'), sec_end.get('groove2')
if g2s is not None: lead_bars(int((g2s + (g2e - g2s) * 0.5) // 4), int(g2e // 4), 0.20)
ds, de = sec_start.get('drop'), sec_end.get('drop')
if ds is not None: lead_bars(int(ds // 4), int(np.ceil(de / 4)), 0.30, True)
ls, le = sec_start.get('late'), sec_end.get('late')
if ls is not None: lead_bars(int(ls // 4), int(le // 4), 0.22)

# Break: Riser + Snare-Roll, danach "Suck-out" direkt vor dem Drop
bs, be = sec_start.get('break'), sec_end.get('break')
mute = np.ones(N)
if bs is not None:
    d = (be - bs) * BEAT; put(rise, riser(d), bs * BEAT, 0.5, 1.0); put(rise, revcym(d), bs * BEAT, 0.5, 0.8)
    for k in range(int(d / 0.25)): put(drums, SNARE, bs * BEAT + k * 0.25, 0.5, 0.18 + 0.5 * (k * 0.25 / d))
    for k in range(int((d / 4) / 0.0625)): put(drums, SNARE, (be - d / 4 / BEAT * 1.0 / 1) * BEAT * 0 + (be * BEAT - d / 4) + k * 0.0625, 0.5, 0.5 + 0.02 * k)
    a = int((be * BEAT - 0.16) * SR); b = int(be * BEAT * SR)
    mute[a:b] = 0.0; mute[a - 400:a] = np.linspace(1, 0, 400)

# Hits, Whooshes, Drop, Finale
for sh in shots:
    t0 = sh['start'] * BEAT
    if sh.get('hit') is not None:
        t_hit = (sh['start'] + sh['hit']) * BEAT
        big = sh['drop'] or sh['final']
        put(fx, impact(1.25 if big else 0.8 if sh['name'].startswith('w_') else 1.0), t_hit, 0.5, 1.0 if big else 0.75)
        if sh['drop']:
            put(fx, whoosh(1.2), t_hit - 1.2, 0.5, 0.5)
    if sh.get('whoosh') and not sh.get('hit'):
        put(fx, whoosh(0.6), max(0, t0 - 0.45), 0.5, 0.6)
    if sh.get('final'):
        for n_ in (45, 52, 57, 64, 69): put(lead, (lambda x: x * env(len(x), 0.02, 2.6))(leadnote(hz(n_), 4.3)), t0, 0.5, 0.28)
        put(pad, padnote(hz(57), 5.0), t0, 0.5, 0.35)

# Sidechain-Pumpen
duck = np.ones(N)
for tk in kick_times:
    a = int(tk * SR); n = int(0.28 * SR); b = min(N, a + n)
    if a < N: duck[a:b] = np.minimum(duck[a:b], 1 - 0.62 * np.exp(-np.arange(b - a) / SR / 0.075))
def applyduck(bs_, depth=1.0):
    return [x * (1 - (1 - duck) * depth) for x in bs_]
pad_d, bass_d, arp_d, lead_d = applyduck(pad, 1.0), applyduck(bass, 0.9), applyduck(arp, 0.7), applyduck(lead, 0.5)

# Hall
def ir():
    n = int(2.4 * SR); t = np.arange(n) / SR
    L_ = lp(noise(n) * np.exp(-t * 2.6), 6500); R_ = lp(noise(n) * np.exp(-t * 2.6), 6500)
    pre = int(0.022 * SR); L_ = np.r_[np.zeros(pre), L_][:n]; R_ = np.r_[np.zeros(pre), R_][:n]
    return L_ / np.abs(L_).sum() * 40, R_ / np.abs(R_).sum() * 40
irl, irr = ir()
def wet(parts):
    sl = sum(p[0] * g for p, g in parts); sr = sum(p[1] * g for p, g in parts)
    return signal.fftconvolve(sl, irl)[:N], signal.fftconvolve(sr, irr)[:N]
wl, wr = wet([(pad_d, 0.5), (arp_d, 0.45), (lead_d, 0.75), (fx, 0.55), (rise, 0.25)])

dry_l = sum(x[0] for x in (drums, bass_d, pad_d, arp_d, lead_d, rise)); dry_r = sum(x[1] for x in (drums, bass_d, pad_d, arp_d, lead_d, rise))
dry_l = dry_l * mute + fx[0]; dry_r = dry_r * mute + fx[1]
mix = np.stack([dry_l + wl * 0.8, dry_r + wr * 0.8], 1)
hpf = signal.butter(2, 28, 'highpass', fs=SR, output='sos'); mix = signal.sosfilt(hpf, mix, axis=0)
mix = mix + 0.38 * np.stack([hp(mix[:, 0], 3200), hp(mix[:, 1], 3200)], 1)      # mehr Glanz in den Höhen
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
fade = np.ones(N); fo = int(2.6 * SR); fade[-fo:] = np.linspace(1, 0, fo) ** 1.6; fade[:int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
mix *= fade[:, None]
mix *= 0.92 / np.abs(mix).max()
w = wave.open(f'{HERE}/music.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype('<i2').tobytes()); w.close()

# ---- Kontrolle: Lautstärke je Sektion, Kick-Treffer auf dem Raster ----
mono = mix.mean(1)
print('Dauer %.1fs  Spitze %.2f' % (N / SR, np.abs(mix).max()))
for s_ in dict.fromkeys(sh['sec'] for sh in shots):
    a, b = int(sec_start[s_] * BEAT * SR), int(sec_end[s_] * BEAT * SR)
    print('%-8s %5.1f–%5.1fs  RMS %.3f' % (s_, a / SR, b / SR, np.sqrt(np.mean(mono[a:b] ** 2))))
low = lp(mono, 120); envl = np.abs(signal.hilbert(low))[::SR // 1000]
errs = []
for tk in kick_times[10:60]:
    a = int((tk - 0.04) * 1000); b = int((tk + 0.08) * 1000); errs.append((np.argmax(envl[a:b]) + a) / 1000 - tk)
print('Kick-Versatz zum Raster: Median %.0f ms, max %.0f ms' % (1000 * np.median(errs), 1000 * np.max(np.abs(errs))))
