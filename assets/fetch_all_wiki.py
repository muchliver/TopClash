import os
import json
import urllib.request
import time

OUT_DIR = r"C:\Users\XQ\.gemini\antigravity-ide\scratch\defense-budget-15\assets\units"
os.makedirs(OUT_DIR, exist_ok=True)

PAGES = {
  "SU57": "Sukhoi_Su-57",
  "F35": "Lockheed_Martin_F-35_Lightning_II",
  "EF2K": "Eurofighter_Typhoon",
  "F16V": "General_Dynamics_F-16_Fighting_Falcon",
  "SU35": "Sukhoi_Su-35",
  "FA50": "KAI_T-50_Golden_Eagle",
  "A29": "Embraer_EMB_314_Super_Tucano",
  "MIG21": "Mikoyan-Gurevich_MiG-21",
  "LEO2": "Leopard_2",
  "K2": "K2_Black_Panther",
  "CH3": "Challenger_2",
  "T90": "T-90",
  "T10": "Type_10",
  "T72": "T-72",
  "STRY": "Stryker",
  "TOYO": "Technical_(vehicle)",
  "T55": "T-54/T-55",
  "PAC3": "MIM-104_Patriot",
  "S400": "S-400_missile_system",
  "SAMPT": "Aster_(missile_family)",
  "IRON": "Iron_Dome",
  "NASAMS": "NASAMS",
  "HQ9": "HQ-9",
  "PANT": "Pantsir_missile_system",
  "AVNG": "AN/TWQ-1_Avenger",
  "STING": "FIM-92_Stinger",
  "IGLA": "9K38_Igla",
  "DDG51": "Arleigh_Burke-class_destroyer",
  "T055": "Type_055_destroyer",
  "VA": "Virginia-class_submarine",
  "FREMM": "FREMM_multipurpose_frigate",
  "KILO": "Kilo-class_submarine",
  "U212": "Type_212_submarine",
  "TJ": "Tuo_Chiang-class_corvette",
  "T22": "Type_022_missile_boat",
  "USV": "Unmanned_surface_vehicle",
  "PB": "Mark_VI_patrol_boat",
  "E7": "Boeing_737_AEW%26C",
  "B21": "Northrop_Grumman_B-21_Raider",
  "HIMARS": "M142_HIMARS",
  "EA18": "Boeing_EA-18G_Growler",
  "PZH": "Panzerhaubitze_2000",
  "SMERCH": "BM-30_Smerch",
  "MQ9": "General_Atomics_MQ-9_Reaper",
  "TB2": "Baykar_Bayraktar_TB2",
  "FPV": "Loitering_munition",
  "SPOT": "Quadcopter"
}

headers = {
    "User-Agent": "DefenseBudget15/1.0 (contact@defense15game.org)"
}

downloaded = 0
for uid, page in PAGES.items():
    dest = os.path.join(OUT_DIR, f"{uid}.jpg")
    if os.path.exists(dest) and os.path.getsize(dest) > 10000:
        continue
    try:
        api_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{page}"
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            thumb = data.get('thumbnail', {})
            img_url = thumb.get('source')
            if not img_url and 'originalimage' in data:
                img_url = data['originalimage'].get('source')
            
            if img_url:
                # 換成更大尺寸的高清圖（例如 600px）
                high_res_url = img_url.replace('/320px-', '/640px-').replace('/330px-', '/640px-')
                img_req = urllib.request.Request(high_res_url, headers=headers)
                try:
                    with urllib.request.urlopen(img_req, timeout=12) as img_resp:
                        with open(dest, "wb") as f:
                            f.write(img_resp.read())
                except:
                    # 回退到原始 thumb
                    with urllib.request.urlopen(urllib.request.Request(img_url, headers=headers), timeout=12) as img_resp:
                        with open(dest, "wb") as f:
                            f.write(img_resp.read())
                print(f"[OK] {uid} -> {dest} ({os.path.getsize(dest)} bytes)")
                downloaded += 1
            else:
                print(f"[NO_IMG] {uid}")
        time.sleep(0.1)
    except Exception as e:
        print(f"[ERR] {uid} ({page}): {e}")

print(f"Total downloaded: {downloaded}")
