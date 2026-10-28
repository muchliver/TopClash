"""
Playwright 真實雙瀏覽器 WebRTC P2P 線上對戰【BO5 打滿多局系列賽】E2E 自動化測試
驗證第 1, 2, 3, 4, 5 局每一輪及其過渡反制、進入戰場之全流程！
"""
import subprocess
import time
import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def run_5_rounds_full_e2e():
    print("=== [E2E] 啟動本地測試 HTTP 靜態伺服器 (埠號 8089) ===", flush=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8089", "--directory", "D:\\TopClash"],
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
            page_host.goto("http://localhost:8089/index.html")
            page_host.wait_for_selector("#tabBo3")
            page_host.click("#tabBo3")
            page_host.wait_for_selector("#btnOnlinePvp")
            page_host.click("#btnOnlinePvp")

            print("2. [本部] 等待 WebRTC 房間代碼註冊...", flush=True)
            page_host.wait_for_function("() => { const el = document.querySelector('#pvpRoomCodeDisplay'); return el && el.textContent.length === 6 && !el.textContent.includes('...'); }", timeout=20000)
            room_code = page_host.eval_on_selector("#pvpRoomCodeDisplay", "el => el.textContent.trim()")
            print(f"   --> 房間代碼: [{room_code}]", flush=True)

            print("3. [突擊] 使用邀請連結加入房間...", flush=True)
            page_guest.goto(f"http://localhost:8089/index.html?room={room_code}")
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

            # 連續打滿 BO5 局數直至總冠軍出爐
            for r in range(1, 6):
                print(f"\n=======================================================", flush=True)
                print(f"   ⚡ 【BO5 第 {r}/5 局】陣容配置與出擊", flush=True)
                print(f"=======================================================", flush=True)

                page_host.click("#btnRand")
                page_guest.click("#btnRand")
                time.sleep(0.5)

                # 提交出擊
                print(f"   [第 {r} 局] 雙方點擊出擊...", flush=True)
                page_guest.click("#btnGo")
                time.sleep(0.3)
                page_host.click("#btnGo")

                print(f"   [第 {r} 局] 等待進入戰鬥畫面 (#viewBattle)...", flush=True)
                page_host.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)
                page_guest.wait_for_selector("#viewBattle:not([hidden])", timeout=15000)

                meta_txt = page_host.eval_on_selector("#battleMeta", "el => el.textContent")
                print(f"   --> 成功進入戰鬥！戰況頂部資訊: {meta_txt[:55]}...", flush=True)
                assert f"第 {r}/5 局" in meta_txt, f"局數不符: {meta_txt}"

                # 點擊跳過
                time.sleep(0.5)
                page_host.eval_on_selector("#btnSkip", "el => el.click()")
                page_guest.eval_on_selector("#btnSkip", "el => el.click()")

                time.sleep(1.0)

                # 檢查是否總決賽結束 (滿 3 勝)
                is_over = page_host.evaluate("() => !document.querySelector('#bo3SeriesModal').hidden")
                if is_over:
                    print(f"\n🎉 第 {r} 局結束後，一方已達 3 勝，總冠軍揭曉 (#bo3SeriesModal)！", flush=True)
                    break

                # 處理單局結算與反制
                page_host.wait_for_selector("#resultModal:not([hidden])", timeout=10000)
                page_guest.wait_for_selector("#resultModal:not([hidden])", timeout=10000)

                winner = page_host.evaluate("() => window.__db15.state.lastRes.winner")
                w_a = page_host.evaluate("() => window.__db15.state.bo3.winsA")
                w_b = page_host.evaluate("() => window.__db15.state.bo3.winsB")
                print(f"   [第 {r} 局勝負] 獲勝方: {winner} | 比分: 本部 {w_a} - 突擊 {w_b}", flush=True)

                if winner == 'draw':
                    print("   [平局] 雙方點擊進入下一局重賽...", flush=True)
                    page_host.click("#rBo3Next")
                    page_guest.click("#rBo3Next")
                else:
                    p_win = page_host if winner == 'A' else page_guest
                    p_lose = page_guest if winner == 'A' else page_host
                    lose_tag = "突擊" if winner == 'A' else "本部"

                    print(f"   [{lose_tag}] 啟動戰術反制，禁用對手武器...", flush=True)
                    p_lose.click("#rBo3Next")
                    p_lose.wait_for_selector("#bo3CounterModal:not([hidden])", timeout=10000)
                    p_lose.click(".bo3-ban-card")
                    p_lose.click("#bo3CounterConfirm")
                    p_lose.wait_for_selector("#bo3CounterModal", state="hidden", timeout=10000)

                    p_win.click("#rBo3Next")
                    p_win.wait_for_selector("#resultModal", state="hidden", timeout=10000)

                # 等待回到看板進入下一局
                page_host.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)
                page_guest.wait_for_selector("#viewBuild:not([hidden])", timeout=10000)

            # 驗證總冠軍畫面
            page_host.wait_for_selector("#bo3SeriesModal:not([hidden])", timeout=10000)
            page_guest.wait_for_selector("#bo3SeriesModal:not([hidden])", timeout=10000)

            title_h = page_host.eval_on_selector("#bo3SeriesCard h2", "el => el.textContent.trim()")
            title_g = page_guest.eval_on_selector("#bo3SeriesCard h2", "el => el.textContent.trim()")
            print(f"\n[本部端橫幅] {title_h}", flush=True)
            print(f"[突擊端橫幅] {title_g}", flush=True)

            print(f"\nJS 錯誤檢查: 本部={host_errors}, 突擊={guest_errors}", flush=True)
            assert len(host_errors) == 0 and len(guest_errors) == 0

            browser.close()
            print("\n=======================================================", flush=True)
            print("🎉 【BO5 系列賽多輪全流程】完全通過，各輪次流暢無阻！", flush=True)
            print("=======================================================", flush=True)

    finally:
        server.terminate()

if __name__ == "__main__":
    run_5_rounds_full_e2e()
