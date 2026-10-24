import json
import os
from PIL import Image, ImageDraw, ImageFont

with open('all_units.json', 'r', encoding='utf-8') as f:
    units = json.load(f)

# Group by category
cats = {
    'air': '制空打擊 (Air)',
    'armor': '重裝鐵騎 (Armor)',
    'air_defense': '區域防空 (Air Defense)',
    'naval': '制海權威 (Naval)',
    'support': '情報與長程打擊 (Support)'
}

# Try to find a font
font = None
font_paths = [
    'C:/Windows/Fonts/msjh.ttc',
    'C:/Windows/Fonts/simhei.ttf',
    'C:/Windows/Fonts/arial.ttf',
]
for fp in font_paths:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 18)
            break
        except:
            pass
if not font:
    font = ImageFont.load_default()

os.makedirs('contact_sheets', exist_ok=True)

cell_w = 480
cell_h = 320
img_h = 270
banner_h = 50

cols = 4
rows = 5

for cat_key, cat_title in cats.items():
    cat_units = [u for u in units if u['cat'] == cat_key]
    sheet = Image.new('RGB', (cols * cell_w, rows * cell_h + 60), color=(15, 23, 42))
    draw = ImageDraw.Draw(sheet)
    
    # Title banner
    draw.rectangle([0, 0, cols * cell_w, 60], fill=(30, 41, 59))
    draw.text((20, 15), f'{cat_title} — 20 款軍武真實照片盤點', fill=(56, 189, 248), font=font)
    
    for idx, u in enumerate(cat_units):
        c = idx % cols
        r = idx // cols
        x0 = c * cell_w
        y0 = 60 + r * cell_h
        
        # Draw cell background & border
        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=(24, 32, 47), outline=(51, 65, 85))
        
        # Load image
        img_path = u['img']
        if os.path.exists(img_path):
            try:
                with Image.open(img_path) as im:
                    im_resized = im.resize((cell_w, img_h), Image.Resampling.LANCZOS)
                    sheet.paste(im_resized, (x0, y0))
            except Exception as e:
                draw.rectangle([x0, y0, x0 + cell_w, y0 + img_h], fill=(80, 20, 20))
                draw.text((x0 + 10, y0 + 100), f'ERR: {e}', fill=(255, 100, 100), font=font)
        else:
            draw.rectangle([x0, y0, x0 + cell_w, y0 + img_h], fill=(80, 20, 20))
            draw.text((x0 + 10, y0 + 100), 'FILE NOT FOUND', fill=(255, 100, 100), font=font)
            
        # Draw text info banner below image
        draw.rectangle([x0, y0 + img_h, x0 + cell_w, y0 + cell_h], fill=(15, 23, 42))
        info_text = f"[{u['id']}] {u['name']} (${u['cost']})"
        sub_text = f"{u['origin']} | {u['tag'][:18]}"
        draw.text((x0 + 8, y0 + img_h + 4), info_text, fill=(241, 245, 249), font=font)
        draw.text((x0 + 8, y0 + img_h + 26), sub_text, fill=(148, 163, 184), font=font)
        
    out_file = f'contact_sheets/{cat_key}.jpg'
    sheet.save(out_file, quality=90)
    print(f'Saved {out_file}')

print('All 5 contact sheets generated successfully.')
