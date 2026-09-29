"""Side-by-side: reference (left) vs ours (right), same vertical band in CSS px.
usage: python compare.py <ref.png> <ours.png> <out.png> [top_css] [height_css] [ours_top_css]"""
import sys
from PIL import Image, ImageDraw
ref, ours, out = sys.argv[1:4]
top = int(sys.argv[4]) if len(sys.argv) > 4 else 0
h = int(sys.argv[5]) if len(sys.argv) > 5 else 932
otop = int(sys.argv[6]) if len(sys.argv) > 6 else top
a, b = Image.open(ref).convert('RGB'), Image.open(ours).convert('RGB')
ca = a.crop((0, top * 2, 860, (top + h) * 2))
cb = b.crop((0, otop * 2, 860, (otop + h) * 2))
canvas = Image.new('RGB', (860 * 2 + 20, h * 2), 'white')
canvas.paste(ca, (0, 0)); canvas.paste(cb, (880, 0))
d = ImageDraw.Draw(canvas)
for y in range(0, h * 2, 100):  # 50 css px grid ticks
    d.line([(860, y), (880, y)], fill=(255, 0, 0))
canvas.save(out)
print(out, canvas.size)
