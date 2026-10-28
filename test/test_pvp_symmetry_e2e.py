import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

server = subprocess.Popen([sys.executable, "-m", "http.server", "8091", "--directory", r"D:\TopClash"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

host_errors = []
guest_errors = []

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        context_host = browser.new_context()
        context_guest = browser.new_context()

        # 跳過初次進入的新手導覽彈窗 (db15_seen)
        context_host.add_init_script("localStorage.setItem('db15_seen', '1');")
        context_guest.add_init_script("localStorage.setItem('db15_seen', '1');")

        page_host = context_host.new_page()
        page_guest = context_guest.new_page()

        page_host.on("pageerror", lambda err: host_errors.append(str(err)))
        page_guest.on("pageerror", lambda err: guest_errors.append(str(err)))

        print("1. [房主] 開啟遊戲並進入 BO5 線上雙人房...", flush=True)
        page_host.goto("http://localhost:8091/index.html")
        page_host.wait_for_selector("#tabBo3")
        page_host.click("#tabBo3")
        page_host.wait_for_selector("#btnOnlinePvp")
        page_host.click("#btnOnlinePvp")

        print("2. [房主] 等待 WebRTC 房間代碼註冊...", flush=True)
        page_host.wait_for_function("() => { const el = document.querySelector('#pvpRoomCodeDisplay'); return el && el.textContent.length === 6 && !el.textContent.includes('...'); }", timeout=20000)
        room_code = page_host.eval_on_selector("#pvpRoomCodeDisplay", "el => el.textContent.trim()")
        print(f"   --> 房主房間代碼: [{room_code}]", flush=True)

        print("3. [挑戰者] 使用邀請連結加入該房間...", flush=True)
        page_guest.goto(f"http://localhost:8091/index.html?room={room_code}")
        page_guest.wait_for_selector("#btnSubmitJoinRoom")
        page_guest.click("#btnSubmitJoinRoom")

        print("4. [雙方] 等待 WebRTC P2P DataChannel 握手建立...", flush=True)
        page_host.wait_for_selector("#pvpVersusBox:not([hidden])", timeout=20000)
        page_guest.wait_for_selector("#pvpVersusBox:not([hidden])", timeout=20000)
        print("   --> P2P 握手成功！雙方進入對峙席位。", flush=True)

        print("5. [房主] 點擊「正式開戰 (START BO5)」進入選卡配置...", flush=True)
        page_host.wait_for_selector("#btnPvpStartBattle:not([hidden])")
        page_host.click("#btnPvpStartBattle")

        page_host.wait_for_selector("#onlinePvpModal", state="hidden", timeout=10000)
        page_guest.wait_for_selector("#onlinePvpModal", state="hidden", timeout=10000)
        print("   --> 雙方順利進入 5x5 看板。", flush=True)

        print("6. [雙方] 各自隨機補滿 5 槽武器並提交出擊...", flush=True)
        page_host.click("#btnRand")
        page_guest.click("#btnRand")
        time.sleep(1)

        page_host.click("#btnGo")
        time.sleep(0.5)
        page_guest.click("#btnGo")

        print("7. [雙方] 等待進入戰鬥畫面 (#viewBattle)...", flush=True)
        page_host.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)
        page_guest.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)

        # 檢驗標題：房主在左、挑戰者在右
        host_title_a = page_host.eval_on_selector("#unitsCardListA h3 span", "el => el.textContent.trim()")
        host_title_b = page_host.eval_on_selector("#unitsCardListB h3 span", "el => el.textContent.trim()")

        guest_title_a = page_guest.eval_on_selector("#unitsCardListA h3 span", "el => el.textContent.trim()")
        guest_title_b = page_guest.eval_on_selector("#unitsCardListB h3 span", "el => el.textContent.trim()")

        print(f"   [房主端] 左側 (Side A): {host_title_a} | 右側 (Side B): {host_title_b}", flush=True)
        print(f"   [挑戰者端] 左側 (Side A): {guest_title_a} | 右側 (Side B): {guest_title_b}", flush=True)

        assert "本部特遣隊" in host_title_a and "我方" in host_title_a, f"房主端左側應為本部特遣隊我方，實際: {host_title_a}"
        assert "挑戰突擊隊" in host_title_b and "敵方" in host_title_b, f"房主端右側應為挑戰突擊隊敵方，實際: {host_title_b}"

        assert "本部特遣隊" in guest_title_a and "敵方" in guest_title_a, f"挑戰者端左側應為本部特遣隊敵方，實際: {guest_title_a}"
        assert "挑戰突擊隊" in guest_title_b and "我方" in guest_title_b, f"挑戰者端右側應為挑戰突擊隊我方，實際: {guest_title_b}"

        # 檢驗兩端計算出的最終戰局數據 (res.final) 是否完全一致
        host_res_final = page_host.evaluate("() => window.__db15.state.lastRes.final")
        guest_res_final = page_guest.evaluate("() => window.__db15.state.lastRes.final")

        host_hp_a = [u["hp"] for u in host_res_final["A"]]
        host_hp_b = [u["hp"] for u in host_res_final["B"]]

        guest_hp_a = [u["hp"] for u in guest_res_final["A"]]
        guest_hp_b = [u["hp"] for u in guest_res_final["B"]]

        print(f"   [房主端] Side A(房主) 血量: {host_hp_a} | Side B(挑戰者) 血量: {host_hp_b}", flush=True)
        print(f"   [挑戰者] Side A(房主) 血量: {guest_hp_a} | Side B(挑戰者) 血量: {guest_hp_b}", flush=True)

        assert host_hp_a == guest_hp_a, f"Side A 血量不一致! {host_hp_a} vs {guest_hp_a}"
        assert host_hp_b == guest_hp_b, f"Side B 血量不一致! {host_hp_b} vs {guest_hp_b}"

        host_winner = page_host.evaluate("() => window.__db15.state.lastRes.winner")
        guest_winner = page_guest.evaluate("() => window.__db15.state.lastRes.winner")
        print(f"   [戰鬥勝負裁決] 房主判定: {host_winner} | 挑戰者判定: {guest_winner}", flush=True)
        assert host_winner == guest_winner, f"勝負裁決不一致: {host_winner} vs {guest_winner}"

        print(f"   JS 錯誤: 房主={host_errors}, 挑戰者={guest_errors}", flush=True)
        assert len(host_errors) == 0 and len(guest_errors) == 0

        browser.close()
        print("\n🎉 【房主在左、挑戰者在右 且 雙方推演 100% 絕對一致】E2E 驗證圓滿成功！", flush=True)

finally:
    server.terminate()
