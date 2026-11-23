# 残りのアニメ（ダッシュ・ガード・しゃがみ/ジャンプ攻撃・やられ・ダウン・勝利など）を moves.json に入れる
import json,shutil,os
U='/mnt/user-data/uploads/Downloads/pixellab/'
D='design/pixellab/ren'; M=json.load(open(D+'/moves.json'))
A=json.load(open('game/assets/kokuu/anims.json'))['anims']
def P(s,i):
    dst=f'img/{s}_{i:02d}.png'
    if not os.path.exists(D+'/'+dst): shutil.copy(U+f'{s}/img_{i}.png',D+'/'+dst)
    return dst
def rs(l,n):
    if n<=0: return []
    if n==1: return [l[-1]]
    return [l[round(k*(len(l)-1)/(n-1))] for k in range(n)]
def info(name):
    t=[f for f in A[name]['frames'] for _ in range(f['d'])]; ph=''.join(f.get('ph','') for f in t); return len(t),(ph.index('a') if 'a' in ph else -1),ph
def build(name,gen,ka):
    tot,fa,ph=info(name)
    seq=rs(gen[:ka+1],fa+1)+rs(gen[ka:],tot-fa)[1:]
    assert len(seq)==tot,(name,len(seq),tot); M[name]={'frames':seq}
def plain(name,gen):
    M[name]={'frames':rs(gen,info(name)[0])}
def G(s,a,b): return [P(s,i) for i in range(a,b+1)]
for nm,ka,n in [('c_lp',6,12),('c_mp',5,16),('c_hp',8,24),('c_lk',5,12),('c_mk',6,16),('c_hk',7,24),
                ('j_p',6,16),('j_hp',5,16),('j_k',5,16),('j_hk',5,16)]:
    build(nm,G('r7_'+nm,0,n),ka)
plain('dash',G('r7_dash',0,16)); plain('dash_b',G('r7_dash_b',0,16))
plain('guard',G('r7_guard',0,12)); plain('cguard',G('r7_cguard',0,12))
plain('hit_hi',G('r7_hit_hi',3,16)); plain('hit_lo',G('r7_hit_lo',3,16)); plain('hit_c',G('r7_hit_c',7,16))
plain('tech',G('r7_tech',0,16))
plain('throw_do',G('r8_throw_do',0,24))
plain('launch',[P('r8_launch',0)]+G('r8_launch',4,24))
plain('down',G('r8_down',0,12)); plain('getup',G('r8_getup',0,24))
plain('ko',G('r7_ko',0,32)); plain('win',G('r7_win',0,40)); plain('intro',G('r7_intro',0,32))
M['rush']={'frames':G('r7_rush',1,12)}
json.dump(M,open(D+'/moves.json','w'),ensure_ascii=False,indent=1)
print('ok')
