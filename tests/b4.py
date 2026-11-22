import asyncio
from playwright.async_api import async_playwright
async def go():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for name, vp in (('land', {'width': 844, 'height': 390}), ('port', {'width': 390, 'height': 844})):
            ctx = await br.new_context(viewport=vp, is_mobile=True, has_touch=True, device_scale_factor=2)
            pg = await ctx.new_page()
            await pg.goto('http://localhost:8765/?autostart&training')
            await pg.wait_for_timeout(4500)
            # タッチ操作：右へ移動→強P
            box = await pg.evaluate("(() => { const r = document.querySelector('.dpad').getBoundingClientRect(); const b = document.querySelector('[data-b=hp]').getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2, r.width, b.left + b.width/2, b.top + b.height/2]; })()")
            cdp = await ctx.new_cdp_session(pg)
            async def touch(t, pts):
                await cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': pts})
            await touch('touchStart', [{'x': box[0] + box[2] * 0.4, 'y': box[1], 'id': 1}])
            await pg.wait_for_timeout(700)
            x0 = await pg.evaluate('KF.Game.battle.p[0].x')
            await touch('touchStart', [{'x': box[0] + box[2] * 0.4, 'y': box[1], 'id': 1}, {'x': box[3], 'y': box[4], 'id': 2}])
            await pg.wait_for_timeout(60)
            st = await pg.evaluate('KF.Game.battle.p[0].state + ":" + KF.Game.battle.p[0].moveId')
            await touch('touchEnd', [])
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=f'/tmp/{name}.png')
            print(name, 'タッチで前進したx:', round(x0), '強P後の状態:', st)
            await ctx.close()
        await br.close()
asyncio.run(go())
