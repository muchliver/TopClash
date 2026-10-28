"""
Playwright 真實雙瀏覽器 WebRTC P2P 線上對戰【BO5 完整 5 局全流程貫通】E2E 自動化端對端測試
自動連續推演第 1 局、第 2 局、第 3 局、第 4 局、第 5 局，直到一方奪得 3 勝決出 BO5 總冠軍！
"""
import subprocess
import time
import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_full_bo5_e2e():
    print("=== [E2E] 啟動本地測試 HTTP 靜態伺服器 (埠號 8099) ===", flush=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8099", "--directory", "D:\\TopClash"],
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
            page_host.goto("http://localhost:8099/index.html")
            page_host.wait_for_selector("#tabBo3")
            page_host.click("#tabBo3")
            page_host.wait_for_selector("#btnOnlinePvp")
            page_host.click("#btnOnlinePvp")

            print("2. [本部] 等待 WebRTC 房間代碼註冊...", flush=True)
            page_host.wait_for_function("() => { const el = document.querySelector('#pvpRoomCodeDisplay'); return el && el.textContent.length === 6 && !el.textContent.includes('...'); }", timeout=20000)
            room_code = page_host.eval_on_selector("#pvpRoomCodeDisplay", "el => el.textContent.trim()")
            print(f"   --> 房間代碼: [{room_code}]", flush=True)

            print("3. [突擊] 使用邀請連結加入房間...", flush=True)
            page_guest.goto(f"http://localhost:8099/index.html?room={room_code}")
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

            # 連續輪替至多 5 輪 (直到一方獲得 3 勝)
            round_idx = 1
            series_finished = False

            while round_idx <= 5 and not series_finished:
                print(f"\n=======================================================", flush=True)
                print(f"   ⚡ 【BO5 第 {round_idx}/5 局】開始配置武器與出擊", flush=True)
                print(f"=======================================================", flush=True)

                # 雙方配置滿 5 槽武器
                page_host.click("#btnRand")
                page_guest.click("#btnRand")
                time.sleep(0.5)

                # 提交出擊 (btnGo)
                print(f"   [第 {round_idx} 局] 雙方點擊出擊...", flush=True)
                page_guest.click("#btnGo")
                time.sleep(0.3)
                page_host.click("#btnGo")

                print(f"   [第 {round_idx} 局] 等待進入戰鬥畫面 (#viewBattle)...", flush=True)
                page_host.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)
                page_guest.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)

                # 檢驗該輪戰況頂部資訊
                meta_txt = page_host.eval_on_selector("#battleMeta", "el => el.textContent")
                print(f"   --> 成功進入戰鬥！頂部資訊: {meta_txt[:55]}...", flush=True)
                assert f"第 {round_idx}/5 局" in meta_txt, f"局數資訊不符: {meta_txt}"

                # 點擊快速結算跳過
                time.sleep(0.5)
                page_host.eval_on_selector("#btnSkip", "el => el.click()")
                page_guest.eval_on_selector("#btnSkip", "el => el.click()")

                # 檢查是跳出「單局結算 #resultModal」還是「總冠軍結算 #bo3SeriesModal」
                print(f"   [第 {round_idx} 局] 等待結算判定...", flush=True)
                time.sleep(1.0)

                is_series_over = page_host.evaluate("() => !document.querySelector('#bo3SeriesModal').hidden")
                if is_series_over:
                    print(f"\n🎉 觸發 BO5 系列賽總冠軍結算 (#bo3SeriesModal)！", flush=True)
                    series_finished = True
                    break

                # 否則進入常規單局結算
                page_host.wait_for_selector("#resultModal:not([hidden])", timeout=10000)
                page_guest.wait_for_selector("#resultModal:not([hidden])", timeout=10000)

                round_winner = page_host.evaluate("() => window.__db15.state.lastRes.winner")
                bo3_wins_a = page_host.evaluate("() => window.__db15.state.bo3.winsA")
                bo3_wins_b = page_host.evaluate("() => window.__db15.state.bo3.winsB")
                print(f"   第 {round_idx} 局勝負判定: {round_winner} | 目前總比分: 本部 {bo3_wins_a} - 突擊 {bo3_wins_b}", flush=True)

                if round_winner == 'draw':
                    print("   [平局] 雙方直接進入下一局重賽...", flush=True)
                    page_host.click("#rBo3Next")
                    page_guest.click("#rBo3Next")
                else:
                    if round_winner == 'A':
                        p_winner, p_loser = page_host, page_guest
                        w_role, l_role = "本部", "突擊"
                    else:
                        p_winner, p_loser = page_guest, page_host
                        w_role, l_role = "突擊", "本部"

                    print(f"   [戰術反制] {l_role}失利啟動 Ban 選...", flush=True)
                    p_loser.click("#rBo3Next")
                    p_loser.wait_for_selector("#bo3CounterModal:not([hidden])", timeout=10000)
                    p_loser.click(".bo3-ban-card")
                    p_loser.click("#bo3CounterConfirm")
                    p_loser.wait_for_selector("#bo3CounterModal", state="hidden", timeout=10000)

                    p_winner.click("#rBo3Next")
                    p_winner.wait_for_selector("#resultModal", state="hidden", timeout=10000)

                # 等待回到看板
                page_host.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)
                page_guest.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)
                round_idx += 1

            # 驗證總結算畫面
            page_host.wait_for_selector("#bo3SeriesModal:not([hidden])", timeout=10000)
            page_guest.wait_for_selector("#bo3SeriesModal:not([hidden])", timeout=10000)

            title_h = page_host.eval_on_selector("#bo3SeriesCard h2", "el => el.textContent.trim()")
            title_g = page_guest.eval_on_selector("#bo3SeriesCard h2", "el => el.textContent.trim()")
            print(f"\n[本部端冠軍橫幅] {title_h}", flush=True)
            print(f"[突擊端冠軍橫幅] {title_g}", flush=True)

            print(f"\n全流程 JS 執行期錯誤檢查: 本部={host_errors}, 突擊={guest_errors}", flush=True)
            assert len(host_errors) == 0 and len(guest_errors) == 0

            browser.close()
            print("\n=======================================================", flush=True)
            print("🎉 【BO5 全部輪次全生命週期端對端測試】完全通關成功！", flush=True)
            print("=======================================================", flush=True)

    finally:
        server.terminate()

if __name__ == "__main__":
    run_full_bo5_e2e()

