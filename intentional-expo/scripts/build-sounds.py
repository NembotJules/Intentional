"""
US-129 · The celebration jingles (assets/sounds/*.m4a), composed here as code so they're ours (no licences) and can
be tweaked. Bright C major, warm and playful like Flick: marimba and bell melodies, a soft brass fanfare, a harp
glissando for the world unlock, a warm pad underneath, a timpani thump on the big moments, a little reverb.

    python3 scripts/build-sounds.py        # needs numpy, scipy and ffmpeg (AAC)

  promise    onboarding: "Congratulations, <name>! You just made a promise to yourself."   ~5.8 s
  stage      Flick reaches a new stage                                                     ~3.4 s
  world      a new world unlocked (soft and mysterious, the harp opens it at 1.0 s with the padlock)  ~4.6 s
  milestone  an hours milestone                                                            ~2.6 s
  session    a focus session completed                                                     ~2.4 s
"""
import os
import subprocess
import tempfile

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, lfilter

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'sounds')
rng = np.random.default_rng(7)  # the same files every build

NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def hz(name):
    """'C5', 'F#4', 'Bb3' → Hz."""
    pitch, octave = name[:-1], int(name[-1])
    semi = NOTE[pitch[0]] + (1 if '#' in pitch else -1 if 'b' in pitch else 0)
    return 440.0 * 2 ** ((semi + 12 * (octave + 1) - 69) / 12)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def env(n, attack, decay=None, release=None, sustain_to=None):
    """Attack then exponential decay (decay in s), or attack / hold / release for sustained notes."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    if decay is not None:
        return a * np.exp(-t / decay)
    e = a.copy()
    if release:
        r0 = (sustain_to or n / SR) - release
        e *= np.clip(1 - (t - r0) / release, 0, 1)
    return e


def partials(f, dur, parts, attack=0.003):
    t = t_axis(dur)
    out = np.zeros_like(t)
    for ratio, amp, decay in parts:
        if f * ratio < SR / 2.2:
            out += amp * np.sin(2 * np.pi * f * ratio * t + rng.uniform(0, 6.28)) * env(len(t), attack, decay)
    return out


def bell(f, dur=2.4):
    return partials(f, dur, [(1, 1, 1.4), (2, 0.45, 0.9), (2.76, 0.32, 0.55), (5.4, 0.14, 0.25), (8.93, 0.06, 0.12)])


def marimba(f, dur=1.0):
    return partials(f, dur, [(1, 1, 0.42), (3.93, 0.32, 0.09), (9.2, 0.08, 0.03)], attack=0.002)


def harp(f, dur=1.8):
    """Karplus-Strong pluck."""
    n = int(dur * SR)
    period = int(SR / f)
    buf = rng.uniform(-1, 1, period)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return lowpass(out, 5000) * 0.9


def saw(f, t):
    return 2 * ((f * t) % 1) - 1


def lowpass(x, cutoff, order=2):
    b, a = butter(order, cutoff / (SR / 2))
    return lfilter(b, a, x)


def brass(f, dur, attack=0.04):
    t = t_axis(dur)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t / 0.3, 0, 1)
    x = sum(saw(f * d * vib, t) for d in (1, 1.004, 0.996)) / 3
    bright = lowpass(x, 2600) * env(len(t), attack, release=0.18, sustain_to=dur)
    return lowpass(bright, 4200) * 0.55


def pad(fs, dur, attack=0.35, release=0.9):
    t = t_axis(dur)
    x = np.zeros_like(t)
    for f in fs:
        for d in (1, 1.0035, 0.9965):
            x += saw(f * d, t + rng.uniform(0, 1))
    return lowpass(x / (3 * len(fs)), 1500) * env(len(t), attack, release=release, sustain_to=dur) * 0.6


def timpani(dur=1.2, f0=110):
    t = t_axis(dur)
    f = f0 * (1 + 0.6 * np.exp(-t / 0.03))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35)
    hit = lowpass(rng.uniform(-1, 1, len(t)), 900) * np.exp(-t / 0.02) * 0.5
    return body + hit


def sparkle(start, dur, notes, count, mix):
    """Little high bells scattered over a span (the shimmer of magic)."""
    for k in range(count):
        at = start + dur * (k / count) + rng.uniform(0, dur / count * 0.5)
        mix.add(at, bell(hz(notes[k % len(notes)]), 1.2) * 0.12)


class Mix:
    def __init__(self, dur):
        self.x = np.zeros(int(dur * SR))

    def add(self, at, sig, gain=1.0):
        i = int(at * SR)
        j = min(len(self.x), i + len(sig))
        self.x[i:j] += sig[: j - i] * gain

    def render(self, wet=0.22):
        # a small hall: decaying filtered noise as the impulse
        n = int(1.8 * SR)
        ir = lowpass(rng.uniform(-1, 1, n), 5200) * np.exp(-np.arange(n) / SR / 0.45)
        rev = fftconvolve(self.x, ir)[: len(self.x)]
        rev *= np.max(np.abs(self.x)) / (np.max(np.abs(rev)) + 1e-9)
        y = self.x * (1 - wet) + rev * wet
        y[-int(0.15 * SR):] *= np.linspace(1, 0, int(0.15 * SR))
        return y / np.max(np.abs(y)) * 0.84  # peak about -1.5 dBFS


def promise():
    m = Mix(6.2)
    m.add(0.0, timpani(1.4, 98), 0.55)
    m.add(0.0, pad([hz('C4'), hz('E4'), hz('G4')], 2.4), 0.8)
    for k, n in enumerate(['C5', 'E5', 'G5', 'C6']):
        m.add(0.0 + k * 0.12, marimba(hz(n)), 0.5)
    # the fanfare: da-da DAAA
    for at, n, d in [(0.62, 'G4', 0.16), (0.82, 'G4', 0.16), (1.02, 'C5', 1.3)]:
        m.add(at, brass(hz(n), d), 0.5)
        m.add(at, brass(hz({'G4': 'D5', 'C5': 'E5'}[n]), d), 0.32)
    m.add(1.02, timpani(1.0, 130), 0.4)
    for n in ['C6', 'E6', 'G6']:
        m.add(1.02, bell(hz(n)), 0.22)
    sparkle(1.1, 0.9, ['C7', 'E7', 'G7', 'D7', 'A6'], 9, m)
    # F → G → C, warm and resolved
    m.add(2.3, pad([hz('F3'), hz('A4'), hz('C5')], 1.0), 0.75)
    m.add(2.3, marimba(hz('A5')), 0.4)
    m.add(2.55, marimba(hz('C6')), 0.4)
    m.add(3.1, pad([hz('G3'), hz('B4'), hz('D5')], 1.0), 0.75)
    m.add(3.1, marimba(hz('B5')), 0.4)
    m.add(3.35, marimba(hz('D6')), 0.4)
    m.add(3.9, pad([hz('C3'), hz('E4'), hz('G4'), hz('C5')], 2.2, release=1.4), 0.9)
    m.add(3.9, brass(hz('C5'), 1.6), 0.45)
    m.add(3.9, brass(hz('G4'), 1.6), 0.3)
    m.add(3.9, timpani(1.4, 98), 0.5)
    for n in ['C6', 'G6', 'C7']:
        m.add(3.9, bell(hz(n), 2.2), 0.2)
    return m.render(0.26)


def stage():
    m = Mix(3.6)
    for k, n in enumerate(['G4', 'A4', 'B4']):
        m.add(k * 0.1, marimba(hz(n)), 0.5)
    m.add(0.32, timpani(1.2, 110), 0.55)
    for n, g in [('C5', 0.5), ('E5', 0.35), ('G5', 0.3)]:
        m.add(0.32, brass(hz(n), 1.4), g)
    m.add(0.32, pad([hz('C3'), hz('G4'), hz('E4')], 2.6, attack=0.05, release=1.3), 0.7)
    for n in ['C6', 'E6', 'G6']:
        m.add(0.32, bell(hz(n)), 0.22)
    sparkle(0.45, 1.0, ['E7', 'G7', 'C7', 'D7'], 8, m)
    m.add(1.0, marimba(hz('G5')), 0.35)
    m.add(1.12, marimba(hz('C6')), 0.4)
    return m.render(0.24)


def world():
    m = Mix(4.8)
    # 0–1 s: something hides under the padlock (soft, a little mysterious)
    m.add(0.0, pad([hz('A3'), hz('C4'), hz('E4')], 1.3, attack=0.3, release=0.4), 0.45)
    m.add(0.15, harp(hz('E5')), 0.35)
    m.add(0.5, harp(hz('D5')), 0.3)
    m.add(0.78, harp(hz('B4')), 0.3)
    # 1.0 s: the padlock pops: a harp glissando up two octaves…
    gliss = ['C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6', 'G6', 'A6', 'C7']
    for k, n in enumerate(gliss):
        m.add(1.0 + k * 0.032, harp(hz(n), 1.4), 0.32)
    # …into a bright world (C with a 9th), bells, sparkles, and Flick lands at 1.5 s
    m.add(1.38, pad([hz('C3'), hz('E4'), hz('G4'), hz('D5')], 3.0, attack=0.12, release=1.6), 0.85)
    for n in ['C6', 'E6', 'G6', 'D7']:
        m.add(1.38, bell(hz(n), 2.6), 0.2)
    sparkle(1.4, 1.4, ['G7', 'E7', 'D7', 'C7', 'A6'], 12, m)
    m.add(1.5, timpani(1.2, 98), 0.45)
    for k, n in enumerate(['C6', 'G5', 'E6', 'C7']):
        m.add(1.55 + k * 0.13, marimba(hz(n)), 0.38)
    return m.render(0.3)


def milestone():
    m = Mix(2.8)
    for k, n in enumerate(['E5', 'G5', 'C6']):
        m.add(k * 0.11, marimba(hz(n)), 0.5)
    m.add(0.36, marimba(hz('E6')), 0.45)
    m.add(0.36, bell(hz('E6'), 2.0), 0.25)
    m.add(0.36, bell(hz('C7'), 2.0), 0.14)
    m.add(0.0, pad([hz('C4'), hz('E4'), hz('G4')], 2.3, attack=0.2, release=1.2), 0.55)
    sparkle(0.4, 0.7, ['G7', 'E7', 'C7'], 5, m)
    return m.render(0.24)


def session():
    m = Mix(2.6)
    for k, n in enumerate(['C5', 'E5', 'G5', 'B5', 'E6']):
        m.add(k * 0.14, bell(hz(n), 2.0), 0.32 if k < 4 else 0.24)
    m.add(0.0, pad([hz('C4'), hz('E4'), hz('G4'), hz('B4')], 2.2, attack=0.3, release=1.2), 0.5)
    m.add(0.56, marimba(hz('C6')), 0.3)
    return m.render(0.28)


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, make in [('promise', promise), ('stage', stage), ('world', world), ('milestone', milestone), ('session', session)]:
        y = make()
        with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
            wavfile.write(tmp.name, SR, (y * 32767).astype(np.int16))
            dst = os.path.join(OUT, f'{name}.m4a')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp.name, '-c:a', 'aac', '-b:a', '128k', '-ac', '1', dst], check=True)
        print(f'{name:10s} {len(y) / SR:.1f} s → assets/sounds/{name}.m4a')


if __name__ == '__main__':
    main()
