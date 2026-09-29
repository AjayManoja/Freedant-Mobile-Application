"""Prints a reference page as an indented element tree: tag.classes "text"."""
import sys, re
from html.parser import HTMLParser
sys.stdout.reconfigure(encoding='utf-8')
VOID = {'img','br','hr','input','meta','link','source','path','circle','rect','line','polyline','polygon','ellipse'}
class P(HTMLParser):
    def __init__(s): super().__init__(); s.d=0; s.out=[]; s.skip=0
    def handle_starttag(s, t, a):
        a=dict(a)
        if t in ('script','style','head'): s.skip+=1; return
        if s.skip: return
        if t in ('path','circle','rect','line','polyline','polygon','ellipse'): return
        cls=a.get('class','')
        extra=''
        if t=='svg': extra=' [svg '+(cls.split(' lucide-')[-1].split()[0] if 'lucide-' in cls else '')+']'; cls=' '.join(c for c in cls.split() if not c.startswith('lucide'))
        if t=='img': extra=f" [img alt={a.get('alt','')!r}]"
        if t=='input': extra=f" [input ph={a.get('placeholder','')!r}]"
        s.out.append('  '*s.d + t + ('.'+cls.replace(' ','.') if cls else '') + extra + (f" style={a['style']!r}" if a.get('style') else ''))
        if t not in VOID and t!='svg': s.d+=1
        if t=='svg': s.skip_svg=True; s.d+=1
    def handle_endtag(s, t):
        if t in ('script','style','head'): s.skip-=1; return
        if s.skip: return
        if t in VOID - {'svg'} or t in ('path','circle','rect','line','polyline','polygon','ellipse'): return
        s.d=max(0,s.d-1)
    def handle_data(s, data):
        if s.skip: return
        t=' '.join(data.split())
        if t: s.out.append('  '*s.d + f'"{t}"')
p=P(); p.feed(open(sys.argv[1],encoding='utf-8').read())
lines=p.out
start=int(sys.argv[2]) if len(sys.argv)>2 else 0
n=int(sys.argv[3]) if len(sys.argv)>3 else 10**9
print('\n'.join(lines[start:start+n]))
