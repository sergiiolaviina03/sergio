import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render, stories_real, stories_fic
ALL = stories_real.REAL + stories_fic.FIC
sel = [s for s in ALL if not sys.argv[1:] or any(a in s['id'] for a in sys.argv[1:])]
for st in sel:
    out, dur = render.build(st, os.path.join(render.ROOT, 'out'))
    print(f"{out}  {dur:.1f}s", flush=True)
