from PIL import Image
from chars import render
base = dict(px=0, py=-77, lean=4, tw=0.6, hd=-3,
            al=('ik', 26, -96), ar=('ik', -12, -84),
            ll=('ik', 18, -6), lr=('ik', -20, -6), fl=95, fr=85, hl='fist', hr='fist')
punch = dict(base, lean=14, px=6, py=-74, al=('ik', 26, -104), ar=('ik', 84, -118), tw=0.4, ll=('ik',30,-6), lr=('ik',-22,-6), _vx=2)
kick = dict(base, lean=-16, py=-80, px=-6, hd=10, ll=('fk', 95, 5), lr=('ik',-14,-6), al=('ik',10,-112), ar=('ik',-18,-104))
imgs=[]
for k in ('kokuu','shuuen'):
    for p in (base,punch,kick):
        im,J,cv = render(k,p); imgs.append(Image.fromarray(im))
W=224*3; sheet=Image.new('RGBA',(W,400),(4,6,12,255))
for i,im in enumerate(imgs): sheet.alpha_composite(im,((i%3)*224,(i//3)*200))
sheet.resize((W*3,1200),Image.NEAREST).save('/tmp/test.png')
