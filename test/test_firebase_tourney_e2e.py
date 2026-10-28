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

PORT = 8773
httpd = HTTPServer(('127.0.0.1', PORT), QuietHandler)
server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
server_thread.start()
print(f"HTTP Server started at http://127.0.0.1:{PORT}", flush=True)

from playwright.sync_api import sync_playwright

def run_tests():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # Test 1: Page Load & Tab Switching
        print("\n=== Test 1: Page Load & Tab Switching ===", flush=True)
        context1 = browser.new_context()
        context1.add_init_script("localStorage.setItem('db15_seen', '1'); localStorage.setItem('topclash_user_uid', 'CMD-1111');")
        page1 = context1.new_page()
        
        errors = []
        page1.on("pageerror", lambda err: errors.append(f"PageError: {err}"))
        page1.on("console", lambda msg: print(f"[Page1 Console] {msg.type}: {msg.text}", flush=True) if msg.type in ['error', 'warn'] else None)
        
        page1.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="networkidle")
        
        # Switch to Tournament view
        page1.wait_for_selector("#tabTournament")
        page1.click("#tabTournament")
        page1.wait_for_selector("#viewTournament", state="visible")
        print("Tournament View opened.", flush=True)
        
        # Ensure lobby card is visible
        page1.wait_for_selector("#tourneyLobbyCard", state="visible")
        
        # Equip valid deck using random pick button
        page1.wait_for_selector("#btnTourneyLobbyRand")
        page1.click("#btnTourneyLobbyRand")
        time.sleep(0.5)
        print("Equipped valid random deck for Player 1.", flush=True)
        
        # Switch to Private
        page1.click('.t-mode-tab[data-tab="private"]')
        page1.wait_for_selector("#panelTourneyPrivate", state="visible")
        print("Switched to Private tab.", flush=True)
        
        # Switch to Public
        page1.click('.t-mode-tab[data-tab="public"]')
        page1.wait_for_selector("#panelTourneyPublic", state="visible")
        print("Switched to Public tab.", flush=True)
        
        # Switch back to Solo
        page1.click('.t-mode-tab[data-tab="solo"]')
        page1.wait_for_selector("#panelTourneySolo", state="visible")
        print("Switched to Solo tab.", flush=True)
        
        # Test 2: Solo Tournament Start
        print("\n=== Test 2: Solo Tournament Start ===", flush=True)
        page1.click("#btnTourneyStart")
        page1.wait_for_selector("#bracketContainer .b-match-card", timeout=10000)
        print("Bracket container rendered matches for Solo Tournament!", flush=True)
        
        match_cards = page1.locator("#bracketContainer .b-match-card")
        print(f"Bracket match cards rendered: {match_cards.count()}", flush=True)
        assert match_cards.count() >= 3, "Bracket should have at least 3 matches"
        
        # Test 3: Private Room Creation & 2-Player Join
        print("\n=== Test 3: Private Room Creation & Joining ===", flush=True)
        # Click reset button in tourneyActionBox to return to lobby
        page1.wait_for_selector("#btnTourneyResetAll")
        page1.click("#btnTourneyResetAll")
        page1.wait_for_selector("#tourneyLobbyCard", state="visible")
        print("Reset tournament and returned to lobby.", flush=True)
        
        # Switch to Private tab
        page1.click('.t-mode-tab[data-tab="private"]')
        page1.wait_for_selector("#panelTourneyPrivate", state="visible")
        
        # Host sets room size 4 for quick test
        page1.click('#privateSizeSelector button[data-size="4"]')
        page1.click("#btnCreatePrivateRoom")
        
        # Wait for room code
        page1.wait_for_selector("#privateRoomCodeDisplay", timeout=10000)
        page1.wait_for_function("() => { const el = document.getElementById('privateRoomCodeDisplay'); return el && el.textContent.trim().length === 6 && !el.textContent.includes('-'); }", timeout=10000)
        room_code = page1.text_content("#privateRoomCodeDisplay").strip()
        print(f"Host created private room with code: [{room_code}]", flush=True)
        assert len(room_code) == 6, f"Room code should be 6 characters, got: {room_code}"
        
        # Player 2 joins
        context2 = browser.new_context()
        context2.add_init_script("localStorage.setItem('db15_seen', '1'); localStorage.setItem('topclash_user_uid', 'CMD-2222');")
        page2 = context2.new_page()
        page2.on("pageerror", lambda err: errors.append(f"Page2 Error: {err}"))
        page2.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="networkidle")
        page2.click("#tabTournament")
        page2.wait_for_selector("#btnTourneyLobbyRand")
        page2.click("#btnTourneyLobbyRand") # Equip deck
        time.sleep(0.5)
        
        page2.click('.t-mode-tab[data-tab="private"]')
        
        # Fill room code and join
        page2.fill("#inputJoinTourneyCode", room_code)
        page2.click("#btnJoinTourneyRoom")
        
        # Check both players see participants
        page1.wait_for_selector("#privateParticipantsGrid .p-slot-chip", timeout=10000)
        page2.wait_for_selector("#privateParticipantsGrid .p-slot-chip", timeout=10000)
        
        # Wait for slot count to reach 2
        page1.wait_for_function("() => { const el = document.getElementById('privateFilledCount'); return el && parseInt(el.textContent.trim()) >= 2; }", timeout=10000)
        page2.wait_for_function("() => { const el = document.getElementById('privateFilledCount'); return el && parseInt(el.textContent.trim()) >= 2; }", timeout=10000)
        
        p1_count = int(page1.text_content("#privateFilledCount").strip())
        p2_count = int(page2.text_content("#privateFilledCount").strip())
        print(f"Filled slots seen by P1: {p1_count}, P2: {p2_count}", flush=True)
        assert p1_count >= 2, "Host should see at least 2 players"
        assert p2_count >= 2, "Player 2 should see at least 2 players"
        
        # Host fills rest with AI
        print("Host clicking 'AI 補齊剩餘名額'...", flush=True)
        page1.click("#btnPrivateFillAI")
        time.sleep(3)
        
        # Both players should enter bracket view
        page1.wait_for_selector("#bracketContainer .b-match-card", timeout=10000)
        page2.wait_for_selector("#bracketContainer .b-match-card", timeout=10000)
        print("Both Host and Player 2 successfully entered Bracket View in multiplayer tournament!", flush=True)
        
        # Test 4: Quick Match Test
        print("\n=== Test 4: Quick Match Test ===", flush=True)
        context3 = browser.new_context()
        context3.add_init_script("localStorage.setItem('db15_seen', '1'); localStorage.setItem('topclash_user_uid', 'CMD-3333');")
        page3 = context3.new_page()
        page3.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="networkidle")
        page3.click("#tabTournament")
        page3.wait_for_selector("#btnTourneyLobbyRand")
        page3.click("#btnTourneyLobbyRand")
        page3.click('.t-mode-tab[data-tab="public"]')
        page3.click("#btnQuickMatchTourney")
        
        # Verify page3 entered waiting or active room
        page3.wait_for_selector("#tourneyBadge", state="visible", timeout=10000)
        print("Player 3 successfully initiated/joined a public Quick Match room!", flush=True)
        
        if errors:
            print(f"Encountered {len(errors)} page errors: {errors}", flush=True)
            assert len(errors) == 0, f"Errors occurred: {errors}"
            
        print("\n=== ALL FIREBASE TOURNAMENT TESTS PASSED! ===", flush=True)
        browser.close()

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"TEST FAILED: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        httpd.shutdown()
