import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'D:\TopClash\js\app.js', 'r', encoding='utf-8') as f:
    app_js = f.read()

# 1. Verify openBattle does not exist
assert 'openBattle(' not in app_js, 'openBattle is still present!'
print('[OK] 1. openBattle is completely removed and does not exist.')

# 2. Verify showBattle is called in startOnlinePvpBattle
assert 'showBattle(res);' in app_js, 'showBattle(res) is missing!'
print('[OK] 2. startOnlinePvpBattle properly invokes showBattle(res).')

# 3. Verify COMBAT_SYNC has deck/doctrine backup
assert "OnlinePvPEngine.sendPacket('COMBAT_SYNC', {" in app_js, 'COMBAT_SYNC sendPacket not found'
assert "deck: state.deck.slice()," in app_js, 'deck backup in COMBAT_SYNC missing'
print('[OK] 3. COMBAT_SYNC payload includes backup deck and doctrine.')

# 4. Verify COMBAT_SYNC listener restores backup deck
assert "OnlinePvPEngine.on('combat_start_sync'" in app_js, 'combat_start_sync listener missing'
assert "state.pvpOpponentDeck = payload.deck;" in app_js, 'backup deck restore missing'
print('[OK] 4. combat_start_sync listener restores backup deck if missing.')

# 5. Verify setupMatch safe handling
assert "state.enemy = state.pvpOpponentDeck ? state.pvpOpponentDeck.slice() : null;" in app_js, 'setupMatch safe handling missing'
print('[OK] 5. setupMatch handles online PvP state safely without null slice error.')

# 6. Verify index.html version 3.8.9
with open(r'D:\TopClash\index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

assert 'v=3.8.9' in index_html, 'index.html version not bumped to 3.8.9'
print('[OK] 6. index.html bumped to v=3.8.9 to bust CDN and browser cache.')

print('\n🎉 ALL 6 VERIFICATIONS PASSED!')
