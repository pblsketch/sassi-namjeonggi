# -*- coding: utf-8 -*-
"""assets/raw/*.png(Codex 생성 원본)를 게임용 webp로 줄인다.

    python tools/process_assets.py

- pt_*   → assets/pt/<이름>.webp  (정사각 320px, 초상)
- sc_*   → assets/sc/<이름>.webp  (가로 1280px, 장면)
- map_*  → assets/sc/<이름>.webp  (가로 900px)
- title_art → assets/ui/title_art.webp (없으면 화풍 시안 A로 대신)
- 종이 질감(assets/ui/paper.webp)은 그림 생성 대신 여기서 직접 만든다.
- 아이콘(icon-192/512.png)과 공유용 그림(og-image.jpg)도 만든다.
"""
import os, glob, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'raw')
OUT = {k: os.path.join(ROOT, 'assets', k) for k in ('pt', 'sc', 'ui')}
for d in OUT.values():
    os.makedirs(d, exist_ok=True)


def fit_width(im, w):
    if im.width <= w:
        return im
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def save_webp(im, path, q=82):
    im.convert('RGB').save(path, 'WEBP', quality=q, method=6)


def portraits():
    for f in sorted(glob.glob(os.path.join(RAW, 'pt_*.png'))):
        name = os.path.splitext(os.path.basename(f))[0]
        im = Image.open(f).convert('RGB')
        s = min(im.size)
        im = im.crop(((im.width - s) // 2, 0, (im.width - s) // 2 + s, s))  # 위쪽(얼굴) 기준
        save_webp(im.resize((320, 320), Image.LANCZOS), os.path.join(OUT['pt'], name + '.webp'), 84)
        print('pt', name)


def scenes():
    for f in sorted(glob.glob(os.path.join(RAW, 'sc_*.png')) + glob.glob(os.path.join(RAW, 'map_*.png'))):
        name = os.path.splitext(os.path.basename(f))[0]
        im = Image.open(f).convert('RGB')
        save_webp(fit_width(im, 900 if name.startswith('map_') else 1280), os.path.join(OUT['sc'], name + '.webp'), 80)
        print('sc', name)
    # 지도가 아직 없으면 남행 배 장면으로 대신한다
    if not os.path.exists(os.path.join(OUT['sc'], 'map_south.webp')) and os.path.exists(os.path.join(OUT['sc'], 'sc_boat.webp')):
        Image.open(os.path.join(OUT['sc'], 'sc_boat.webp')).save(os.path.join(OUT['sc'], 'map_south.webp'), 'WEBP', quality=80)
        print('sc map_south (임시: sc_boat)')


def title():
    src = os.path.join(RAW, 'title_art.png')
    if not os.path.exists(src):
        src = os.path.join(ROOT, 'design', 'style-samples', 'style_a_minhwa.png')
        print('title_art (임시: 화풍 시안 A)')
    im = Image.open(src).convert('RGB')
    save_webp(fit_width(im, 1200), os.path.join(OUT['ui'], 'title_art.webp'), 80)
    return im


def paper():
    """한지 질감: 잔잔한 얼룩 + 가는 섬유. 가로세로로 이어 붙여도 이음새가 보이지 않게 만든다."""
    rng = np.random.default_rng(7)
    n = 512
    base = np.array([239, 226, 195], dtype=np.float32)

    def tile_noise(scale, amp):
        small = rng.normal(0, 1, (n // scale, n // scale))
        im = Image.fromarray(((small - small.min()) / (np.ptp(small) + 1e-6) * 255).astype(np.uint8))
        im = im.resize((n, n), Image.BICUBIC)
        return (np.asarray(im, dtype=np.float32) / 255 - 0.5) * amp

    mottle = tile_noise(32, 10) + tile_noise(8, 6) + tile_noise(2, 4)
    img = np.clip(base[None, None, :] + mottle[..., None] * np.array([1, 1, 1.2]), 0, 255).astype(np.uint8)
    im = Image.fromarray(img, 'RGB')
    d = ImageDraw.Draw(im, 'RGBA')
    random.seed(3)
    for _ in range(420):  # 섬유
        x, y = random.uniform(0, n), random.uniform(0, n)
        L, a = random.uniform(6, 26), random.uniform(0, np.pi)
        c = random.choice([(255, 250, 235, 70), (170, 140, 90, 40), (120, 95, 60, 26)])
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                d.line([(x + ox, y + oy), (x + ox + L * np.cos(a), y + oy + L * np.sin(a))], fill=c, width=1)
    im = im.filter(ImageFilter.GaussianBlur(0.4))
    save_webp(im, os.path.join(OUT['ui'], 'paper.webp'), 78)
    print('ui paper')


def serif_font(size, weight=700):
    for p in (os.path.join(ROOT, 'tools', 'fonts_src', 'NotoSerifKR-VF.ttf'), 'C:/Windows/Fonts/batang.ttc'):
        if os.path.exists(p):
            f = ImageFont.truetype(p, size)
            try:
                f.set_variation_by_axes([weight])
            except Exception:
                pass
            return f
    return ImageFont.load_default()


def icons(title_im):
    for s in (192, 512):
        im = Image.new('RGB', (s, s), (239, 226, 195))
        d = ImageDraw.Draw(im)
        m = s * 0.12
        d.rounded_rectangle([m, m, s - m, s - m], radius=s * 0.08, fill=(179, 52, 42))
        d.rounded_rectangle([m + s * 0.04, m + s * 0.04, s - m - s * 0.04, s - m - s * 0.04], radius=s * 0.05, outline=(255, 240, 225), width=max(2, s // 64))
        f = serif_font(int(s * 0.5), 700)
        d.text((s / 2, s / 2), '謝', font=f, fill=(255, 245, 235), anchor='mm')
        im.save(os.path.join(OUT['ui'], f'icon-{s}.png'))
    # 공유용 그림
    W, H = 1200, 630
    t = title_im.copy()
    r = max(W / t.width, H / t.height)
    t = t.resize((round(t.width * r), round(t.height * r)), Image.LANCZOS)
    t = t.crop(((t.width - W) // 2, (t.height - H) // 2, (t.width - W) // 2 + W, (t.height - H) // 2 + H))
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.rectangle([0, H - 170, W, H], fill=(239, 226, 195, 225))
    brush = os.path.join(ROOT, 'tools', 'fonts_src', 'NanumBrushScript-Regular.ttf')
    fb = ImageFont.truetype(brush, 96) if os.path.exists(brush) else serif_font(72)
    d.text((60, H - 88), '사씨남정기', font=fb, fill=(42, 33, 25), anchor='lm')
    d.text((520, H - 82), '지워진 이름', font=serif_font(52), fill=(179, 52, 42), anchor='lm')
    Image.alpha_composite(t.convert('RGBA'), ov).convert('RGB').save(os.path.join(OUT['ui'], 'og-image.jpg'), quality=85)
    print('ui icons, og-image')


if __name__ == '__main__':
    portraits()
    scenes()
    paper()
    icons(title())
