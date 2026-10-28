import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')

server = subprocess.Popen([sys.executable, "-m", "http.server", "8089", "--directory", r"D:\TopClash"],
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
        page_host.goto("http://localhost:8089/index.html")
        page_host.wait_for_selector("#tabBo3")
        page_host.click("#tabBo3")
        page_host.wait_for_selector("#btnOnlinePvp")
        page_host.click("#btnOnlinePvp")

        print("2. [房主] 等待 WebRTC 房間代碼註冊...", flush=True)
        page_host.wait_for_function("() => { const el = document.querySelector('#pvpRoomCodeDisplay'); return el && el.textContent.length === 6 && !el.textContent.includes('...'); }", timeout=20000)
        room_code = page_host.eval_on_selector("#pvpRoomCodeDisplay", "el => el.textContent.trim()")
        print(f"   --> 房主成功建立房間！房間代碼: [{room_code}]", flush=True)

        print("3. [挑戰者] 使用邀請連結加入該房間...", flush=True)
        page_guest.goto(f"http://localhost:8089/index.html?room={room_code}")
        page_guest.wait_for_selector("#btnSubmitJoinRoom")
        page_guest.click("#btnSubmitJoinRoom")

        print("4. [雙方] 等待 WebRTC P2P DataChannel 握手建立...", flush=True)
        page_host.wait_for_selector("#pvpVersusBox:not([hidden])", timeout=20000)
        page_guest.wait_for_selector("#pvpVersusBox:not([hidden])", timeout=20000)
        print("   --> P2P 直連握手成功！雙方進入對峙席位。", flush=True)

        print("5. [房主] 點擊「正式開戰 (START BO5)」進入配置介面...", flush=True)
        page_host.wait_for_selector("#btnPvpStartBattle:not([hidden])")
        page_host.click("#btnPvpStartBattle")

        page_host.wait_for_selector("#onlinePvpModal", state="hidden", timeout=10000)
        page_guest.wait_for_selector("#onlinePvpModal", state="hidden", timeout=10000)
        print("   --> 雙方順利進入 5x5 軍火庫配置看板。", flush=True)

        print("6. [雙方] 挑選武器陣容 (點擊隨機補滿)...", flush=True)
        page_host.click("#btnRand")
        page_guest.click("#btnRand")
        time.sleep(1)

        print("7. [雙方] 提交陣容並出擊...", flush=True)
        page_host.click("#btnGo")
        time.sleep(0.5)
        page_guest.click("#btnGo")

        print("8. [雙方] 驗證是否順利進入戰鬥畫面 (#viewBattle)...", flush=True)
        page_host.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)
        page_guest.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)

        host_build_hidden = page_host.eval_on_selector("#viewBuild", "el => el.hidden")
        guest_build_hidden = page_guest.eval_on_selector("#viewBuild", "el => el.hidden")

        host_units_count = page_host.eval_on_selector_all(".bu", "els => els.length")
        guest_units_count = page_guest.eval_on_selector_all(".bu", "els => els.length")

        print(f"   --> [房主] 戰鬥視圖展開: {not host_build_hidden}, 戰場部隊卡片數: {host_units_count}", flush=True)
        print(f"   --> [挑戰者] 戰鬥視圖展開: {not guest_build_hidden}, 戰場部隊卡片數: {guest_units_count}", flush=True)

        assert host_build_hidden, "房主配置畫面未隱藏"
        assert guest_build_hidden, "挑戰者配置畫面未隱藏"
        assert host_units_count == 10, f"房主端部隊卡片應有 10 張 (5友+5敵)，實際: {host_units_count}"
        assert guest_units_count == 10, f"挑戰者端部隊卡片應有 10 張 (5友+5敵)，實際: {guest_units_count}"

        print("9. 檢查是否有任何未捕獲的 JavaScript 執行期異常...", flush=True)
        print(f"   房主 JS 錯誤: {host_errors}", flush=True)
        print(f"   挑戰者 JS 錯誤: {guest_errors}", flush=True)
        assert len(host_errors) == 0, f"房主端出現 JS 錯誤: {host_errors}"
        assert len(guest_errors) == 0, f"挑戰者端出現 JS 錯誤: {guest_errors}"

        browser.close()
        print("\n🏆 【E2E 真實雙瀏覽器對戰驗證】圓滿成功！雙方均順利進入戰鬥畫面且零錯誤！", flush=True)

finally:
    server.terminate()
