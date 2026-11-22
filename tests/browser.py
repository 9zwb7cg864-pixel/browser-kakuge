import asyncio, sys, json
from playwright.async_api import async_playwright
URL = 'http://localhost:8765/'
async def main(q='', shots=(), wait=3000, mobile=False, keys=None, out='/tmp/shot'):
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--autoplay-policy=no-user-gesture-required'])
        if mobile:
            ctx = await br.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True, device_scale_factor=2)
        else:
            ctx = await br.new_context(viewport={'width': 1280, 'height': 720})
        pg = await ctx.new_page()
        errs = []
        pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
        await pg.goto(URL + q)
        await pg.wait_for_timeout(wait)
        for i, t in enumerate(shots):
            if keys and i < len(keys) and keys[i]:
                for k in keys[i]:
                    if k.startswith('wait:'): await pg.wait_for_timeout(int(k[5:]))
                    elif k.startswith('down:'): await pg.keyboard.down(k[5:])
                    elif k.startswith('up:'): await pg.keyboard.up(k[3:])
                    else: await pg.keyboard.press(k)
            await pg.wait_for_timeout(t)
            await pg.screenshot(path=f'{out}{i}.png')
        info = await pg.evaluate('() => ({fps: KF.fps, scene: KF.Game.scene})')
        print('INFO', info)
        print('\n'.join(errs[:20]) or 'エラーなし')
        await br.close()
if __name__ == '__main__':
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else '', shots=[500]))
