import sys, os, render
from stories_real import REAL
import importlib
def sheet(story, outdir):
    # render frames in the middle of each beat
    import render as R
    # compute timings by doing tts (cached)
    t0=0.4; frames=[]
    for b in story['beats']:
        a,w = R.tts(b['say'], b.get('voice', story.get('voice')), story.get('rate','-4%'), story.get('pitch','-2Hz'))
        d=len(a)/R.SR+R.GAP; frames.append(int((t0+d*0.6)*R.FPS)); t0+=d
    shots,_=R.build(story, outdir, only_frames=frames)
    os.system(f"ffmpeg -v error -y " + " ".join(f"-i {s}" for s in shots) + f" -filter_complex \"" + "".join(f"[{i}]scale=240:-1[s{i}];" for i in range(len(shots))) + "".join(f"[s{i}]" for i in range(len(shots))) + f"xstack=inputs={len(shots)}:layout=" + "|".join(f"{(i%8)*240}_{(i//8)*427}" for i in range(len(shots))) + f":fill=black\" {outdir}/{story['id']}_sheet.png")
    for s in shots: os.remove(s)
if __name__=='__main__':
    import stories_real, stories_fic
    allst = stories_real.REAL + getattr(stories_fic,'FIC',[])
    for st in allst:
        if any(a in st['id'] for a in sys.argv[1:]): sheet(st, sys.argv[0] and '/tmp/claude-0/-home-user-sergio/9b3e18b3-03ca-55aa-96e1-954e67c98118/scratchpad/prev')
