import json, sys, os
from PIL import Image, ImageDraw
kind=sys.argv[1]; names=sys.argv[2].split(',') ; out=sys.argv[3]
root=f'../game/assets/{kind}'
M=json.load(open(f'{root}/anims.json'))['anims']
FW,FH=224,200; maxn=max(len(M[n]['frames']) for n in names)
cols=min(maxn,12)
sh=Image.new('RGBA',(cols*112, len(names)*100),(6,8,14,255))
d=ImageDraw.Draw(sh)
for r,n in enumerate(names):
    st=Image.open(f"{root}/{M[n]['file']}")
    fr=M[n]['frames']; k=len(fr)
    pick=[round(i*(k-1)/max(1,cols-1)) for i in range(cols)] if k>cols else list(range(k))
    for c,i in enumerate(pick):
        im=st.crop((i*FW,0,(i+1)*FW,FH)).resize((112,100),Image.NEAREST)
        sh.alpha_composite(im,(c*112,r*100))
        col={'s':(80,80,255),'a':(255,60,60),'r':(80,200,80)}.get(fr[i]['ph'])
        if col: d.rectangle((c*112+2,r*100+92,c*112+20,r*100+96),fill=col)
    d.text((2,r*100+2),n,fill=(255,255,0))
sh.save(out)
