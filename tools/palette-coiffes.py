# Usage: python3 tools/palette-coiffes.py   (depuis le dossier du site)
# Skinoskope (palette/) ne cache pas les cheveux sous les coiffes: le moteur dessine juste la coiffe par-dessus.
# Ce script mesure, pour chaque coiffe de palette/d3, la part du crâne qu'elle recouvre (vue de face, sur
# 6 têtes de référence). Au-dessus de 50 %, la coiffe cache les cheveux; les petits accessoires (cache-œil,
# oreilles, cornes, couronnes, bandeaux...) les laissent. La liste est écrite dans le build (const HairHats).
# À relancer après chaque nouveau build de PaletteDofus.
import glob, json, os, re, sys
from PIL import Image, ImageChops, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "palette")
D3 = os.path.join(ROOT, "d3")
def load(i): return json.load(open(os.path.join(D3, 'skins', f'{i}.json')))
def tris_of(sk, chunks, M=(1,0,0,0,1,0)):
    v=sk['verts']; t=sk['tris']; out=[]
    a,b,c,d,e,f=M
    for s,ti,n in chunks:
        for q in range(0,n,3):
            pts=[]
            for r in range(3):
                L=(s+t[ti+q+r])*4; x,y=v[L],v[L+1]
                pts.append((a*x+b*y+c, d*x+e*y+f))
            out.append(pts)
    return out
def walk(sk, part):
    """renvoie {symbole: [chunks]} pour chaque symbole de premier niveau, et les transformations des slots"""
    p=sk['parts'][part]; dl=p['dl']; ch=p['chunks']; w=0; groups={}; xf={}
    def rec(i,j,top):
        nonlocal w
        while i<j:
            X,P=dl[i][0],dl[i][1]
            if X<0:
                if w<len(ch): groups.setdefault(top,[]).append(ch[w])
                w+=1; i+=1; continue
            name=sk['symbols'][X]
            if top is None and len(dl[i])>2: xf[name]=dl[i][2]
            rec(i+1,i+1+P, name if top is None else top); i+=1+P
    rec(0,len(dl),None); return groups,xf
SLOTS=('Chapeau','Custo')
def Uu(x): c,s,d,u,g,A=x; return (c,-s,g,-d,u,-A)
def raster(tris, box, scale=8):
    x0,y0,x1,y1=box; W=int((x1-x0)*scale)+2; H=int((y1-y0)*scale)+2
    im=Image.new('1',(W,H)); dr=ImageDraw.Draw(im)
    for t in tris: dr.polygon([((x-x0)*scale,(y1-y)*scale) for x,y in t], fill=1)
    return im
def coverage(head, hat, dirn='1'):
    g,xf=walk(head,f'Tete_{dirn}')
    skull=[]
    for k in g:
        if k.startswith('Crane') or k.startswith('cheveuxCrane'): skull+=tris_of(head,g[k])
    ht=[]
    for base in SLOTS:
        slot=f'{base}_{dirn}'
        if slot in hat['parts'] and slot in xf: ht+=tris_of(hat,hat['parts'][slot]['chunks'],Uu(xf[slot]))
    if not ht or not skull: return None
    xs=[x for t in skull+ht for x,_ in t]; ys=[y for t in skull+ht for _,y in t]
    box=(min(xs),min(ys),max(xs),max(ys))
    a=raster(skull,box); b=raster(ht,box)
    inter=ImageChops.logical_and(a,b)
    na=a.histogram()[255]
    ni=inter.histogram()[255]
    return ni/na if na else None

KEEP = re.compile(r"^(Couronne|Diadème|Tiare|Cornes?|Oreilles|Noreilles|Halo|Auréole|Boucle|Lunettes|Binocle|Cache-œil|Bandeau)", re.I)
HELM = re.compile(r"^(Casque|Heaume)", re.I)

def main():
    index = json.load(open(os.path.join(D3, "index.json")))
    breeds = {b["id"]: b for b in index["breeds"]}
    heads = [load(breeds[b][s]["heads"][0]) for b in (8, 2, 1) for s in ("male", "female")]
    names = {}
    for item in index["items"]:
        if item["category"] == "hat":
            names.setdefault(item["skin"], []).append(item["name"])
    covers = []
    for skin, labels in names.items():
        hat = load(skin)
        values = []
        for head in heads:
            for direction in "10256":
                c = coverage(head, hat, direction)
                if c is not None:
                    values.append(c)
                    break
        if not values:
            continue
        v = sum(values) / len(values)
        if (v >= 0.5 and not all(KEEP.match(n) for n in labels)) or (any(HELM.match(n) for n in labels) and v >= 0.35):
            covers.append(skin)
    covers.sort()
    bundle = glob.glob(os.path.join(ROOT, "assets", "index-*.js"))[0]
    js = open(bundle, encoding="utf-8").read()
    js, n = re.subn(r"const HairHats=new Set\(\[[\d,]*\]\);", f"const HairHats=new Set([{','.join(map(str, covers))}]);", js)
    if not n:
        sys.exit("const HairHats introuvable dans le build: reporter d'abord le correctif (voir README)")
    open(bundle, "w", encoding="utf-8").write(js)
    print(f"{len(covers)} coiffes sur {len(names)} cachent les cheveux")

if __name__ == "__main__":
    main()
