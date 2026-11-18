import json, numpy as np
from subs_src import SRC
T=json.load(open('transcript2.json'))
words=[w for s in T for w in s['words']]
out=[]
for (a,b,txt) in SRC:
    chunks=[c.strip().replace('/','\n') for c in txt.split('|')]
    ws=[w for w in words if w['s']>=a-0.3 and w['e']<=b+0.5]
    # cumulative char timeline of whisper words
    if len(ws)<2:
        times=np.array([a,b]); chars=np.array([0,1.0])
    else:
        L=np.cumsum([len(w['w'].strip())+1 for w in ws]).astype(float)
        chars=np.concatenate([[0],L/L[-1]]); times=np.concatenate([[ws[0]['s']],[w['e'] for w in ws]])
    cl=np.cumsum([len(c) for c in chunks]).astype(float); cl=np.concatenate([[0],cl/cl[-1]])
    tb=np.interp(cl,chars,times)
    tb[0]=a; tb[-1]=max(b,tb[-1])
    for i,c in enumerate(chunks):
        out.append([round(tb[i],2),round(tb[i+1]+(0.15 if i==len(chunks)-1 else 0),2),c])
json.dump(out,open('subs.json','w'),ensure_ascii=False,indent=0)
for o in out: print(o[0],o[1],o[2].replace('\n',' / '))
