import json,shutil,os
from PIL import Image
U='/mnt/user-data/uploads/Downloads/pixellab/'
D='design/pixellab/ren'; M=json.load(open(D+'/moves.json'))
A=json.load(open('game/assets/kokuu/anims.json'))['anims']
def P(s,i):
    dst=f'img/{s}_{i:02d}.png'
    if not os.path.exists(D+'/'+dst): shutil.copy(U+f'{s}/img_{i}.png',D+'/'+dst)
    return dst
def Mi(s,i):
    dst=f'img/{s}_m{i:02d}.png'
    if not os.path.exists(D+'/'+dst): Image.open(U+f'{s}/img_{i}.png').transpose(Image.FLIP_LEFT_RIGHT).save(D+'/'+dst)
    return dst
def rs(l,n):
    if n<=0: return []
    if n==1: return [l[-1]]
    return [l[round(k*(len(l)-1)/(n-1))] for k in range(n)]
def info(name):
    t=[f for f in A[name]['frames'] for _ in range(f['d'])]; ph=''.join(f['ph'] for f in t); return len(t),ph.index('a'),ph
def build(name,gen,ka):
    tot,fa,ph=info(name)
    seq=rs(gen[:ka+1],fa+1)+rs(gen[ka:],tot-fa)[1:]
    assert len(seq)==tot,(name,len(seq),tot); M[name]={'frames':seq}
def G(s,n): return [P(s,i) for i in range(n+1)]
fire=G('m6_sp_fire',24); build('sp_fire',fire,9); build('ex_fire',fire,9)
dp=G('m5_sp_dp',24)
for nm in ('sp_dp','ex_dp'):
    tot,fa,_=info(nm); seq=[dp[3],dp[6]][:fa]+rs(dp[7:],tot-fa); M[nm]={'frames':seq}
palm=G('m5_sp_palm',20); build('sp_palm',palm,9); build('ex_palm',palm,9)
build('sp_slide',G('m5_sp_slide',24),8)
build('ex_rush',G('m5_ex_rush',28),6)
build('su_1',G('m5_su_1',40),10)
build('su_2',G('m5_su_2',40),3)
build('su_3',G('m5_su_3',40),10)
fm=G('m5_f_mp',20); build('f_mp',fm[:11]+fm[16:],9)
build('f_hp',G('m5_f_hp',20),6)
build('b_hk',G('m5_b_hk',20),7)
build('throw',G('m5_throw',16),5)
cyc=[P('m6_spin',i) for i in range(8)]+[Mi('m6_spin',i) for i in range(8)]
tot,fa,ph=info('sp_tatsu'); act=ph.count('a'); ta=G('m5_sp_tatsu',32)
M['sp_tatsu']={'frames':rs(ta[:11],fa)+[cyc[k%16] for k in range(act)]+rs(ta[22:],tot-fa-act)}
tot,fa,ph=info('sp_atatsu'); act=ph.count('a'); jt=P('m2_jump_up',12)
seq=[jt]*fa+[cyc[k%16] for k in range(act)]
seq+=[cyc[(act+k)%16] for k in range(3)]; seq+=[jt]*(tot-len(seq))
M['sp_atatsu']={'frames':seq}
for k in ('sp_tatsu','sp_atatsu','sp_dp'): assert len(M[k]['frames'])==info(k)[0],k
json.dump(M,open(D+'/moves.json','w'),ensure_ascii=False,indent=1)
print('ok')
