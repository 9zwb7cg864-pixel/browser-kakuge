import asyncio
from browser import main
asyncio.run(main('?autostart&level=HARD&fps', shots=[3000, 2500, 4000], wait=1500, out='/tmp/pc'))
asyncio.run(main('?autostart&level=NORMAL', shots=[3500], wait=1500, mobile=True, out='/tmp/mob'))
