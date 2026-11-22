import asyncio
from browser import main
asyncio.run(main('?autostart&level=NORMAL&fps', shots=[2500, 1500, 600, 300], keys=[None, ['down:KeyD','wait:900','up:KeyD'], ['KeyO'], ['KeyS','KeyD','KeyU']], wait=1500))
