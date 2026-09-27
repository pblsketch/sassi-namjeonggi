# -*- coding: utf-8 -*-
"""게임에 쓰인 글자만 남긴 부분 글꼴(woff2)을 만든다.

    python tools/build_fonts.py

원본 글꼴(모두 SIL Open Font License 1.1)은 tools/fonts_src/에 둔다(저장소에는 올리지 않음).
  - NotoSerifKR-VF.ttf          https://github.com/google/fonts/tree/main/ofl/notoserifkr
  - NanumBrushScript-Regular.ttf https://github.com/google/fonts/tree/main/ofl/nanumbrushscript
없으면 위 주소에서 내려받는다.

글이나 데이터를 고쳐 새 글자가 생겼다면 이 스크립트를 다시 돌리세요.
OFL은 수정본(부분 글꼴 포함)이 원래의 예약 이름을 쓰지 못하게 하므로 글꼴 이름을 SassiMyeongjo·SassiBrush로 바꾼다.
Noto Serif KR에 없는 드문 한자는 브라우저가 기기 글꼴로 대신 그린다.
"""
import os, glob, urllib.request
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'fonts_src')
OUT = os.path.join(ROOT, 'assets', 'fonts')
os.makedirs(SRC, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

URLS = {
    'NotoSerifKR-VF.ttf': 'https://github.com/google/fonts/raw/main/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf',
    'NanumBrushScript-Regular.ttf': 'https://github.com/google/fonts/raw/main/ofl/nanumbrushscript/NanumBrushScript-Regular.ttf',
    # 라이선스 전문(OFL은 글꼴과 함께 라이선스 전문을 배포하도록 요구한다)
    'OFL-NotoSerifKR.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifkr/OFL.txt',
    'OFL-NanumBrushScript.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/nanumbrushscript/OFL.txt',
}
for name, url in URLS.items():
    p = os.path.join(SRC, name)
    if not os.path.exists(p):
        print('내려받는 중', name)
        urllib.request.urlretrieve(url, p)


def used_chars():
    chars = set(chr(c) for c in range(0x20, 0x7F))
    files = glob.glob(os.path.join(ROOT, 'js', '**', '*.js'), recursive=True) + [os.path.join(ROOT, 'index.html')]
    for f in files:
        with open(f, encoding='utf-8') as fh:
            chars |= set(fh.read())
    chars |= set('「」『』·…—–→←↑↓▶▼✎✕“”‘’')
    return ''.join(sorted(c for c in chars if c >= ' '))


def rename(font, family):
    # 예약 글꼴 이름(Reserved Font Name, 예: NanumBrush)이 남지 않도록 고유 ID(3)도 바꾼다
    for rec in font['name'].names:
        if rec.nameID in (1, 4, 16, 21):
            rec.string = family
        elif rec.nameID == 6:
            rec.string = family.replace(' ', '')
        elif rec.nameID == 3:
            rec.string = family.replace(' ', '') + ';subset'


def build(src, out, text, family, weight=None):
    font = TTFont(src)
    if 'fvar' in font:
        font = instancer.instantiateVariableFont(font, {'wght': weight or 400})
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    rename(font, family)
    font.flavor = 'woff2'
    font.save(out)
    print(os.path.basename(out), os.path.getsize(out) // 1024, 'KB')


text = used_chars()
build(os.path.join(SRC, 'NotoSerifKR-VF.ttf'), os.path.join(OUT, 'myeongjo.woff2'), text, 'SassiMyeongjo', 400)
build(os.path.join(SRC, 'NotoSerifKR-VF.ttf'), os.path.join(OUT, 'myeongjo-bold.woff2'), text, 'SassiMyeongjo Bold', 700)
build(os.path.join(SRC, 'NanumBrushScript-Regular.ttf'), os.path.join(OUT, 'brush.woff2'), '사씨남정기지워진이름완주증 ', 'SassiBrush')
with open(os.path.join(OUT, 'OFL.txt'), 'w', encoding='utf-8') as f:
    f.write('assets/fonts의 글꼴은 SIL Open Font License 1.1을 따른다.\n'
            '- myeongjo*.woff2: Noto Serif KR (Copyright 2012 Google Inc.)의 부분 글꼴, 이름을 SassiMyeongjo로 바꿈\n'
            '- brush.woff2: Nanum Brush Script (Copyright (c) 2010, NHN Corporation)의 부분 글꼴, 이름을 SassiBrush로 바꿈\n'
            '  (Nanum·NanumBrush 등은 예약 글꼴 이름이라 부분 글꼴에는 쓰지 않았다)\n'
            '라이선스 전문: https://openfontlicense.org/open-font-license-official-text/ — 아래에 원 글꼴의 저작권 표시와 전문을 그대로 붙인다.\n')
    for name, title in [('OFL-NotoSerifKR.txt', 'Noto Serif KR'), ('OFL-NanumBrushScript.txt', 'Nanum Brush Script')]:
        with open(os.path.join(SRC, name), encoding='utf-8') as lic:
            f.write('\n' + '=' * 72 + '\n' + title + '\n' + '=' * 72 + '\n' + lic.read().replace('\r\n', '\n').rstrip() + '\n')
