#!/usr/bin/env python3
"""jr-status 公司 logo 构建脚本
- 从主站仓库 mini-japanrail-3d/logos（本地克隆路径由参数传入）复制 159 家公司在用 logo，
  统一缩放至 max=160px 并优化 PNG，输出到 assets/logos/
- 自动提取每枚 logo 的「品牌主色」（去透明后按饱和度加权取主色）
- 生成 assets/logo-map.js：LOGO_FILES（公司名→文件名，含别名）与 LOGO_COLORS（公司名→RGB 数组）
用法: python3 scripts/build_logos.py <主站logo根目录>
"""
import os, sys, json, colorsys
from PIL import Image, ImageOps

SRC_ROOT = sys.argv[1]
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'logos')
OUT_DIR = os.path.normpath(OUT_DIR)
MAX_EDGE = 160

# status.json 公司名 → 主站 logo 文件名的别名（其余同名直连）
ALIAS = {
    'ウィラートレインズ': 'WILLER TRAINS',
    '上毛電鉄': '上毛電気鉄道',
    '京福電鉄': '京福電気鉄道',
    '京阪電鉄': '京阪電気鉄道',
    '北大阪急行電鉄': '北大阪急行',
    '南海電鉄': '南海電気鉄道',
    '大阪メトロ': '大阪市高速電気軌道',
    '富士山麓電鉄': '富士山麓電気鉄道',
    '山陽電鉄': '山陽電気鉄道',
    '札幌市交通事業振興公社': '札幌市交通局',
    '横浜シーサイドライン': '横浜新都市交通',
    '熊本電鉄': '熊本電気鉄道',
    '筑豊電鉄': '筑豊電気鉄道',
    '銚子電鉄': '銚子電気鉄道',
    '阪神電鉄': '阪神電気鉄道',
    '高松琴平電鉄': '高松琴平電気鉄道',
}

def find_src(leaf):
    """在 logo 库中按文件名（不含扩展名）查找完整路径"""
    for dp, _, files in os.walk(SRC_ROOT):
        for f in files:
            if f == leaf + '.png':
                return os.path.join(dp, f)
    return None

def dominant_color(im):
    """提取 logo 主色：忽略透明像素，按「出现频次 × 饱和度」加权取色"""
    im = im.convert('RGBA')
    im.thumbnail((96, 96))
    px = im.load()
    w, h = im.size
    buckets = {}
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            hsv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            key = (r // 32, g // 32, b // 32)
            if key not in buckets:
                buckets[key] = [0, 0, 0, 0]  # cnt, r, g, b
            bkt = buckets[key]
            bkt[0] += 1
            bkt[1] += r; bkt[2] += g; bkt[3] += b
    if not buckets:
        return (56, 189, 248)
    # 权重 = 数量 * (0.3 + 饱和度)
    best = max(buckets.values(), key=lambda v: v[0] * (0.3 + max(c for c in (0, 0, 0)) ))
    # 简化：直接按数量取最多出现色，再在相近色中挑饱和度高的
    top = sorted(buckets.items(), key=lambda kv: kv[1][0], reverse=True)[:6]
    best_key, best_val = top[0]
    r, g, b = best_val[1] // best_val[0], best_val[2] // best_val[0], best_val[3] // best_val[0]
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if s < 0.12 or v < 0.15:  # 灰/白/黑 → 在次优候选中找更饱和的
        for key, val in top[1:]:
            r2 = val[1] // val[0]; g2 = val[2] // val[0]; b2 = val[3] // val[0]
            h2, s2, v2 = colorsys.rgb_to_hsv(r2 / 255, g2 / 255, b2 / 255)
            if s2 > s and v2 > 0.2:
                r, g, b, s = r2, g2, b2, s2
    # 深色主题下提亮一档，保证色条可见
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if v < 0.35:
        v = min(1.0, v * 1.6)
        r, g, b = [int(c * 255) for c in colorsys.hsv_to_rgb(h, s, v)]
    return (r, g, b)

def main():
    d = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'data', 'status.json')))
    comps = sorted(set(l['company'] for l in d['lines']))
    os.makedirs(OUT_DIR, exist_ok=True)

    logo_files, logo_colors, missing = {}, {}, []
    for comp in comps:
        leaf = ALIAS.get(comp, comp)
        src = find_src(leaf)
        if not src:
            missing.append(comp)
            continue
        im = Image.open(src)
        im = ImageOps.exif_transpose(im).convert('RGBA')
        im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        out = os.path.join(OUT_DIR, leaf + '.png')
        im.save(out, 'PNG', optimize=True)
        logo_files[comp] = leaf + '.png'
        logo_colors[comp] = dominant_color(Image.open(src))

    print(f'公司 {len(comps)} / logo 生成 {len(logo_files)} / 缺失 {len(missing)}')
    for m in missing:
        print('  MISSING:', m)

    # 少量人工校色（自动提取对白底文字类 logo 不稳定）
    MANUAL = {
        'JR東日本': (0, 178, 99), 'JR東海': (247, 115, 33), 'JR西日本': (0, 114, 188),
        'JR北海道': (44, 180, 49), 'JR四国': (0, 167, 227), 'JR九州': (230, 0, 18),
        '東京メトロ': (0, 155, 191), '東急電鉄': (238, 0, 17), '小田急電鉄': (0, 128, 200),
        '京王電鉄': (0, 74, 154), '西武鉄道': (0, 64, 152), '東武鉄道': (0, 62, 143),
        '京成電鉄': (0, 60, 138), '京浜急行電鉄': (204, 0, 51), '相模鉄道': (0, 132, 61),
        '名古屋鉄道': (199, 0, 47), '近畿日本鉄道': (201, 0, 40), '阪急電鉄': (119, 18, 58),
        '阪神電鉄': (237, 184, 0), '京阪電鉄': (0, 93, 158), '南海電鉄': (0, 63, 137),
        '西日本鉄道': (0, 63, 137), 'JR貨物': (0, 71, 157),
    }
    for k, v in MANUAL.items():
        if k in logo_colors:
            logo_colors[k] = v

    # 写 logo-map.js
    js_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'logo-map.js')
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write('/* 公司 logo 映射：由 scripts/build_logos.py 自动生成，请勿手改 */\n')
        f.write('const LOGO_FILES = ' + json.dumps(logo_files, ensure_ascii=False, indent=0) + ';\n\n')
        f.write('const LOGO_COLORS = ' + json.dumps(logo_colors, ensure_ascii=False, indent=0) + ';\n')
    print('written:', js_path, f'({os.path.getsize(js_path)} bytes)')

if __name__ == '__main__':
    main()
