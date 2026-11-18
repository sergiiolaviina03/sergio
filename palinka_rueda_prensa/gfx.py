import numpy as np, cv2, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
F='/usr/share/fonts/opentype/inter/'
def font(n,s): return ImageFont.truetype(F+n,s)
W,H=1920,1080
BURG=(122,28,40); CREAM=(240,231,214); INK=(14,14,18)
CREST=Image.open('assets/crest.png')
def ease(t): t=min(max(t,0),1); return 1-(1-t)**3
def ease_io(t): t=min(max(t,0),1); return t*t*(3-2*t)

def overlay(base, layer):
    """base float32 HxWx3 0..255, layer PIL RGBA"""
    a=np.asarray(layer).astype(np.float32)
    al=a[...,3:4]/255
    return base*(1-al)+a[...,:3]*al

_bug=None
def bug():
    global _bug
    if _bug is None:
        L=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(L)
        c=CREST.resize((78,78),Image.LANCZOS)
        # left bug
        d.rounded_rectangle([40,38,40+330,38+82],radius=10,fill=(10,10,14,170))
        L.alpha_composite(c,(46,40))
        d.text((136,52),'PALINKA CF',font=font('InterDisplay-Black.otf',30),fill=CREAM)
        d.text((136,88),'SALA DE PRENSA',font=font('Inter-SemiBold.otf',17),fill=(214,84,98))
        # right tag
        t1='RUEDA DE PRENSA · PREVIA'; t2='PALINKA CF  vs  CRYSTAL PALACE'
        f1=font('Inter-Bold.otf',18); f2=font('InterDisplay-Bold.otf',26)
        w=max(f1.getlength(t1),f2.getlength(t2))+44
        x1=W-40-w
        d.rounded_rectangle([x1,38,W-40,120],radius=10,fill=(10,10,14,170))
        d.rectangle([x1,38,x1+6,120],fill=BURG)
        d.text((x1+24,50),t1,font=f1,fill=(214,84,98))
        d.text((x1+24,76),t2,font=f2,fill=CREAM)
        _bug=L
    return _bug

def lower_third(name, role, t, dur):
    """t = seconds since lower third start; returns RGBA layer or None"""
    if t<0 or t>dur: return None
    inn=ease(t/0.5); out=ease((dur-t)/0.4)
    k=min(inn,out)
    L=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(L)
    fN=font('InterDisplay-Black.otf',50); fR=font('Inter-SemiBold.otf',25)
    wN=fN.getlength(name.upper()); wR=fR.getlength(role.upper())
    bw=int(max(wN,wR)+70)
    x=110; y=735
    reveal=int(bw*k)
    if reveal<4: return None
    box=Image.new('RGBA',(bw+20,140),(0,0,0,0)); b=ImageDraw.Draw(box)
    b.rectangle([0,0,10,128],fill=(214,84,98,255))
    b.rectangle([10,0,bw,78],fill=(18,18,22,235))
    b.rectangle([10,78,bw-40,128],fill=BURG+(245,))
    b.text((34,39),name.upper(),font=fN,fill=CREAM,anchor='lm')
    b.text((34,104),role.upper(),font=fR,fill=CREAM,anchor='lm')
    box=box.crop((0,0,reveal,140))
    L.alpha_composite(box,(x,y))
    if k<1:
        arr=np.asarray(L).copy(); arr[...,3]=(arr[...,3]*min(1,k*1.5)).astype(np.uint8); L=Image.fromarray(arr)
    return L

def subtitle(text):
    L=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(L)
    f=font('InterDisplay-Bold.otf',46)
    lines=text.split('\n')
    lh=60; y0=H-70-lh*len(lines)
    for i,ln in enumerate(lines):
        w=f.getlength(ln)
        x=(W-w)/2; y=y0+i*lh
        d.rounded_rectangle([x-20,y-6,x+w+20,y+lh-4],radius=10,fill=(0,0,0,150))
        d.text((x+2,y+3),ln,font=f,fill=(0,0,0,200))
        d.text((x,y),ln,font=f,fill=(255,255,255,255))
    return L

def title_card(t, dur, bd, kind='intro'):
    """bd: float32 backdrop; returns float32 frame"""
    g=bd*0.25
    # moving light sweep
    xx=np.linspace(0,1,W)[None,:,None]
    sweep=np.exp(-((xx-(t/dur*1.6-0.3))/0.12)**2)*40
    fr=g+sweep
    L=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(L)
    k=ease(t/0.9)
    s=int(300*(0.85+0.15*k))
    c=CREST.resize((s,s),Image.LANCZOS)
    ca=np.asarray(c).copy(); ca[...,3]=(ca[...,3]*k).astype(np.uint8); c=Image.fromarray(ca)
    # glow
    glow=Image.new('RGBA',(W,H),(0,0,0,0)); gd=ImageDraw.Draw(glow)
    gd.ellipse([W/2-260,330-260,W/2+260,330+260],fill=(150,30,45,int(110*k)))
    glow=glow.filter(ImageFilter.GaussianBlur(90))
    L.alpha_composite(glow)
    L.alpha_composite(c,(int(W/2-s/2),int(330-s/2)))
    if kind=='intro':
        t1,t2,t3='RUEDA DE PRENSA','PREVIA DEL PARTIDO','PALINKA CF  vs  CRYSTAL PALACE'
    else:
        t1,t2,t3='PALINKA CF','FIN DE LA RUEDA DE PRENSA','GRACIAS A TODOS LOS MEDIOS'
    k2=ease((t-0.6)/0.7); k3=ease((t-1.1)/0.7)
    fT=font('InterDisplay-Black.otf',96); fS=font('Inter-Bold.otf',30); fM=font('InterDisplay-Bold.otf',40)
    def txt(y,s_,f,col,kk,spacing=0):
        if kk<=0: return
        lay=Image.new('RGBA',(W,140),(0,0,0,0)); ld=ImageDraw.Draw(lay)
        ld.text((W/2,70),s_,font=f,fill=col+(int(255*kk),),anchor='mm')
        L.alpha_composite(lay,(0,int(y-70+30*(1-kk))))
    txt(590,t1,fT,CREAM,k2)
    d.rectangle([W/2-int(160*k2),660,W/2+int(160*k2),665],fill=(214,84,98,255))
    txt(712,t2,fS,(214,84,98),k3)
    txt(790,t3,fM,CREAM,k3)
    fr=overlay(fr,L)
    # fades
    fade=min(1,t/0.35, (dur-t)/0.35)
    return fr*max(0,fade)

_subc={}
def subtitle_cached(text):
    if text not in _subc: _subc[text]=subtitle(text)
    return _subc[text]
