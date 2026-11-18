import numpy as np, math, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter
F='/usr/share/fonts/opentype/inter/'
SERIF='/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf'
BURG=(122,28,40); CREAM=(240,231,214); INK=(18,18,22)
def font(name,size): return ImageFont.truetype(name if name.startswith('/') else F+name,size)

def crest(S=1024):
    im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    c=S/2
    d.ellipse([4,4,S-4,S-4],fill=INK)
    d.ellipse([18,18,S-18,S-18],fill=BURG)
    r_in=S*0.36
    d.ellipse([c-r_in-10,c-r_in-10,c+r_in+10,c+r_in+10],fill=INK)
    d.ellipse([c-r_in,c-r_in,c+r_in,c+r_in],fill=CREAM)
    # ring text
    txt='CLUB DE FÚTBOL  ★  PALINKA  ★  '
    f=font('InterDisplay-Bold.otf',int(S*0.058)); R=S*0.43
    total=sum(f.getlength(ch) for ch in txt); ang=-90-180*(total/(2*math.pi*R))*1.0
    circ=2*math.pi*R; scale=360/circ*(circ/total)  # spread around the full circle
    a=-90.0
    for ch in txt:
        w=f.getlength(ch); da=w*scale
        th=math.radians(a+da/2)
        g=Image.new('RGBA',(int(S*0.1),int(S*0.1)),(0,0,0,0)); gd=ImageDraw.Draw(g)
        gd.text((g.width/2,g.height/2),ch,font=f,fill=CREAM,anchor='mm')
        g=g.rotate(-(a+da/2)-90,resample=Image.BICUBIC)
        x=c+R*math.cos(th); y=c+R*math.sin(th)
        im.alpha_composite(g,(int(x-g.width/2),int(y-g.height/2)))
        a+=da
    # cross
    cw=S*0.028; ch_=S*0.17; cy=c-S*0.2
    d.rectangle([c-cw/2,cy-ch_/2,c+cw/2,cy+ch_/2],fill=BURG)
    d.rectangle([c-S*0.05,cy-ch_/2+S*0.04,c+S*0.05,cy-ch_/2+S*0.04+cw],fill=BURG)
    # PALINKA
    f2=font(SERIF,int(S*0.135))
    d.text((c,c+S*0.02),'PALINKA',font=f2,fill=BURG,anchor='mm')
    d.line([c-S*0.25,c+S*0.1,c+S*0.25,c+S*0.1],fill=BURG,width=int(S*0.008))
    f3=font(SERIF,int(S*0.085))
    d.text((c,c+S*0.18),'CF',font=f3,fill=BURG,anchor='mm')
    return im

def backdrop(W=1920,H=1080):
    base=np.zeros((H,W,3),np.float32)
    # dark charcoal with burgundy tint gradient
    yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
    base[:]=np.array([20,20,26],np.float32)
    im=Image.fromarray(base.astype(np.uint8)).convert('RGBA')
    cr=crest(512)
    cellw,cellh=390,240
    fw=font('InterDisplay-Black.otf',58); fs=font('InterDisplay-Bold.otf',38); fs2=font('InterDisplay-SemiBold.otf',25)
    items=['crest','word','jard','crest','prod','word']
    row=0
    for y in range(-60,H+cellh,cellh):
        off=(cellw//2) if row%2 else 0
        for i,x in enumerate(range(-cellw+off,W+cellw,cellw)):
            k=items[(i+row*2)%len(items)]
            cx,cy=x+cellw//2,y+cellh//2
            layer=Image.new('RGBA',(cellw,cellh),(0,0,0,0)); d=ImageDraw.Draw(layer)
            if k=='crest':
                c=cr.resize((168,168),Image.LANCZOS); layer.alpha_composite(c,((cellw-168)//2,(cellh-168)//2))
            elif k=='word':
                d.text((cellw/2,cellh/2-8),'PALINKA',font=fw,fill=(226,218,204),anchor='mm')
                d.text((cellw/2,cellh/2+38),'C L U B   D E   F Ú T B O L',font=fs2,fill=(196,70,84),anchor='mm')
            elif k=='jard':
                d.text((cellw/2,cellh/2-20),'JARDINERÍA',font=fs,fill=(128,160,112),anchor='mm')
                d.text((cellw/2,cellh/2+24),'JORGE',font=fw,fill=(128,160,112),anchor='mm')
            elif k=='prod':
                d.text((cellw/2,cellh/2-20),'PRODUCTO',font=fs,fill=(200,170,96),anchor='mm')
                d.text((cellw/2,cellh/2+24),'NACIONAL',font=fw,fill=(200,170,96),anchor='mm')
            im.alpha_composite(layer,(x,y))
        row+=1
    a=np.asarray(im.convert('RGB')).astype(np.float32)
    # fabric weave texture
    rng=np.random.default_rng(1)
    n=rng.normal(0,1,(H,W)).astype(np.float32)
    n=cv2.GaussianBlur(n,(0,0),0.8)*5
    a+=n[...,None]
    # light: soft key from top center + falloff, vignette
    lx=np.exp(-(((xx-W*0.5)/(W*0.55))**2+((yy-H*0.25)/(H*0.75))**2))
    a*=(0.30+0.62*lx)[...,None]
    return np.clip(a,0,255).astype(np.uint8)

def skirt(W=1920,H=1080):
    # tablecloth: deep black/burgundy fabric with vertical folds
    xx=np.arange(W,dtype=np.float32)
    folds=(np.sin(xx/37.0)*0.5+np.sin(xx/13.0+1.3)*0.25+np.sin(xx/71.0+0.4)*0.35)
    col=np.array([26,22,28],np.float32)
    a=np.tile(col,(H,W,1))
    shade=(1+0.22*folds)[None,:,None]
    yy=np.arange(H,dtype=np.float32)[:,None,None]
    a=a*shade*(1.15-0.35*(yy-760)/320).clip(0.7,1.2)
    rng=np.random.default_rng(2); a+=rng.normal(0,2,a.shape)
    return np.clip(a,0,255).astype(np.uint8)

if __name__=='__main__':
    crest(1024).save('assets/crest.png')
    Image.fromarray(backdrop()).save('assets/backdrop.png')
    Image.fromarray(skirt()).save('assets/skirt.png')
