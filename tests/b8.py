import asyncio
from playwright.async_api import async_playwright
FAKE = """(() => { window._fake = { axes: [0,0,0,0], buttons: Array.from({length: 17}, () => ({pressed:false, value:0})) };
  navigator.getGamepads = () => [{ id: 'PDP Xbox One Controller (STANDARD GAMEPAD Vendor: 0e6f Product: 02a8)', index: 0, connected: true, mapping: 'standard', axes: window._fake.axes, buttons: window._fake.buttons }]; })();"""
async def press(pg, i, ms=80):
    await pg.evaluate(f'window._fake.buttons[{i}].pressed = true'); await pg.wait_for_timeout(ms); await pg.evaluate(f'window._fake.buttons[{i}].pressed = false'); await pg.wait_for_timeout(120)
async def go():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await br.new_context(viewport={'width': 1280, 'height': 720}); await ctx.add_init_script(FAKE)
        pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/'); await pg.wait_for_timeout(2500)
        await pg.evaluate('window._fake.buttons[0].pressed = true'); await pg.wait_for_timeout(30)
        await pg.screenshot(path='/tmp/padtitle.png'); await pg.evaluate('window._fake.buttons[0].pressed = false'); await pg.wait_for_timeout(200)
        print('A（決定）でタイトル→', await pg.evaluate('KF.Game.scene'))
        await press(pg, 0); print('A でキャラ決定→', await pg.evaluate('KF.Game.scene'))
        await press(pg, 0); print('A でCPUキャラ決定→', await pg.evaluate('KF.Game.scene'))
        await press(pg, 13); await press(pg, 0); print('↓→A で難易度決定→', await pg.evaluate('KF.Game.scene + " " + KF.Game.cfg.level'))
        await pg.wait_for_timeout(3500)
        # 十字キーの↓↘→＋X（弱P）で虚環弾
        for seq in ([13], [13, 15], [15]):
            for b in seq: await pg.evaluate(f'window._fake.buttons[{b}].pressed = true')
            await pg.wait_for_timeout(34)
            for b in seq: await pg.evaluate(f'window._fake.buttons[{b}].pressed = false')
        await pg.evaluate('window._fake.buttons[15].pressed = true; window._fake.buttons[2].pressed = true'); await pg.wait_for_timeout(60)
        await pg.evaluate('window._fake.buttons[15].pressed = false; window._fake.buttons[2].pressed = false'); await pg.wait_for_timeout(100)
        print('状態:', await pg.evaluate('KF.Game.battle.phase + " p0=" + KF.Game.battle.p[0].state + " 履歴=" + KF.Game.battle.p[0].buf.hist.slice(-14).map(h => h.dir + (h.p.lp ? "P" : "")).join("")'))
        print('十字キー↓↘→＋Xで出た技:', await pg.evaluate('KF.Game.battle.p[0].moveId'), '／エラー', errs or 'なし')
        await br.close()
asyncio.run(go())
