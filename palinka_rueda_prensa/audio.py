import numpy as np, subprocess, wave
import edl
SR=48000
raw=subprocess.run(['ffmpeg','-v','error','-i','src/in.MOV','-map','0:a:1','-ac','2','-ar',str(SR),'-f','f32le','-'],capture_output=True).stdout
src=np.frombuffer(raw,np.float32).reshape(-1,2)
def sting(dur, kind):
    n=int(dur*SR); t=np.arange(n)/SR
    rng=np.random.default_rng(3)
    noise=rng.normal(0,1,n)
    # rising filtered swell (one-pole lowpass with rising cutoff)
    out=np.zeros(n); y=0
    fc=200+ 4000*(t/dur)**2 if kind=='intro' else 3000*np.exp(-t*1.5)+200
    a=np.exp(-2*np.pi*fc/SR)
    for i in range(n):
        y=a[i]*y+(1-a[i])*noise[i]; out[i]=y
    env=np.clip(t/0.9,0,1)*np.clip((0.95-t)/0.15,0,1) if kind=='intro' else np.exp(-t*2.2)*np.clip(t/0.02,0,1)
    sw=out*env*0.35
    # impact: low boom + sub at crest landing
    t0=0.9 if kind=='intro' else 0.0
    tt=np.clip(t-t0,0,None); on=(t>=t0)
    boom=on*(np.sin(2*np.pi*(55*tt+18*np.exp(-tt*8)))*np.exp(-tt*2.8))*0.55
    # soft pad chord for the card (A minor-ish), very low level
    pad=sum(np.sin(2*np.pi*f*t+ph) for f,ph in [(110,0),(164.8,1),(220,2),(261.6,.5)])*0.035
    pad*=np.clip(t/1.0,0,1)*np.clip((dur-t)/1.2,0,1)
    s=sw+boom+pad
    return np.stack([s,s],1).astype(np.float32)
parts=[sting(4.5,'intro')]
fade=int(0.012*SR)
for (a,b,*_) in edl.CLIPS:
    nf=int(round((b-a)*30)); seg=src[int(round(a*SR)):int(round(a*SR))+int(nf*SR/30)].copy()
    ramp=np.linspace(0,1,fade)[:,None]
    seg[:fade]*=ramp; seg[-fade:]*=ramp[::-1]
    parts.append(seg)
parts.append(sting(4.0,'outro'))
dlg=np.concatenate(parts)
open('dialog_raw.f32','wb').write(dlg.astype(np.float32).tobytes())
print(len(dlg)/SR)
