"""Fitness-Track v3 mit echten Instrumenten-Samples (FluidR3 GM via FluidSynth) + synthetischem 808-Sub.
A-Moll, 120 BPM, Am–F–Dm–E. Abschnitte exakt nach cues_promo.json (harte Schnitte im Takt)."""
import json, os, subprocess, wave
import numpy as np, mido
from scipy import signal
HERE = os.path.dirname(os.path.abspath(__file__)); SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
SR = 44100; cues = json.load(open(f'{HERE}/cues_promo.json')); BEAT = 0.5; TB = cues['total_beats']; TOTAL = TB * BEAT
N = int((TOTAL + 0.3) * SR); SEC = {k: tuple(v) for k, v in cues['sections'].items()}
rng = np.random.default_rng(3); TPB = 480
os.makedirs(f'{HERE}/stems', exist_ok=True)

class Mid:
    def __init__(s): s.ev = []
    def _t(s, b): return int(round(b * TPB))
    def prog(s, ch, p, bank=0):
        if bank < 128: s.ev.append((0, 0, mido.Message('control_change', channel=ch, control=0, value=bank)))   # Kanal 10 = Drums (Bank 128 automatisch)
        s.ev.append((0, 1, mido.Message('program_change', channel=ch, program=p)))
    def cc(s, ch, c, v, b=0): s.ev.append((s._t(b), 1, mido.Message('control_change', channel=ch, control=c, value=int(v))))
    def note(s, ch, n, b, d, v):
        v = int(max(1, min(127, v + rng.integers(-6, 7))))
        s.ev.append((s._t(b), 3, mido.Message('note_on', channel=ch, note=int(n), velocity=v)))
        s.ev.append((s._t(b + d), 2, mido.Message('note_off', channel=ch, note=int(n), velocity=0)))
    def save(s, path):
        mf = mido.MidiFile(ticks_per_beat=TPB); tr = mido.MidiTrack(); mf.tracks.append(tr)
        tr.append(mido.MetaMessage('set_tempo', tempo=500000, time=0)); last = 0
        for t, o, m in sorted(s.ev, key=lambda e: (e[0], e[1])): tr.append(m.copy(time=t - last)); last = t
        tr.append(mido.MetaMessage('end_of_track', time=s._t(TB + 8) - last)); mf.save(path)

def sec_at(b):
    for k, (a, e) in SEC.items():
        if a <= b < e: return k
    return 'outro'
PROG = ['Am', 'F', 'Dm', 'E']
CH = {'Am': dict(r=33, keys=[57, 60, 64], pad=[69, 72, 76], st=[57, 64, 69, 72], bell=[76, 72, 69, 74]),
      'F':  dict(r=29, keys=[53, 57, 60], pad=[65, 69, 72], st=[53, 60, 65, 69], bell=[72, 69, 65, 72]),
      'Dm': dict(r=38, keys=[50, 53, 57], pad=[62, 65, 69], st=[50, 57, 62, 65], bell=[74, 69, 65, 76]),
      'E':  dict(r=40, keys=[52, 56, 59], pad=[64, 68, 71], st=[52, 59, 64, 68], bell=[71, 68, 64, 71])}
def chord_of(bar):
    b = bar * 4; s = sec_at(b); st = SEC.get(s, (0, 0))[0] // 4
    return CH[PROG[(bar - st) % 4]]

power, tr808, keys, piano, bells, pad, strings, bassgm, fxm = (Mid() for _ in range(9))
power.prog(9, 16, 128); tr808.prog(9, 25, 128)
keys.prog(0, 4); piano.prog(0, 0); bells.prog(0, 8); bells.prog(1, 9); pad.prog(0, 89); strings.prog(0, 48); bassgm.prog(0, 39); fxm.prog(0, 119); fxm.prog(1, 47)
for m, ch, rv in ((power, 9, 18), (tr808, 9, 22), (keys, 0, 55), (piano, 0, 60), (bells, 0, 75), (bells, 1, 75), (pad, 0, 80), (strings, 0, 70), (bassgm, 0, 5), (fxm, 0, 70), (fxm, 1, 60)):
    m.cc(ch, 91, rv); m.cc(ch, 7, 110)

kick_times = []; sub = []   # (beat, dur_beats, midi, slide)
P808 = {'groove1': [(0, 6, 0), (10, 4, 0)], 'groove2': [(0, 3, 0), (3, 3, 0), (6, 4, 0), (10, 3, 0), (13, 3, 3)],
        'drop': [(0, 3, 0), (3, 2, 0), (5, 3, 12), (8, 2, 0), (10, 3, 0), (13, 3, 7)], 'late': [(0, 8, 0), (10, 6, 0)]}
KICK = {'groove1': [0, 10], 'groove2': [0, 3, 10], 'drop': [0, 3, 7, 10, 14], 'late': [0, 10]}
HATV = [100, 50, 72, 50, 94, 50, 72, 56, 98, 50, 72, 50, 92, 52, 76, 58]
BELL = [(0, 0), (3, 1), (6, 2), (10, 1), (12, 3)]
nbars = TB // 4
for bar in range(nbars):
    b0 = bar * 4; s = sec_at(b0); c = chord_of(bar); st0 = SEC.get(s, (0, 0))[0]; rel = (b0 - st0) // 4
    if s == 'intro':
        for n in c['pad']: pad.note(0, n, b0, 4.2, 58)
        continue
    if s == 'outro': continue
    # Pad / Keys
    if s != 'break':
        for n in c['pad']: pad.note(0, n, b0, 4.1, {'groove1': 62, 'groove2': 66, 'drop': 70, 'late': 64}[s])
        if s in ('groove1', 'groove2', 'late'):
            for k in (0, 2): [keys.note(0, n, b0 + k, 1.8, 62 if s != 'groove1' else 56) for n in c['keys']]
    else:
        for n in c['pad']: pad.note(0, n, b0, 4.1, 72)
    # Streicher im Drop
    if s == 'drop':
        for n in c['st']: strings.note(0, n, b0, 4.0, 76 if rel % 4 else 86)
    # Glocken-Motiv
    if (s == 'groove2' and rel >= 2) or s in ('drop', 'late'):
        up = 12 if s == 'drop' and rel >= 4 else 0
        for stp, idx in BELL:
            bells.note(0, c['bell'][idx] + up, b0 + stp / 4, 0.6, 88 if s == 'drop' else 78)
            if s == 'drop': bells.note(1, c['bell'][idx] + 12 + up, b0 + stp / 4, 0.4, 52)
    if s == 'groove1' and rel >= 2:
        for stp, idx in BELL[::2]: piano.note(0, c['bell'][idx] - 12, b0 + stp / 4, 1.0, 64)
    if s == 'late':
        for stp, idx in BELL[:3]: piano.note(0, c['bell'][idx] - 12, b0 + stp / 4, 1.2, 60)
    # 808-Sub + Synth-Bass
    if s in P808:
        for stp, ln, ofs in P808[s]:
            if s == 'groove1' and rel < 2 and stp: continue
            sub.append((b0 + stp / 4, ln / 4, c['r'] + ofs, 0)); bassgm.note(0, c['r'] + ofs + 12, b0 + stp / 4, ln / 4 * 0.9, 70 if s != 'drop' else 84)
    if s == 'break': sub.append((b0, 3.6, c['r'], 0))
    # Drums
    if s in KICK:
        for stp in KICK[s]:
            if s == 'groove1' and rel < 2 and stp: continue
            power.note(9, 36, b0 + stp / 4, 0.25, 118); kick_times.append((b0 + stp / 4) * BEAT)
        snare = [8] if s in ('groove1', 'groove2', 'late') else [4, 12]
        if not (s == 'groove1' and rel < 2):
            for stp in snare:
                power.note(9, 38, b0 + stp / 4, 0.25, 104 if s != 'groove1' else 90); tr808.note(9, 39, b0 + stp / 4, 0.25, 110)
        for stp in range(16):
            t = b0 + stp / 4
            if s in ('groove1', 'late'):
                if stp % 2 == 0: tr808.note(9, 42, t, 0.1, HATV[stp] - 10)
            else:
                roll = (s in ('groove2', 'drop')) and rel % 2 == 1 and stp >= 14
                if roll:
                    if stp == 14:
                        for k in range(6): tr808.note(9, 42, t + k * (0.5 / 6), 0.05, 70 + 8 * k)
                else: tr808.note(9, 42, t, 0.1, HATV[stp])
        if s in ('groove2', 'drop') and rel % 2 == 0: tr808.note(9, 46, b0 + 3.5, 0.3, 80)
        if (s == 'groove2' and rel >= 4) or s == 'drop':
            for stp in (0, 3, 6, 8, 11, 14): tr808.note(9, 56, b0 + stp / 4, 0.2, 96 if stp in (0, 8) else 74)
        if s == 'drop' and rel % 4 == 0: power.note(9, 49, b0, 1.0, 110)
# Break: Snare-Roll 16tel → 32tel
bs, be = SEC['break']
for k in range(8): tr808.note(9, 38, bs + k * 0.25, 0.1, 60 + 6 * k)
for k in range(16): tr808.note(9, 38, bs + 2 + k * 0.125, 0.06, 90 + 2 * k)
# Hits: Reverse-Cymbal davor, Pauke + Crash darauf
hits = []
for sh in cues['shots']:
    if sh.get('hit') is not None: hits.append((sh['start'] + sh['hit'], sh['drop'] or sh['final'] or sh['name'] == 'intro'))
for hb, big in hits:
    if big: fxm.note(0, 60, max(0, hb - 4), 4.0, 100)
    fxm.note(1, 45, hb, 2.0, 120 if big else 100); fxm.note(1, 33, hb, 2.0, 110 if big else 0) if big else None
    power.note(9, 49, hb, 1.0, 120 if big else 100); power.note(9, 36, hb, 0.25, 125); kick_times.append(hb * BEAT)
    if big: sub.append((hb, 6.0 if hb >= SEC['outro'][0] else 3.0, 33, 0))
# Intro-Motiv + Outro-Akkord
for b, n in ((4.5, 69), (5.5, 72), (6.5, 76), (7.25, 74)): piano.note(0, n, b, 1.5, 70)
ob = SEC['outro'][0]
for n in (45, 57, 64, 69, 72): piano.note(0, n, ob, 6.0, 84)
for n in (57, 64, 69, 72, 76): strings.note(0, n, ob, 7.0, 90); pad.note(0, n, ob, 8.0, 80)
for n in (76, 81): bells.note(0, n, ob, 2.0, 90)

stems = dict(power=power, tr808=tr808, keys=keys, piano=piano, bells=bells, pad=pad, strings=strings, bassgm=bassgm, fx=fxm)
def render(name, m):
    mid = f'{HERE}/stems/{name}.mid'; wav = f'{HERE}/stems/{name}.wav'; m.save(mid)
    subprocess.run(['fluidsynth', '-ni', '-q', '-g', '0.5', '-r', str(SR), '-T', 'wav', '-O', 's16', '-o', 'synth.reverb.room-size=0.62', '-o', 'synth.reverb.level=0.75',
                    '-o', 'synth.reverb.width=0.9', '-o', 'synth.chorus.active=0', '-F', wav, SF2, mid], check=True, capture_output=True)
    w = wave.open(wav); x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, 2).astype(float) / 32768
    out = np.zeros((N, 2)); out[:min(N, len(x))] = x[:N]; return out
S = {k: render(k, m) for k, m in stems.items()}
# 808-Sub (synthetisch, sauber, mit Glide)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
s808 = np.zeros(N)
for b, d, n, sl in sub:
    dur = d * BEAT + 0.05; t = np.arange(int(dur * SR)) / SR; f = hz(n) * (1 + 0.45 * np.exp(-t * 40))
    ph = 2 * np.pi * np.cumsum(f) / SR; o = np.tanh(np.sin(ph) * 1.7) * np.exp(-t * 1.1)
    e = np.ones(len(t)); a = int(0.004 * SR); r = int(0.04 * SR); e[:a] = np.linspace(0, 1, a); e[-r:] = np.linspace(1, 0, r)
    i = int(b * BEAT * SR); j = min(N, i + len(t)); s808[i:j] += (o * e)[:j - i]
S['sub'] = np.stack([s808, s808], 1)
# Pegel: auf Ziel-RMS (dBFS) bringen
TARGET = dict(power=-15.5, tr808=-19.5, sub=-16.0, bassgm=-25, keys=-24, piano=-23, bells=-22, pad=-25, strings=-23, fx=-21)
def rms_db(x):
    m = x.mean(1); act = np.abs(m) > 1e-4
    return 20 * np.log10(np.sqrt(np.mean(m[act] ** 2)) + 1e-12) if act.any() else -120
for k in S: S[k] = S[k] * 10 ** ((TARGET[k] - rms_db(S[k])) / 20)
# Sidechain: Pads, Keys, Streicher, Synth-Bass atmen mit der Kick
duck = np.ones(N)
for tk in kick_times:
    a = int(tk * SR); b = min(N, a + int(0.3 * SR))
    if a < N: duck[a:b] = np.minimum(duck[a:b], 1 - 0.45 * np.exp(-np.arange(b - a) / SR / 0.09))
for k, dpt in (('pad', 1.0), ('keys', 0.6), ('strings', 0.7), ('bassgm', 0.5), ('bells', 0.25)): S[k] = S[k] * (1 - (1 - duck) * dpt)[:, None]
mix = sum(S.values())
# kurzes "Luftholen" direkt vor dem Drop
a = int((SEC['break'][1] * BEAT - 0.14) * SR); b = int(SEC['break'][1] * BEAT * SR)
mix[a:b] *= np.linspace(1, 0, b - a)[:, None] ** 3 * 0 + 0.0
mix = signal.sosfilt(signal.butter(2, 26, 'highpass', fs=SR, output='sos'), mix, axis=0)
fo = int(2.5 * SR); mix[-fo:] *= (np.linspace(1, 0, fo) ** 1.5)[:, None]
mix *= 0.5 / np.abs(mix).max()
w = wave.open(f'{HERE}/music_promo_raw.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes()); w.close()
# Mastering: Kompressor + Limiter
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{HERE}/music_promo_raw.wav', '-af',
                'acompressor=threshold=0.1:ratio=2.5:attack=12:release=180:makeup=2.2,alimiter=limit=0.89:attack=4:release=60:level=false',
                f'{HERE}/music_promo.wav'], check=True)
w = wave.open(f'{HERE}/music_promo.wav'); x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').reshape(-1, 2).astype(float) / 32768
m = x.mean(1); print('Dauer %.1fs Spitze %.2f' % (len(m) / SR, np.abs(x).max()))
for k, (a_, e_) in SEC.items(): print('%-8s %5.1f–%5.1fs RMS %.3f' % (k, a_ * BEAT, e_ * BEAT, np.sqrt(np.mean(m[int(a_ * BEAT * SR):int(e_ * BEAT * SR)] ** 2))))
f, P = signal.welch(m, SR, nperseg=8192)
print(' | '.join('%d-%d: %.0fdB' % (a_, b_, 10 * np.log10(P[(f >= a_) & (f < b_)].sum() + 1e-12)) for a_, b_ in ((20, 60), (60, 120), (120, 500), (500, 2000), (2000, 6000), (6000, 16000))), '| L/R %.2f' % np.corrcoef(x[:, 0], x[:, 1])[0, 1])
for k in S: print(k, '%.1f dB' % rms_db(S[k]), end='; ')
