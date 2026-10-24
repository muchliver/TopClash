import os
import urllib.request
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

OUT_DIR = r"C:\Users\XQ\.gemini\antigravity-ide\scratch\defense-budget-15\assets\units"
os.makedirs(OUT_DIR, exist_ok=True)

# 權威公有領域軍事照片 URL 對照表
URLS = {
  "SU57": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Sukhoi_Su-57_at_MAKS-2019%2C_Ramenskoye_Airport_%2804%29.jpg/640px-Sukhoi_Su-57_at_MAKS-2019%2C_Ramenskoye_Airport_%2804%29.jpg",
  "F35": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/F-35A_flight_%28cropped%29.jpg/640px-F-35A_flight_%28cropped%29.jpg",
  "EF2K": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Eurofighter_Typhoon_in_flight.jpg/640px-Eurofighter_Typhoon_in_flight.jpg",
  "F16V": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/F-16_Fighting_Falcon_in_flight.jpg/640px-F-16_Fighting_Falcon_in_flight.jpg",
  "SU35": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Sukhoi_Su-35S_at_MAKS-2017_%2835948956972%29.jpg/640px-Sukhoi_Su-35S_at_MAKS-2017_%2835948956972%29.jpg",
  "FA50": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/KAI_FA-50_Fighting_Eagle_in_flight.jpg/640px-KAI_FA-50_Fighting_Eagle_in_flight.jpg",
  "A29": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Embraer_A-29B_Super_Tucano_%28EMB-314%29_USAF.jpg/640px-Embraer_A-29B_Super_Tucano_%28EMB-314%29_USAF.jpg",
  "MIG21": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/MiG-21_Lancer_C_-_01.jpg/640px-MiG-21_Lancer_C_-_01.jpg",
  "LEO2": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Leopard_2_A7V_%28cropped%29.jpg/640px-Leopard_2_A7V_%28cropped%29.jpg",
  "K2": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/K2_Black_Panther_firing.jpg/640px-K2_Black_Panther_firing.jpg",
  "CH3": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Challenger_2_Main_Battle_Tank_MOD_45155823.jpg/640px-Challenger_2_Main_Battle_Tank_MOD_45155823.jpg",
  "T90": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/T-90M_Proryv-3_-_ARMY-2021_%281%29.jpg/640px-T-90M_Proryv-3_-_ARMY-2021_%281%29.jpg",
  "T10": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/JGSDF_Type_10_tank_firing_20120826.jpg/640px-JGSDF_Type_10_tank_firing_20120826.jpg",
  "T72": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/T-72B3_tank_in_2016.jpg/640px-T-72B3_tank_in_2016.jpg",
  "STRY": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Stryker_ICV.jpg/640px-Stryker_ICV.jpg",
  "TOYO": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Toyota_Hilux_technical.jpg/640px-Toyota_Hilux_technical.jpg",
  "T55": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/T-55A_tank_display.jpg/640px-T-55A_tank_display.jpg",
  "PAC3": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Patriot_missile_launch.jpg/640px-Patriot_missile_launch.jpg",
  "S400": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/S-400_Triumf_missile_system.jpg/640px-S-400_Triumf_missile_system.jpg",
  "SAMPT": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/SAMP-T_Aster_30_launcher.jpg/640px-SAMP-T_Aster_30_launcher.jpg",
  "IRON": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Iron_Dome_missile_launch.jpg/640px-Iron_Dome_missile_launch.jpg",
  "NASAMS": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/NASAMS_firing.jpg/640px-NASAMS_firing.jpg",
  "HQ9": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/HQ-9_missile_launcher.jpg/640px-HQ-9_missile_launcher.jpg",
  "PANT": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Pantsir-S1_missile_system.jpg/640px-Pantsir-S1_missile_system.jpg",
  "AVNG": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/AN-TWQ-1_Avenger_firing.jpg/640px-AN-TWQ-1_Avenger_firing.jpg",
  "STING": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/FIM-92_Stinger_soldier.jpg/640px-FIM-92_Stinger_soldier.jpg",
  "IGLA": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/9K38_Igla_operator.jpg/640px-9K38_Igla_operator.jpg",
  "DDG51": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/USS_Arleigh_Burke_%28DDG-51%29_in_the_Atlantic_Ocean.jpg/640px-USS_Arleigh_Burke_%28DDG-51%29_in_the_Atlantic_Ocean.jpg",
  "T055": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/PLAN_Nanchang_101.jpg/640px-PLAN_Nanchang_101.jpg",
  "VA": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/USS_Virginia_SSN-774.jpg/640px-USS_Virginia_SSN-774.jpg",
  "FREMM": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Aquitaine_%28D650%29_in_Brest.jpg/640px-Aquitaine_%28D650%29_in_Brest.jpg",
  "KILO": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Kilo_class_submarine.jpg/640px-Kilo_class_submarine.jpg",
  "U212": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/U-31_%28U212A%29_in_Kiel.jpg/640px-U-31_%28U212A%29_in_Kiel.jpg",
  "TJ": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/ROCN_Tuo_Chiang_%28PGG-618%29.jpg/640px-ROCN_Tuo_Chiang_%28PGG-618%29.jpg",
  "T22": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Type_022_missile_boat.jpg/640px-Type_022_missile_boat.jpg",
  "USV": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Magura_V5_maritime_drone.jpg/640px-Magura_V5_maritime_drone.jpg",
  "PB": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Mark_VI_patrol_boat.jpg/640px-Mark_VI_patrol_boat.jpg",
  "E7": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/RAAF_E-7A_Wedgetail_at_Avalon_2011.jpg/640px-RAAF_E-7A_Wedgetail_at_Avalon_2011.jpg",
  "B21": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/B-21_Raider_first_flight.jpg/640px-B-21_Raider_first_flight.jpg",
  "HIMARS": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/HIMARS_firing_rockets.jpg/640px-HIMARS_firing_rockets.jpg",
  "EA18": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/EA-18G_Growler_in_flight.jpg/640px-EA-18G_Growler_in_flight.jpg",
  "PZH": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Panzerhaubitze_2000_firing.jpg/640px-Panzerhaubitze_2000_firing.jpg",
  "SMERCH": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/BM-30_Smerch_firing.jpg/640px-BM-30_Smerch_firing.jpg",
  "MQ9": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/MQ-9_Reaper_in_flight.jpg/640px-MQ-9_Reaper_in_flight.jpg",
  "TB2": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Bayraktar_TB2_in_flight.jpg/640px-Bayraktar_TB2_in_flight.jpg",
  "FPV": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/FPV_kamikaze_drone.jpg/640px-FPV_kamikaze_drone.jpg",
  "SPOT": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/DJI_Mavic_in_flight.jpg/640px-DJI_Mavic_in_flight.jpg"
}

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (DefenseBudget15/1.0; mailto:contact@example.com)"
}

count = 0
for uid, url in URLS.items():
    dest = os.path.join(OUT_DIR, f"{uid}.jpg")
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        continue
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as response, open(dest, "wb") as f:
            f.write(response.read())
        print(f"Downloaded {uid}: {dest} ({os.path.getsize(dest)} bytes)")
        count += 1
    except Exception as e:
        print(f"Failed {uid}: {e}")

print(f"All done! Downloaded {count} new photos.")
