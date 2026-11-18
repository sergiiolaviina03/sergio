import sys, os, json, subprocess, numpy as np, cv2
os.environ.setdefault('OMP_NUM_THREADS','1')
from PIL import Image
import edl, gfx
from matte import Matter
from comp import Compositor, grade
W,H,FPS=1920,1080,30
SUBS=json.load(open('subs.json')) if os.path.exists('subs.json') else []

def encoder(path):
    return subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-',
        '-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',path],stdin=subprocess.PIPE)

def crop(img,cx,cy,w):
    h=w*9/16
    cx=min(max(cx,w/2),W-w/2); cy=min(max(cy,h/2),H-h/2)
    M=np.float32([[W/w,0,-(cx-w/2)*W/w],[0,H/h,-(cy-h/2)*H/h]])
    out=cv2.warpAffine(img,M,(W,H),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REFLECT)
    if w<1700:
        bl=cv2.GaussianBlur(out,(0,0),1.4); out=cv2.addWeighted(out,1.45,bl,-0.45,0)
    return out

def render_clip(ci, M, C):
    a,b,shots,lts=edl.CLIPS[ci]
    path=f'clips/c{ci:02d}.mp4'
    if os.path.exists(path): return
    n=int(round((b-a)*FPS))
    dec=subprocess.Popen(['ffmpeg','-v','error','-ss',f'{a:.3f}','-i','src/in.MOV','-t',f'{b-a:.3f}','-f','rawvideo','-pix_fmt','rgb24','-r',str(FPS),'-'],stdout=subprocess.PIPE)
    enc=encoder(path+'.tmp.mp4'); M.prev=None
    bugL=gfx.bug()
    for i in range(n):
        buf=dec.stdout.read(W*H*3)
        if len(buf)<W*H*3: break
        rgb=np.frombuffer(buf,np.uint8).reshape(H,W,3)
        ts=a+i/FPS
        fr=grade(C(rgb,M.alpha(rgb)))
        # camera
        k=max(j for j,s in enumerate(shots) if s[0]<=ts+1e-6)
        s0,(cx,cy,w0),push=shots[k]
        s1=shots[k+1][0] if k+1<len(shots) else b
        u=(ts-s0)/max(s1-s0,1e-3)
        if push>=0: w=w0*(1-push*gfx.ease_io(u))
        else: w=w0*(1+push)+(-push*w0)*gfx.ease_io(u)
        fr=crop(fr.astype(np.float32),cx,cy,min(w,1920))
        # graphics
        fr=gfx.overlay(fr,bugL)
        for (lt,dur,name,role) in lts:
            L=gfx.lower_third(name,role,ts-lt,dur)
            if L is not None: fr=gfx.overlay(fr,L)
        for (ss,se,txt) in SUBS:
            if ss<=ts<se and a-0.01<=ss<b:
                fr=gfx.overlay(fr,gfx.subtitle_cached(txt)); break
        if ci==0: fr*=min(1,i/9)
        if ci==len(edl.CLIPS)-1: fr*=min(1,(n-1-i)/12)
        enc.stdin.write(np.clip(fr,0,255).astype(np.uint8).tobytes())
    enc.stdin.close(); enc.wait(); dec.kill()
    os.rename(path+'.tmp.mp4',path)
    print('done',ci,flush=True)

def render_card(kind,dur):
    path=f'clips/{kind}.mp4'
    if os.path.exists(path): return
    from comp import build_static
    bd,_,_=build_static()
    enc=encoder(path)
    for i in range(int(dur*FPS)):
        fr=gfx.title_card(i/FPS,dur,bd,kind)
        enc.stdin.write(np.clip(fr,0,255).astype(np.uint8).tobytes())
    enc.stdin.close(); enc.wait(); print('done',kind,flush=True)

if __name__=='__main__':
    which=sys.argv[1:]
    if which and which[0] in ('intro','outro'):
        render_card(which[0],float(which[1])); sys.exit()
    M=Matter(); C=Compositor()
    for ci in map(int,which): render_clip(ci,M,C)
