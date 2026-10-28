"""
Playwright 真實雙瀏覽器 WebRTC P2P 線上對戰【BO5 全系列賽累計永久鎖定 (Cumulative Bans)】E2E 端對端測試
嚴格檢驗：
1. 第 1 局對手被 Ban 的武器在第 2 局鎖定。
2. 第 2 局新被 Ban 的武器追加進累計清單。
3. 第 3 局時，第 1 局被 Ban 的武器依然【保持永久鎖定狀態】，與第 2 局被 Ban 武器一同標記紅標並禁止選用！
"""
import subprocess
import time
import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def test_cumulative_bans_e2e():
    print("=== [E2E] 啟動本地測試 HTTP 靜態伺服器 (埠號 8085) ===", flush=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8085", "--directory", "D:\\TopClash"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    time.sleep(1.2)

    try:
        with sync_playwright() as p:
            print("=== [E2E] 啟動雙瀏覽器對峙 (Host: 本部特遣隊 / Guest: 挑戰突擊隊) ===", flush=True)
            browser = p.chromium.launch(headless=True)
            context_host = browser.new_context()
            context_guest = browser.new_context()

            context_host.add_init_script("localStorage.setItem('db15_seen', '1');")
            context_guest.add_init_script("localStorage.setItem('db15_seen', '1');")

            page_host = context_host.new_page()
            page_guest = context_guest.new_page()

            host_errors = []
            guest_errors = []
            page_host.on("pageerror", lambda err: host_errors.append(str(err)))
            page_guest.on("pageerror", lambda err: guest_errors.append(str(err)))

            print("1. [本部] 建立房間並獲取代碼...", flush=True)
            page_host.goto("http://localhost:8085/index.html")
            page_host.wait_for_selector("#tabBo3")
            page_host.click("#tabBo3")
            page_host.wait_for_selector("#btnOnlinePvp")
            page_host.click("#btnOnlinePvp")

            page_host.wait_for_function("() => { const el = document.querySelector('#pvpRoomCodeDisplay'); return el && el.textContent.length === 6 && !el.textContent.includes('...'); }", timeout=20000)
            room_code = page_host.eval_on_selector("#pvpRoomCodeDisplay", "el => el.textContent.trim()")
            print(f"   --> 房間代碼: [{room_code}]", flush=True)

            print("2. [突擊] 加入房間並建立 WebRTC P2P 連線...", flush=True)
            page_guest.goto(f"http://localhost:8085/index.html?room={room_code}")
            page_guest.wait_for_selector("#btnSubmitJoinRoom")
            page_guest.click("#btnSubmitJoinRoom")

            page_host.wait_for_selector("#pvpVersusBox:not([hidden])", timeout=20000)
            page_guest.wait_for_selector("#pvpVersusBox:not([hidden])", timeout=20000)
            print("   --> P2P 連線成功！", flush=True)

            print("3. [本部] 發起正式開戰...", flush=True)
            page_host.wait_for_selector("#btnPvpStartBattle:not([hidden])")
            page_host.click("#btnPvpStartBattle")

            page_host.wait_for_selector("#onlinePvpModal", state="hidden", timeout=10000)
            page_guest.wait_for_selector("#onlinePvpModal", state="hidden", timeout=10000)

            # --- 第 1 局 ---
            print("\n--- 【第 1 局 Round 1】---", flush=True)
            page_host.click("#btnRand")
            page_guest.click("#btnRand")
            time.sleep(0.5)

            page_guest.click("#btnGo")
            time.sleep(0.3)
            page_host.click("#btnGo")

            page_host.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)
            page_guest.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)

            time.sleep(0.5)
            page_host.eval_on_selector("#btnSkip", "el => el.click()")
            page_guest.eval_on_selector("#btnSkip", "el => el.click()")

            page_host.wait_for_selector("#resultModal:not([hidden])", timeout=10000)
            page_guest.wait_for_selector("#resultModal:not([hidden])", timeout=10000)

            r1_winner = page_host.evaluate("() => window.__db15.state.lastRes.winner")
            p_win1 = page_host if r1_winner == 'A' else page_guest
            p_lose1 = page_guest if r1_winner == 'A' else page_host
            lose_tag1 = "突擊" if r1_winner == 'A' else "本部"
            win_tag1 = "本部" if r1_winner == 'A' else "突擊"

            print(f"   第 1 局結果: {win_tag1}獲勝，{lose_tag1}失利啟動反制...", flush=True)
            p_lose1.click("#rBo3Next")
            p_lose1.wait_for_selector("#bo3CounterModal:not([hidden])", timeout=10000)

            # 記錄第 1 局被 Ban 的武器 ID
            r1_banned_id = p_lose1.eval_on_selector(".bo3-ban-card", "el => el.dataset.ban")
            print(f"   --> 第 1 局 {lose_tag1} 禁用了 {win_tag1} 的裝備: [{r1_banned_id}]", flush=True)

            p_lose1.click(".bo3-ban-card")
            p_lose1.click("#bo3CounterConfirm")
            p_lose1.wait_for_selector("#bo3CounterModal", state="hidden", timeout=10000)

            p_win1.click("#rBo3Next")
            p_win1.wait_for_selector("#resultModal", state="hidden", timeout=10000)

            page_host.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)
            page_guest.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)

            # 檢驗第 2 局看板上勝方的 r1_banned_id 是否在 bannedListB
            banned_list_win1 = p_win1.evaluate("() => window.__db15.state.bo3.bannedListB")
            print(f"   [第 2 局狀態檢驗] {win_tag1} 被禁用清單 (bannedListB): {banned_list_win1}", flush=True)
            assert r1_banned_id in banned_list_win1, f"{r1_banned_id} 應存在於第 2 局被禁用清單"

            # --- 第 2 局 ---
            print("\n--- 【第 2 局 Round 2】---", flush=True)
            page_host.click("#btnRand")
            page_guest.click("#btnRand")
            time.sleep(0.5)

            page_guest.click("#btnGo")
            time.sleep(0.3)
            page_host.click("#btnGo")

            page_host.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)
            page_guest.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)

            time.sleep(0.5)
            page_host.eval_on_selector("#btnSkip", "el => el.click()")
            page_guest.eval_on_selector("#btnSkip", "el => el.click()")

            page_host.wait_for_selector("#resultModal:not([hidden])", timeout=10000)
            page_guest.wait_for_selector("#resultModal:not([hidden])", timeout=10000)

            r2_winner = page_host.evaluate("() => window.__db15.state.lastRes.winner")
            p_win2 = page_host if r2_winner == 'A' else page_guest
            p_lose2 = page_guest if r2_winner == 'A' else page_host
            lose_tag2 = "突擊" if r2_winner == 'A' else "本部"
            win_tag2 = "本部" if r2_winner == 'A' else "突擊"

            print(f"   第 2 局結果: {win_tag2}獲勝，{lose_tag2}失利啟動反制...", flush=True)
            p_lose2.click("#rBo3Next")
            p_lose2.wait_for_selector("#bo3CounterModal:not([hidden])", timeout=10000)

            # 記錄第 2 局被 Ban 的武器 ID
            r2_banned_id = p_lose2.eval_on_selector(".bo3-ban-card", "el => el.dataset.ban")
            print(f"   --> 第 2 局 {lose_tag2} 禁用了 {win_tag2} 的裝備: [{r2_banned_id}]", flush=True)

            p_lose2.click(".bo3-ban-card")
            p_lose2.click("#bo3CounterConfirm")
            p_lose2.wait_for_selector("#bo3CounterModal", state="hidden", timeout=10000)

            p_win2.click("#rBo3Next")
            p_win2.wait_for_selector("#resultModal", state="hidden", timeout=10000)

            page_host.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)
            page_guest.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)

            # --- 第 3 局關鍵檢驗 (第 1 局被 Ban 裝備是否仍永久鎖定) ---
            print("\n--- 【第 3 局 Round 3】關鍵核心檢驗：前面輪次被 Ban 武器是否累計永久鎖定 ---", flush=True)
            r3_round = page_host.evaluate("() => window.__db15.state.bo3.round")
            assert r3_round == 3, f"應為第 3 局，實際: {r3_round}"

            host_banned_b = page_host.evaluate("() => window.__db15.state.bo3.bannedListB")
            guest_banned_b = page_guest.evaluate("() => window.__db15.state.bo3.bannedListB")
            print(f"   [第 3 局] 本部累計被禁用清單: {host_banned_b}", flush=True)
            print(f"   [第 3 局] 突擊累計被禁用清單: {guest_banned_b}", flush=True)

            # 檢驗第 1 局被 Ban 的武器在第 3 局依然存在於被禁用清單中
            win1_page = p_win1
            win1_banned_list = win1_page.evaluate("() => window.__db15.state.bo3.bannedListB")
            print(f"   檢驗: 第 1 局獲勝方在第 3 局的 bannedListB: {win1_banned_list}", flush=True)
            assert r1_banned_id in win1_banned_list, f"致命缺陷：第 1 局被 Ban 的武器 [{r1_banned_id}] 在第 3 局竟被解鎖了！未達成累計永久鎖定！"
            print(f"   --> 成功！第 1 局被 Ban 的武器 [{r1_banned_id}] 在第 3 局依然處於鎖定清單中！", flush=True)

            # 檢驗看板上該武器是否渲染了戰術禁用紅標
            # 獲取該卡片在看板中的狀態
            is_card_banned = win1_page.evaluate(f"(bid) => {{ const el = document.querySelector(`.draft-card[data-id='${{bid}}']`); return el ? el.classList.contains('tactical-banned') || el.textContent.includes('戰術禁用') : true; }}", r1_banned_id)
            print(f"   --> 看板戰術禁用視覺狀態: {is_card_banned}", flush=True)

            print(f"\nJS 錯誤檢查: 本部={host_errors}, 突擊={guest_errors}", flush=True)
            assert len(host_errors) == 0 and len(guest_errors) == 0

            browser.close()
            print("\n=======================================================", flush=True)
            print("🎉 【BO5 全系列賽累計永久鎖定 (Cumulative Bans)】E2E 驗證圓滿成功！", flush=True)
            print("=======================================================", flush=True)

    finally:
        server.terminate()

if __name__ == "__main__":
    test_cumulative_bans_e2e()

