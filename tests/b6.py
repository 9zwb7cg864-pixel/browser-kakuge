import asyncio
from playwright.async_api import async_playwright
async def go():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        pg = await (await br.new_context(viewport={'width': 1280, 'height': 720})).new_page()
        await pg.goto('http://localhost:8765/?autostart&training'); await pg.wait_for_timeout(2500)
        await pg.evaluate('(() => { const b = KF.Game.battle; b.p[0].x = 470; b.p[1].x = 520; })()')
        await pg.evaluate("(() => { window._log = []; const b = KF.Game.battle; const st = b.step.bind(b); b.step = function (i) { st(i); const f = b.p[0]; window._log.push(b.frameNo + ':' + f.state + ':' + f.moveId + ':' + f.buf.cur().dir + (i[0].pressed.hp ? 'H' : '') + ':' + Math.round(b.p[1].x - f.x) + ':' + b.p[1].state); }; })()")
        await pg.wait_for_timeout(100)
        # 人の指のタイミング：弱P→中P→強P→昇穿（約0.1秒間隔で押す）
        seq = [('KeyU', 110), ('KeyI', 110), ('KeyO', 130)]
        for k, w in seq:
            await pg.keyboard.press(k); await pg.wait_for_timeout(w)
        for k in ('KeyD', 'KeyS'):
            await pg.keyboard.down(k); await pg.wait_for_timeout(20); await pg.keyboard.up(k)
        await pg.keyboard.down('KeyS'); await pg.keyboard.down('KeyD'); await pg.wait_for_timeout(20)
        await pg.keyboard.press('KeyO'); await pg.keyboard.up('KeyS'); await pg.keyboard.up('KeyD')
        await pg.wait_for_timeout(450)
        await pg.screenshot(path='/tmp/combo_live.png')
        await pg.wait_for_timeout(600)
        r = await pg.evaluate("KF.Game.battle.events.filter(e => e.type === 'hit' && e.side === 0).map(e => e.move + ':' + e.combo).join(' ')")
        print('実際のキー入力で出たヒット:', r)
        lg = await pg.evaluate('window._log')

        await pg.goto('http://localhost:8765/'); await pg.wait_for_timeout(2000)
        for i in range(3): await pg.keyboard.press('KeyS'); await pg.wait_for_timeout(60)
        await pg.keyboard.press('KeyU'); await pg.wait_for_timeout(200)
        await pg.keyboard.press('KeyS'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='/tmp/combolist.png')
        await br.close()
asyncio.run(go())
