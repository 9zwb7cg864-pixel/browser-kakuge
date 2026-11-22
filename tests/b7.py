import asyncio
from playwright.async_api import async_playwright
FAKE = """
(() => {
  // 2台目のスロットにつながった、方向がハット(POV)で来るレバーレスを再現
  window._fake = { axes: [0,0,0,0,0,0,0,0,0, 3.2857], buttons: Array.from({length: 16}, () => ({pressed:false, value:0})) };
  const real = navigator.getGamepads.bind(navigator);
  navigator.getGamepads = () => [null, { id: 'Fake Leverless (Vendor: 1234)', index: 1, connected: true, mapping: '', axes: window._fake.axes, buttons: window._fake.buttons }];
})();
"""
async def go():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        ctx = await br.new_context(viewport={'width': 1280, 'height': 720})
        await ctx.add_init_script(FAKE)
        pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8765/?autostart&training'); await pg.wait_for_timeout(2500)
        x0 = await pg.evaluate('KF.Game.battle.p[0].x')
        await pg.evaluate('window._fake.axes[9] = -0.428')   # ハット：右
        await pg.wait_for_timeout(600)
        x1 = await pg.evaluate('KF.Game.battle.p[0].x')
        await pg.evaluate('window._fake.axes[9] = 3.2857')
        await pg.evaluate('window._fake.buttons[5].pressed = true')  # 強P
        await pg.wait_for_timeout(50)
        st = await pg.evaluate('KF.Game.battle.p[0].state + ":" + KF.Game.battle.p[0].moveId')
        await pg.evaluate('window._fake.buttons[5].pressed = false')
        print('ハットの右で前進:', round(x0), '→', round(x1), '／ボタン5で:', st, '／エラー:', errs or 'なし')
        await br.close()
asyncio.run(go())
