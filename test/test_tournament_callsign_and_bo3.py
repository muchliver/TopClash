import sys
import time
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

os.chdir("D:/TopClash")

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

PORT = 8789
try:
    httpd = HTTPServer(('127.0.0.1', PORT), QuietHandler)
except OSError:
    httpd = HTTPServer(('127.0.0.1', 0), QuietHandler)
    PORT = httpd.server_address[1]

server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()
print(f"HTTP Server started at http://127.0.0.1:{PORT}", flush=True)

from playwright.sync_api import sync_playwright

def run_e2e():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Context 1 (Host Player)
        c1 = browser.new_context()
        c1.add_init_script("localStorage.setItem('db15_seen', '1'); localStorage.setItem('topclash_user_uid', 'CMD-HOST-7788');")
        p1 = c1.new_page()
        p1_errors = []
        p1.on("pageerror", lambda err: p1_errors.append(f"P1 Error: {err}"))
        p1.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="networkidle")

        # Open Tournament Mode
        p1.wait_for_selector("#tabTournament")
        p1.click("#tabTournament")
        p1.wait_for_selector("#viewTournament", state="visible")

        # Onboarding Commander Modal pops up automatically!
        p1.wait_for_selector("#commanderModal", state="visible", timeout=5000)
        p1_name_input = p1.eval_on_selector("#commanderNameInput", "el => el.value")
        print(f"Player 1 Onboarding Modal pre-filled callsign: [{p1_name_input}]", flush=True)
        assert p1_name_input != '我方特遣隊' and p1_name_input != '我方聯合戰術作戰群', f"Expected procedural pre-fill, got: {p1_name_input}"
        
        # Player 1 confirms callsign
        p1.click("#commanderSave")
        p1.wait_for_selector("#commanderModal", state="hidden")
        print("Player 1 confirmed callsign registration!", flush=True)

        # Context 2 (Guest Player)
        c2 = browser.new_context()
        c2.add_init_script("localStorage.setItem('db15_seen', '1'); localStorage.setItem('topclash_user_uid', 'CMD-GUEST-9900');")
        p2 = c2.new_page()
        p2_errors = []
        p2.on("pageerror", lambda err: p2_errors.append(f"P2 Error: {err}"))
        p2.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="networkidle")

        p2.wait_for_selector("#tabTournament")
        p2.click("#tabTournament")
        p2.wait_for_selector("#viewTournament", state="visible")

        # Player 2 Onboarding Modal pops up automatically!
        p2.wait_for_selector("#commanderModal", state="visible", timeout=5000)
        p2_name_input = p2.eval_on_selector("#commanderNameInput", "el => el.value")
        print(f"Player 2 Onboarding Modal pre-filled callsign: [{p2_name_input}]", flush=True)
        assert p2_name_input != '我方特遣隊' and p2_name_input != '我方聯合戰術作戰群', f"Expected procedural pre-fill, got: {p2_name_input}"
        assert p1_name_input != p2_name_input, f"Names must not collide! P1={p1_name_input}, P2={p2_name_input}"

        p2.click("#commanderSave")
        p2.wait_for_selector("#commanderModal", state="hidden")
        print("Player 2 confirmed callsign registration!", flush=True)

        # Equip decks
        p1.click("#btnTourneyLobbyRand")
        p2.click("#btnTourneyLobbyRand")
        time.sleep(0.5)

        # Host creates private room
        p1.click('.t-mode-tab[data-tab="private"]')
        p1.click('#privateSizeSelector button[data-size="4"]')
        p1.click("#btnCreatePrivateRoom")

        p1.wait_for_selector("#privateRoomCodeDisplay", timeout=10000)
        p1.wait_for_function("() => { const el = document.getElementById('privateRoomCodeDisplay'); return el && el.textContent.trim().length === 6 && !el.textContent.includes('-'); }")
        room_code = p1.text_content("#privateRoomCodeDisplay").strip()
        print(f"Room created: [{room_code}]", flush=True)

        # Player 2 joins
        p2.click('.t-mode-tab[data-tab="private"]')
        p2.fill("#inputJoinTourneyCode", room_code)
        p2.click("#btnJoinTourneyRoom")

        # Wait for both to be in room
        p1.wait_for_function("() => { const el = document.getElementById('privateFilledCount'); return el && parseInt(el.textContent.trim()) >= 2; }")
        p2.wait_for_function("() => { const el = document.getElementById('privateFilledCount'); return el && parseInt(el.textContent.trim()) >= 2; }")
        print("Both players in room! Host clicking AI fill...", flush=True)

        p1.click("#btnPrivateFillAI")
        time.sleep(2)

        # Both enter bracket view
        p1.wait_for_selector("#bracketContainer .b-match-card", timeout=10000)
        p2.wait_for_selector("#bracketContainer .b-match-card", timeout=10000)
        print("Both players in bracket view!", flush=True)

        # Inspect R1-M1 teams in bracket
        team_names = p1.locator("[data-match-id='R1-M1'] .b-team-name").all_text_contents()
        team_a_name = team_names[0].strip()
        team_b_name = team_names[1].strip()
        print(f"R1-M1 matchup: [{team_a_name}] vs [{team_b_name}]", flush=True)
        assert team_a_name != team_b_name, f"Both teams in R1-M1 must be distinct! A={team_a_name}, B={team_b_name}"

        # Check badges on bracket
        my_badge_p1 = p1.is_visible("[data-match-id='R1-M1'] .badge:has-text('我方')")
        opp_badge_p1 = p1.is_visible("[data-match-id='R1-M1'] .badge:has-text('對手')")
        print(f"P1 view badges: 我方 badge={my_badge_p1}, 對手 badge={opp_badge_p1}", flush=True)
        assert my_badge_p1, "Player 1 should see '我方' badge"
        assert opp_badge_p1, "Player 1 should see '對手' badge"

        # P1 clicks Go Fight
        print("P1 clicks Go Fight...", flush=True)
        p1.click("#btnTourneyGoFight")
        time.sleep(1)
        btn1_txt = p1.text_content("#btnTourneyGoFight")
        print(f"P1 button after submitting: {btn1_txt.strip()}", flush=True)
        assert "等待對手出擊" in btn1_txt or "等對手出擊" in btn1_txt, f"Button should show waiting for opponent, got: {btn1_txt}"

        # P2 clicks Go Fight
        print("P2 clicks Go Fight...", flush=True)
        p2.click("#btnTourneyGoFight")

        # Both players should automatically enter battle view (#viewBattle)!
        p1.wait_for_selector("#viewBattle:not([hidden])", timeout=10000)
        p2.wait_for_selector("#viewBattle:not([hidden])", timeout=10000)
        print("SUCCESS: Both players automatically entered battle view (#viewBattle)!", flush=True)

        # Click skip in battle
        p1.eval_on_selector("#btnSkip", "el => el.click()")
        p2.eval_on_selector("#btnSkip", "el => el.click()")

        # Wait for result modal
        p1.wait_for_selector("#resultModal:not([hidden])", timeout=10000)
        p2.wait_for_selector("#resultModal:not([hidden])", timeout=10000)
        print("Battle finished, result modal displayed for both players!", flush=True)

        # Return to bracket
        p1.eval_on_selector("#btnBattleBack", "el => el.click()")
        p2.eval_on_selector("#btnBattleBack", "el => el.click()")

        p1.wait_for_selector("#viewTournament:not([hidden])", timeout=10000)
        p2.wait_for_selector("#viewTournament:not([hidden])", timeout=10000)
        print("Both players returned to bracket view!", flush=True)

        # Check R1-M1 has finished (1-0)
        r1_status = p1.eval_on_selector("[data-match-id='R1-M1']", "el => el.querySelector('.b-status-badge').textContent")
        print(f"R1-M1 status badge: [{r1_status.strip()}]", flush=True)
        assert "戰報" in r1_status, f"R1-M1 should be finished with 戰報 badge, got: {r1_status}"

        # Check Bronze match has teams populated from semi-final losers!
        bronze_names = p1.locator("[data-match-id='BRONZE-FINAL'] .b-team-name").all_text_contents()
        bronze_team_a = bronze_names[0].strip()
        print(f"Bronze match Team A from semi-final loser: [{bronze_team_a}]", flush=True)
        assert bronze_team_a != "待定對手" and bronze_team_a != "?", f"Bronze match should have semi-final loser, got: {bronze_team_a}"

        # --- ROUND 2 (Finals / Bronze Match) TEST ---
        time.sleep(2)
        round_info_p1 = p1.text_content("#tourneyRoundPill").strip()
        print(f"P1 Round Info: [{round_info_p1}]", flush=True)

        btn1_r2 = p1.text_content("#btnTourneyGoFight").strip() if p1.is_visible("#btnTourneyGoFight") else "NO BTN"
        btn2_r2 = p2.text_content("#btnTourneyGoFight").strip() if p2.is_visible("#btnTourneyGoFight") else "NO BTN"
        print(f"Round 2 Buttons: P1=[{btn1_r2}], P2=[{btn2_r2}]", flush=True)

        # Check room data in Round 2
        r_data = p1.evaluate("() => FirebaseTourneyEngine.getCurrentRoom()")
        print(f"Room status: {r_data['status']}, curRound: {r_data['currentRound']}", flush=True)
        for mid, m in r_data['matches'].items():
            teamA_name = m['teamA']['name'] if m.get('teamA') else 'None'
            teamB_name = m['teamB']['name'] if m.get('teamB') else 'None'
            readyA = m.get('readyA', False)
            readyB = m.get('readyB', False)
            hist_len = len(m.get('history') or [])
            print(f"Match {mid}: status={m['status']}, readyA={readyA}, readyB={readyB}, score={m.get('scoreA', 0)}:{m.get('scoreB', 0)}, history={hist_len}, A={teamA_name}, B={teamB_name}", flush=True)

        # Whoever has the button clicks it!
        if p1.is_visible("#btnTourneyGoFight"):
            print(f"P1 clicking Go Fight in Round 2: [{btn1_r2}]...", flush=True)
            p1.click("#btnTourneyGoFight")
        if p2.is_visible("#btnTourneyGoFight"):
            print(f"P2 clicking Go Fight in Round 2: [{btn2_r2}]...", flush=True)
            p2.click("#btnTourneyGoFight")

        time.sleep(3)
        btn1_after = p1.text_content("#btnTourneyGoFight").strip() if p1.is_visible("#btnTourneyGoFight") else "NO BTN"
        btn2_after = p2.text_content("#btnTourneyGoFight").strip() if p2.is_visible("#btnTourneyGoFight") else "NO BTN"
        print(f"Round 2 After Click: P1=[{btn1_after}], P2=[{btn2_after}]", flush=True)
        print(f"P1 in battle: {p1.is_visible('#viewBattle:not([hidden])')}, P2 in battle: {p2.is_visible('#viewBattle:not([hidden])')}", flush=True)

        r_data2 = p1.evaluate("() => FirebaseTourneyEngine.getCurrentRoom()")
        for mid, m in r_data2['matches'].items():
            readyA = m.get('readyA', False)
            readyB = m.get('readyB', False)
            hist_len = len(m.get('history') or [])
            print(f"Match {mid} after R2 Game 1: status={m['status']}, readyA={readyA}, readyB={readyB}, score={m.get('scoreA', 0)}:{m.get('scoreB', 0)}, history={hist_len}", flush=True)

        # --- NOW RETURN FROM R2 GAME 1 BATTLE AND TEST GAME 2 (第二局) ---
        print("\n=== TESTING BO3 GAME 2 (第二局) ===", flush=True)
        p1.eval_on_selector("#btnSkip", "el => el.click()")
        p2.eval_on_selector("#btnSkip", "el => el.click()")
        time.sleep(1)

        p1.eval_on_selector("#btnBattleBack", "el => el.click()")
        p2.eval_on_selector("#btnBattleBack", "el => el.click()")

        p1.wait_for_selector("#viewTournament:not([hidden])", timeout=10000)
        p2.wait_for_selector("#viewTournament:not([hidden])", timeout=10000)
        print("Both players returned to bracket after R2 Game 1!", flush=True)

        time.sleep(2)
        btn1_g2 = p1.text_content("#btnTourneyGoFight").strip() if p1.is_visible("#btnTourneyGoFight") else "NO BTN"
        btn2_g2 = p2.text_content("#btnTourneyGoFight").strip() if p2.is_visible("#btnTourneyGoFight") else "NO BTN"
        print(f"Buttons for Game 2: P1=[{btn1_g2}], P2=[{btn2_g2}]", flush=True)

        # Now click Go Fight for Game 2 (第二局)!
        print("Clicking Go Fight for Game 2...", flush=True)
        if p1.is_visible("#btnTourneyGoFight"):
            p1.click("#btnTourneyGoFight")
        if p2.is_visible("#btnTourneyGoFight"):
            p2.click("#btnTourneyGoFight")

        time.sleep(3)
        btn1_g2_after = p1.text_content("#btnTourneyGoFight").strip() if p1.is_visible("#btnTourneyGoFight") else "NO BTN"
        btn2_g2_after = p2.text_content("#btnTourneyGoFight").strip() if p2.is_visible("#btnTourneyGoFight") else "NO BTN"
        print(f"After Game 2 click: P1=[{btn1_g2_after}], P2=[{btn2_g2_after}]", flush=True)
        print(f"P1 in battle Game 2: {p1.is_visible('#viewBattle:not([hidden])')}, P2 in battle Game 2: {p2.is_visible('#viewBattle:not([hidden])')}", flush=True)

        if p1_errors or p2_errors:
            print(f"Errors encountered: P1={p1_errors}, P2={p2_errors}")
            assert False, f"Page errors: {p1_errors + p2_errors}"

        print("\n=== ALL CALLSIGN & TOURNAMENT BO3 COMBAT TESTS PASSED! ===", flush=True)
        browser.close()

if __name__ == "__main__":
    try:
        run_e2e()
    except Exception as e:
        print(f"TEST FAILED: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        httpd.shutdown()
