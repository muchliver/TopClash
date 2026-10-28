"""
Playwright 真實雙瀏覽器 WebRTC P2P 線上對戰【BO5 第二輪 (Round 2) 自動無縫開戰】E2E 端對端測試
"""
import subprocess
import time
import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_round2_e2e():
    print("=== [E2E] 啟動本地測試 HTTP 靜態伺服器 (埠號 8098) ===", flush=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8098", "--directory", "D:\\TopClash"],
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

            print("1. [本部] 開啟遊戲並開啟線上雙人對戰 Modal...", flush=True)
            page_host.goto("http://localhost:8098/index.html")
            page_host.wait_for_selector("#tabBo3")
            page_host.click("#tabBo3")
            page_host.wait_for_selector("#btnOnlinePvp")
            page_host.click("#btnOnlinePvp")

            print("2. [本部] 等待 WebRTC 房間代碼註冊...", flush=True)
            page_host.wait_for_function("() => { const el = document.querySelector('#pvpRoomCodeDisplay'); return el && el.textContent.length === 6 && !el.textContent.includes('...'); }", timeout=20000)
            room_code = page_host.eval_on_selector("#pvpRoomCodeDisplay", "el => el.textContent.trim()")
            print(f"   --> 房間代碼: [{room_code}]", flush=True)

            print("3. [突擊] 使用邀請連結加入房間...", flush=True)
            page_guest.goto(f"http://localhost:8098/index.html?room={room_code}")
            page_guest.wait_for_selector("#btnSubmitJoinRoom")
            page_guest.click("#btnSubmitJoinRoom")

            print("4. [雙方] 等待 WebRTC P2P DataChannel 握手建立...", flush=True)
            page_host.wait_for_selector("#pvpVersusBox:not([hidden])", timeout=20000)
            page_guest.wait_for_selector("#pvpVersusBox:not([hidden])", timeout=20000)
            print("   --> P2P 連線成功！", flush=True)

            print("5. [本部] 點擊「正式開戰 (START BO5)」發起系列賽...", flush=True)
            page_host.wait_for_selector("#btnPvpStartBattle:not([hidden])")
            page_host.click("#btnPvpStartBattle")

            page_host.wait_for_selector("#onlinePvpModal", state="hidden", timeout=10000)
            page_guest.wait_for_selector("#onlinePvpModal", state="hidden", timeout=10000)

            # --- 第一輪 (Round 1) ---
            print("\n--- 【第一輪 Round 1】配置並出擊 ---", flush=True)
            page_host.click("#btnRand")
            page_guest.click("#btnRand")
            time.sleep(0.5)

            page_host.click("#btnGo")
            time.sleep(0.3)
            page_guest.click("#btnGo")

            print("   等待進入第 1 輪戰鬥畫面...", flush=True)
            page_host.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)
            page_guest.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)

            print("   點擊【跳過推演】快速結算...", flush=True)
            time.sleep(0.5)
            page_host.eval_on_selector("#btnSkip", "el => el.click()")
            page_guest.eval_on_selector("#btnSkip", "el => el.click()")

            print("   等待第 1 輪結算報告彈窗 (#resultModal)...", flush=True)
            page_host.wait_for_selector("#resultModal:not([hidden])", timeout=10000)
            page_guest.wait_for_selector("#resultModal:not([hidden])", timeout=10000)

            round1_winner = page_host.evaluate("() => window.__db15.state.lastRes.winner")
            print(f"   第 1 輪勝方: {round1_winner} (A=本部, B=突擊, draw=平局)", flush=True)

            if round1_winner == 'draw':
                print("\n--- 【平局處理】雙方無人被 Ban，直接進入第 2 局 ---", flush=True)
                page_host.click("#rBo3Next")
                page_guest.click("#rBo3Next")
            else:
                if round1_winner == 'A':
                    page_winner = page_host
                    page_loser = page_guest
                    winner_role = "本部"
                    loser_role = "突擊"
                else:
                    page_winner = page_guest
                    page_loser = page_host
                    winner_role = "突擊"
                    loser_role = "本部"

                print(f"\n--- 【進入第 2 輪過渡】勝方: {winner_role}, 敗方: {loser_role} ---", flush=True)
                
                # 敗方點擊戰術反制
                print(f"6. [{loser_role}] 點擊啟動戰術反制...", flush=True)
                page_loser.click("#rBo3Next")
                page_loser.wait_for_selector("#bo3CounterModal:not([hidden])", timeout=10000)

                print(f"   [{loser_role}] 選擇禁用第 1 件敵方裝備並確認...", flush=True)
                page_loser.click(".bo3-ban-card")
                page_loser.click("#bo3CounterConfirm")
                page_loser.wait_for_selector("#bo3CounterModal", state="hidden", timeout=10000)

                # 勝方點擊進入第 2 局
                print(f"7. [{winner_role}] 點擊進入第 2 局...", flush=True)
                page_winner.click("#rBo3Next")
                page_winner.wait_for_selector("#resultModal", state="hidden", timeout=10000)

            print("8. [雙方] 確認已成功進入第 2 局看板 (#viewBuild)...", flush=True)
            page_host.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)
            page_guest.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)

            round_host = page_host.evaluate("() => window.__db15.state.bo3.round")
            round_guest = page_guest.evaluate("() => window.__db15.state.bo3.round")
            print(f"   [局數驗證] 本部局數: {round_host} | 突擊局數: {round_guest}", flush=True)
            assert round_host == 2, f"本部局數應為 2，實際: {round_host}"
            assert round_guest == 2, f"突擊局數應為 2，實際: {round_guest}"

            # --- 第二輪 (Round 2) 配置與出擊 ---
            print("\n--- 【第二輪 Round 2】配置與提交開戰 ---", flush=True)
            print("9. [雙方] 補滿第 2 局 5 槽武器...", flush=True)
            page_host.click("#btnRand")
            page_guest.click("#btnRand")
            time.sleep(0.5)

            print("10. [雙方] 提交出擊 (點擊 #btnGo)...", flush=True)
            # 測試先後提交出擊
            page_guest.click("#btnGo")
            time.sleep(0.5)
            page_host.click("#btnGo")

            print("11. [雙方] 驗證是否自動進入第 2 輪戰鬥視圖 (#viewBattle)...", flush=True)
            page_host.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)
            page_guest.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)

            print("   --> 雙方皆自動順利進入第 2 輪戰鬥畫面！", flush=True)

            # 檢驗第 2 局頂部標題與局數
            meta_txt = page_host.eval_on_selector("#battleMeta", "el => el.textContent")
            print(f"   戰鬥頂部資訊: {meta_txt[:60]}...", flush=True)
            assert "第 2/5 局" in meta_txt, f"戰場資訊應顯示第 2/5 局，實際: {meta_txt}"

            print(f"   JS 錯誤檢查: 本部={host_errors}, 突擊={guest_errors}", flush=True)
            assert len(host_errors) == 0 and len(guest_errors) == 0

            browser.close()
            print("\n[SUCCESS] BO5 第二輪雙方就緒後自動開始戰鬥 E2E 驗證圓滿成功！徹底解決卡死問題！", flush=True)

    finally:
        server.terminate()

if __name__ == "__main__":
    run_round2_e2e()
