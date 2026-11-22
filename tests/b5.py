import asyncio
from playwright.async_api import async_playwright
async def go():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await br.new_context(viewport={'width': 1280, 'height': 720})
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/?autostart&level=EXPERT')
        await pg.wait_for_timeout(3000)
        # 1Pもラウンドを取った状態から、相手をKOして試合終了させる
        await pg.evaluate('(() => { const b = KF.Game.battle; b.wins = [1, 0]; b.p[1].hp = 0; b.koDefender(b.p[0], b.p[1]); })()')
        await pg.wait_for_timeout(3000)
        await pg.screenshot(path='/tmp/ko.png')
        await pg.wait_for_timeout(3500)
        print('試合終了後のシーン:', await pg.evaluate('KF.Game.scene'))
        await pg.screenshot(path='/tmp/result.png')
        await pg.wait_for_timeout(600)
        await pg.keyboard.press('KeyU'); await pg.wait_for_timeout(500)
        print('再戦を選んだ後:', await pg.evaluate('KF.Game.scene + " round=" + KF.Game.battle.round + " wins=" + KF.Game.battle.wins'))
        # CPU性能を1/4に落として（スマホ想定）FPSを測る
        cdp = await ctx.new_cdp_session(pg)
        await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
        await pg.wait_for_timeout(6000)
        print('CPU1/4での FPS:', await pg.evaluate('KF.fps'))
        await cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
        # 長時間：1分間の平均フレーム時間
        t = await pg.evaluate('''() => new Promise(res => { let n = 0, worst = 0, last = performance.now(); const t0 = last;
          function f(now) { const d = now - last; last = now; if (n > 5) worst = Math.max(worst, d); n++; if (now - t0 < 20000) requestAnimationFrame(f); else res({ avg: (now - t0) / n, worst }); } requestAnimationFrame(f); })''')
        print('20秒間の平均フレーム時間 %.2fms / 最悪 %.1fms' % (t['avg'], t['worst']))
        print('エラー:', errs or 'なし')
        await br.close()
asyncio.run(go())
