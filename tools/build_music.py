# -*- coding: utf-8 -*-
"""국립국악원 양금 악구(WAV)를 이어 붙여 장면별 배경음(assets/music/*.mp3)을 만든다.

    python tools/build_music.py

- 원본: tools/music_src/s5-XXX-XXX-Yangum.wav  (용량이 커서 git에 올리지 않는다)
  국립국악원 국악기 디지털 음원 › 악구 다운로드 › 현악기 › 양금에서 받는다.
  https://www.gugak.go.kr/digitaleum/front/phrase/list.do  (공공누리 제1유형: 출처 표시)
- 한 곡 = 한 악곡에서 고른 악구 몇 개. 원곡에서 바로 이어지는 악구는 [ ]로 묶어 끊김 없이 붙이고,
  떨어진 악구끼리는 앞 악구 끝을 짧게 줄여(0.08초) 다음 악구 첫 박에 붙인다(장단 길이는 그대로).
- 모노 44.1kHz로 합치고 음량을 맞춘 뒤(RMS 기준, 넘치는 봉우리만 살짝 누름) mp3 96kbps로 줄인다.
- 곡 끝은 천천히 줄여 끝내고, 되풀이 사이의 쉼은 게임(js/core/audio.js)에서 넣는다.
"""
import os, shutil, subprocess, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'music_src')
OUT = os.path.join(ROOT, 'assets', 'music')
SR = 44100
TARGET_RMS = -19.0   # dBFS(소리가 나는 부분 기준). 게임에서 배경음 크기(0.5)를 곱하면 예전 합성 곡과 비슷해진다
CEIL = -1.0          # 봉우리 한도(dBFS)
MAX_GR = 3.0         # 봉우리를 이보다 많이 눌러야 하면 곡 전체를 덜 키운다(느리고 드문 곡은 조금 작게 남는다)
BITRATE = '96k'
FFMPEG = shutil.which('ffmpeg') or os.path.expanduser('~/ffmpeg/bin/ffmpeg.exe')

# 곡 이름: (악곡, [악구 묶음...], 끝 줄이기(초))
TRACKS = {
    'shop':     ('우조가락도드리', [['133-010'], ['133-015', '133-020'], ['133-030'], ['133-040'], ['133-050'], ['133-060']], 1.5),
    'peace':    ('세령산', [['113-010'], ['113-020'], ['113-030']], 1.5),
    'unease':   ('계면가락도드리', [['131-010'], ['131-015'], ['131-030'], ['131-035'], ['131-040'], ['131-050'], ['131-060'], ['131-065']], 1.5),
    'scheme':   ('언편', [['223-010'], ['223-020'], ['223-030'], ['223-040'], ['223-050'], ['223-060']], 1.5),
    'sorrow':   ('상령산', [['111-010'], ['111-015']], 2.0),
    'wander':   ('윗도드리', [['122-010'], ['122-020'], ['122-025'], ['122-040']], 1.5),
    'dream':    ('보허사', [['420-012', '420-015', '420-018']], 2.0),
    'hope':     ('타령', [['118-010', '118-020'], ['118-035'], ['118-055'], ['118-060', '118-070'], ['118-080'], ['118-090']], 1.5),
    'judgment': ('편락', [['231-010'], ['231-020'], ['231-030'], ['231-040'], ['231-050'], ['231-075']], 1.5),
    'resolve':  ('하현도드리', [['116-010'], ['116-015'], ['116-030']], 2.0),
    'finale':   ('군악', [['119-030', '119-040'], ['119-070', '119-075'], ['119-080', '119-090'], ['119-100']], 1.5),
}


def load(code):
    sr, d = wavfile.read(os.path.join(SRC, f's5-{code}-Yangum.wav'))
    assert sr == SR, (code, sr)
    if d.dtype == np.int32:      # 24비트는 int32 위쪽에 채워져 온다
        x = d.astype(np.float64) / 2147483648.0
    elif d.dtype == np.int16:
        x = d.astype(np.float64) / 32768.0
    else:
        x = d.astype(np.float64)
    return x.mean(axis=1) if x.ndim == 2 else x


def fade(x, n_in, n_out):
    x = x.copy()
    if n_in:
        x[:n_in] *= np.linspace(0, 1, n_in) ** 2
    if n_out:
        x[-n_out:] *= np.linspace(1, 0, n_out) ** 2
    return x


def trim_tail(x, thresh_db=-60, keep=0.4):
    """끝의 긴 무음을 줄인다(울림 0.4초는 남긴다)."""
    thr = 10 ** (thresh_db / 20)
    idx = np.nonzero(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    return x[:min(len(x), idx[-1] + int(keep * SR))]


def active_rms_db(x):
    """소리가 나는 부분(50ms 창, 가장 큰 창보다 40dB 아래는 뺌)의 RMS."""
    w = int(0.05 * SR)
    n = len(x) // w
    e = (x[:n * w].reshape(n, w) ** 2).mean(axis=1)
    e = e[e > e.max() * 1e-4]
    return 10 * np.log10(e.mean())


def limit(x, ceil_db):
    """넘치는 봉우리만 부드럽게 누른다(앞을 10ms 내다보고 줄였다가 풀어 준다)."""
    c = 10 ** (ceil_db / 20)
    need = np.minimum(1.0, c / np.maximum(np.abs(x), 1e-9))
    L = int(0.01 * SR)
    g = minimum_filter1d(need, size=2 * L + 1)
    g = uniform_filter1d(g, size=L)
    g = np.minimum(g, need)
    return x * g, 20 * np.log10(g.min())


def build(name, piece, groups, tail):
    parts = []
    for gi, grp in enumerate(groups):
        edge = int(0.004 * SR)  # 이어지는 악구끼리도 딸깍 소리가 나지 않게 4ms씩 여닫는다
        seg = np.concatenate([fade(load(c), edge, edge) for c in grp])
        last = gi == len(groups) - 1
        if last:
            seg = trim_tail(seg)
        # 떨어진 악구 사이: 앞 악구 끝을 짧게 줄이고 다음 악구 머리는 아주 짧게 연다
        seg = fade(seg, int(0.006 * SR), int((tail if last else 0.08) * SR))
        parts.append(seg)
    x = np.concatenate(parts)
    x *= 10 ** ((TARGET_RMS - active_rms_db(x)) / 20)
    over = 20 * np.log10(np.abs(x).max()) - CEIL - MAX_GR
    if over > 0:
        x *= 10 ** (-over / 20)
    x, gr = limit(x, CEIL)
    return x, gr


def encode(x, path):
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, 'x.wav')
        wavfile.write(wav, SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-b:a', BITRATE,
                        '-map_metadata', '-1', path], check=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    print(f"{'곡':10}{'악곡':12}{'길이(초)':>8}{'RMS':>8}{'봉우리':>8}{'누름(dB)':>9}{'파일(KB)':>9}")
    for name, (piece, groups, tail) in TRACKS.items():
        x, gr = build(name, piece, groups, tail)
        path = os.path.join(OUT, name + '.mp3')
        encode(x, path)
        peak = 20 * np.log10(np.abs(x).max())
        print(f"{name:10}{piece:12}{len(x) / SR:8.1f}{active_rms_db(x):8.1f}{peak:8.1f}{gr:9.1f}{os.path.getsize(path) / 1024:9.0f}")


if __name__ == '__main__':
    main()
