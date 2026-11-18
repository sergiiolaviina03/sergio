import cv2, numpy as np
from PIL import Image, ImageDraw
from matte import TABLE_Y
W,H=1920,1080
def flag_left(y): return 198+ (y-720)*(24/360)
def flag_right(y): return 1778-(y-720)*(16/360)
def front_edge(x): return 771+ x*(6/1920)

def build_static():
    bd=np.asarray(Image.open('assets/backdrop.png').convert('RGB')).astype(np.float32)
    bd=cv2.GaussianBlur(bd,(0,0),3.0)   # depth of field
    sk=np.asarray(Image.open('assets/skirt.png').convert('RGB')).astype(np.float32)
    # skirt mask: below table front edge, outside the flag
    yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
    m=(yy>front_edge(xx)) & ((xx<flag_left(yy)-2) | (xx>flag_right(yy)+2))
    m=cv2.GaussianBlur(m.astype(np.float32),(0,0),1.2)
    # a subtle top hem shadow under the table edge
    hem=np.clip(1-(yy-front_edge(xx))/18,0,1)*m
    sk=sk*(1-0.5*hem[...,None])
    return bd, sk, m[...,None]

def mic_sprite_old(scale=2):
    S=scale; w,h=120*S,230*S
    im=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    cx=w//2
    # base
    d.ellipse([cx-38*S,h-24*S,cx+38*S,h-2*S],fill=(14,14,16,255))
    d.ellipse([cx-34*S,h-24*S,cx+34*S,h-10*S],fill=(40,40,44,255))
    d.ellipse([cx-20*S,h-22*S,cx+16*S,h-16*S],fill=(90,90,96,255))
    # gooseneck: gentle S curve up
    pts=[]
    for i in range(60):
        t=i/59; y=h-16*S-t*(150*S); x=cx+ (np.sin(t*np.pi)*9-t*6)*S
        pts.append((x,y))
    for i in range(len(pts)-1):
        d.line([pts[i],pts[i+1]],fill=(22,22,25,255),width=int(5*S))
    for i in range(0,len(pts)-1,2):
        d.line([(pts[i][0]-1*S,pts[i][1]),(pts[i+1][0]-1*S,pts[i+1][1])],fill=(85,85,92,255),width=max(1,int(1*S)))
    tx,ty=pts[-1]
    # LED ring
    d.rounded_rectangle([tx-8*S,ty-8*S,tx+8*S,ty],radius=2*S,fill=(200,30,30,255))
    # head capsule (tilted slightly)
    head=Image.new('RGBA',(30*S,60*S),(0,0,0,0)); hd=ImageDraw.Draw(head)
    hd.rounded_rectangle([2*S,0,28*S,58*S],radius=12*S,fill=(20,20,22,255))
    for yy in range(4*S,56*S,3*S):
        hd.line([(5*S,yy),(25*S,yy)],fill=(48,48,52,255),width=1)
    hd.rounded_rectangle([7*S,4*S,10*S,50*S],radius=2*S,fill=(110,110,118,160))
    head=head.rotate(-8,resample=Image.BICUBIC,expand=True)
    im.alpha_composite(head,(int(tx-head.width/2+3*S),int(ty-head.height+2*S)))
    im=im.resize((w//S,h//S),Image.LANCZOS)
    return np.asarray(im).astype(np.float32)/255

def mic_sprite(scale=3):
    S=scale; w,h=140*S,250*S
    im=Image.new('RGBA',(w,h),(0,0,0,0)); d=ImageDraw.Draw(im)
    cx=w//2
    # weighted base: dark puck with rim highlight
    d.ellipse([cx-44*S,h-30*S,cx+44*S,h-2*S],fill=(10,10,12,255))
    d.ellipse([cx-42*S,h-30*S,cx+42*S,h-9*S],fill=(34,34,38,255))
    d.ellipse([cx-30*S,h-28*S,cx+10*S,h-20*S],fill=(78,78,86,255))
    d.rectangle([cx-6*S,h-34*S,cx+6*S,h-20*S],fill=(28,28,32,255))
    # gooseneck
    pts=[(cx+(np.sin(t*np.pi)*10-t*4)*S, h-30*S-t*160*S) for t in np.linspace(0,1,80)]
    for i in range(len(pts)-1): d.line([pts[i],pts[i+1]],fill=(18,18,20,255),width=int(7*S))
    for i in range(0,len(pts)-1,3): d.line([(pts[i][0]-2*S,pts[i][1]),(pts[i+1][0]-2*S,pts[i+1][1])],fill=(92,92,100,255),width=int(1.5*S))
    tx,ty=pts[-1]
    d.rounded_rectangle([tx-9*S,ty-10*S,tx+9*S,ty+2*S],radius=3*S,fill=(210,32,36,255))
    d.rectangle([tx-9*S,ty-6*S,tx+9*S,ty-4*S],fill=(255,120,110,255))
    head=Image.new('RGBA',(36*S,74*S),(0,0,0,0)); hd=ImageDraw.Draw(head)
    hd.rounded_rectangle([2*S,0,34*S,72*S],radius=15*S,fill=(16,16,18,255))
    for yy in range(5*S,68*S,int(2.5*S)): hd.line([(5*S,yy),(31*S,yy)],fill=(44,44,48,255),width=1*S)
    for xx in range(5*S,31*S,int(2.5*S)): hd.line([(xx,5*S),(xx,68*S)],fill=(38,38,42,255),width=1*S)
    hd.rounded_rectangle([8*S,6*S,12*S,62*S],radius=2*S,fill=(150,150,160,140))
    hd.rounded_rectangle([2*S,0,34*S,72*S],radius=15*S,outline=(70,70,76,255),width=1*S)
    head=head.rotate(-6,resample=Image.BICUBIC,expand=True)
    im.alpha_composite(head,(int(tx-head.width/2+3*S),int(ty-head.height+1*S)))
    im=im.resize((w//S,h//S),Image.LANCZOS)
    return np.asarray(im).astype(np.float32)/255

MICS=[(575,748),(1095,748),(1425,748)]  # base centre x, base bottom y

class Compositor:
    def __init__(self):
        self.bd,self.sk,self.skm=build_static()
        self.mic=mic_sprite()
        self.wrap=cv2.GaussianBlur(self.bd,(0,0),6)
        yy=np.arange(H)[:,None]
        self.seam=np.clip((yy-(TABLE_Y-6))/8,0,1).astype(np.float32)[...,None]  # 0 above table edge
    def __call__(self,rgb,alpha):
        R=TABLE_Y+4
        full=rgb.astype(np.float32)
        out_full=full
        f=full[:R]; alpha=alpha[:R]
        a=alpha[...,None]
        # region above table: a=1 keep, else backdrop. below the table edge always original
        a_full=np.maximum(a,self.seam[:R])
        # cast shadow of the people onto the backdrop
        pa=cv2.resize(alpha,(W//4,R//4),interpolation=cv2.INTER_AREA)
        M=np.float32([[1,0,9],[0,1,5]])
        sh=cv2.warpAffine(pa,M,(W//4,R//4))
        sh=cv2.GaussianBlur(sh,(0,0),7)
        sh=cv2.resize(sh,(W,R))[...,None]
        bg=self.bd[:R]*(1-0.55*sh)
        # despill: remove yellow cast in a band around the matte edge
        hard=(alpha>0.5).astype(np.uint8)
        k=np.ones((9,9),np.uint8)
        band=(cv2.dilate(hard,k)-cv2.erode(hard,k)).astype(np.float32)
        band=cv2.GaussianBlur(band,(0,0),2)[...,None]*(1-self.seam[:R])
        mn=np.minimum(f[...,0:1],f[...,1:2])
        yel=np.clip(mn-f[...,2:3],0,None)
        f=f-band*0.85*yel*np.array([1,1,0],np.float32)+band*0.25*yel*np.array([0,0,1],np.float32)
        edge=np.clip(1-np.abs(a-0.5)*2,0,1)*(1-self.seam[:R])
        # light wrap
        wrap=self.wrap[:R]
        f=f*(1-0.08*edge)+wrap*0.08*edge
        f=f*np.array([0.975,0.985,1.05],np.float32)
        out_full[:R]=f*a_full+bg*(1-a_full)
        out=out_full
        # tablecloth skirt
        y0s=760
        out[y0s:]=out[y0s:]*(1-self.skm[y0s:])+self.sk[y0s:]*self.skm[y0s:]
        # microphones
        mh,mw=self.mic.shape[:2]
        for (x,yb) in MICS:
            x0,y0=x-mw//2,yb-mh
            reg=out[y0:y0+mh,x0:x0+mw]
            # contact shadow on table
            sh=np.zeros((mh,mw),np.float32); cv2.ellipse(sh,(mw//2+6,mh-8),(46,9),0,0,360,1,-1)
            sh=cv2.GaussianBlur(sh,(0,0),5)[...,None]
            reg*= (1-0.45*sh)
            ma=self.mic[...,3:4]
            reg[:]=reg*(1-ma)+self.mic[...,:3]*255*ma
        return out
def grade(img):
    x=img.astype(np.float32)
    x=(x-127.5)*1.06+127.5
    g=x.mean(axis=2,keepdims=True)
    x=g+(x-g)*1.08
    return np.clip(x,0,255,out=x)
