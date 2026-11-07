"""build.py — bundle src/ into ONE portable index.html.

Why: the team wants a single file they can email / open from a USB stick.
Run:  python build.py   →  writes index.html next to this script.
Order matters: feeds → authority → normalize → graph → app.
"""
from pathlib import Path

root = Path(__file__).parent
src = root / 'src'
js_order = ['feeds.js', 'authority.js', 'normalize.js', 'graph.js', 'app.js']

shell = (src / 'shell.html').read_text(encoding='utf-8')
css = (src / 'style.css').read_text(encoding='utf-8')
js = '\n\n'.join(f'/* ---- {name} ---- */\n' + (src / name).read_text(encoding='utf-8') for name in js_order)

# guard: a literal </script> inside the JS would end the tag early
assert '</script' not in js.lower(), 'JS contains </script>'

# Leaflet (BSD-2) is inlined so maps work from a USB stick; only map tiles need internet.
lcss = (root / 'vendor' / 'leaflet.css').read_text(encoding='utf-8')
ljs = (root / 'vendor' / 'leaflet.js').read_text(encoding='utf-8')
out = (shell.replace('/*__LEAFLET_CSS__*/', lcss).replace('/*__LEAFLET_JS__*/', ljs)
            .replace('/*__CSS__*/', css).replace('/*__JS__*/', js))
(root / 'index.html').write_text(out, encoding='utf-8')
print(f'index.html written: {len(out) / 1024:.0f} KB')
