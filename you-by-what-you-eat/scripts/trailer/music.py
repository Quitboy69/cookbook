import numpy as np, wave, sys
SR = 44100; DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 106.4
n = int(SR * DUR); t = np.arange(n) / SR
L = np.zeros(n); R = np.zeros(n)
bpm = 96; beat = 60 / bpm
def hz(m): return 440 * 2 ** ((m - 69) / 12)
# Akkorde (MIDI): Cmaj7 | Am7 | Fmaj7 | G6  – je 2 Takte
prog = [([48, 55, 59, 64], 36), ([45, 52, 55, 60], 33), ([41, 48, 52, 57], 29), ([43, 50, 55, 59], 31)]
bar = 4 * beat; chord_len = 2 * bar
def env(len_s, a, r):
    m = int(len_s * SR); e = np.ones(m)
    ai = max(1, int(a * SR)); ri = max(1, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai); e[-ri:] = np.minimum(e[-ri:], np.linspace(1, 0, ri)); return e
def add(sig, start, pan=0.5, gain=1.0):
    i = int(start * SR); j = min(n, i + len(sig))
    if i >= n or j <= i: return
    s = sig[:j - i] * gain; L[i:j] += s * (1 - pan); R[i:j] += s * pan
k = 0; pos = 0.0
while pos < DUR:
    notes, bass = prog[k % 4]
    # Pad: weiche, leicht verstimmte Sinus-Schichten
    m = int(chord_len * SR); tt = np.arange(m) / SR; pad = np.zeros(m)
    for nt in notes:
        for det in (-0.12, 0.0, 0.12):
            pad += np.sin(2 * np.pi * hz(nt + 12) * (1 + det / 100) * tt + np.random.rand() * 6.28)
    pad *= env(chord_len, 1.2, 1.4) * 0.045
    add(pad, pos, 0.5)
    # Bass auf Zählzeit 1 jedes Takts
    for b in range(2):
        bt = int(bar * SR); x = np.arange(bt) / SR
        s = (np.sin(2 * np.pi * hz(bass) * x) + 0.25 * np.sin(2 * np.pi * hz(bass + 12) * x)) * np.exp(-x * 1.1) * env(bar, 0.01, 0.4) * 0.16
        add(s, pos + b * bar, 0.5)
    # Arpeggio: Achtel, sanfte Zupftöne
    arp = [notes[0] + 24, notes[2] + 24, notes[3] + 24, notes[1] + 36, notes[3] + 24, notes[2] + 24, notes[1] + 24, notes[2] + 24]
    for i in range(16):
        nt = arp[i % 8] if (i // 8) % 2 == 0 else arp[::-1][i % 8]
        d = 1.6; x = np.arange(int(d * SR)) / SR
        s = (np.sin(2 * np.pi * hz(nt) * x) + 0.35 * np.sin(2 * np.pi * hz(nt) * 2 * x) * np.exp(-x * 6)) * np.exp(-x * 3.2)
        s *= env(d, 0.004, 0.2) * 0.075
        add(s, pos + i * beat / 2, 0.30 + 0.4 * ((i % 4) / 3))
    pos += chord_len; k += 1
# Dezenter Nachhall: drei Echos mit Rückkopplung
def echo(x, delays=(0.23, 0.41, 0.67), g=(0.32, 0.22, 0.14)):
    y = x.copy()
    for d, gg in zip(delays, g):
        di = int(d * SR); y[di:] += x[:-di] * gg
    return y
L2, R2 = echo(L), echo(R, (0.29, 0.47, 0.71))
m = np.stack([L2, R2], 1)
fade_in = np.minimum(1, t / 2.0); fade_out = np.minimum(1, (DUR - t) / 3.5)
m *= (fade_in * fade_out)[:, None]
m = m / np.max(np.abs(m)) * 0.55
w = wave.open('music.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((m * 32767).astype('<i2').tobytes()); w.close()
print('ok', DUR)
