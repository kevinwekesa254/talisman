"""Dependency-free PDF writer for the Talisman menus.

Kept in the repo so the menus can be regenerated without reinventing this.
Usage: import build() and pass title, subtitle and a list of sections.
Each item is (name, price, description) — price and description optional.
"""
import os, zlib

W, H = 595.28, 841.89          # A4 points
L, R = 62, W - 62
WINE=(0.42,0.13,0.16); INK=(0.11,0.09,0.08); MUTE=(0.44,0.40,0.34); GOLD=(0.79,0.60,0.36)

def esc(s): return s.replace('\\', r'\\').replace('(', r'\(').replace(')', r'\)')

class Page:
    def __init__(self): self.ops=[]; self.y=H-92
    def rgb(self,c): self.ops.append(f"{c[0]:.3f} {c[1]:.3f} {c[2]:.3f} rg")
    def text(self,s,f,sz,col=INK,x=L,leading=None):
        self.rgb(col); self.ops += ["BT", f"/{f} {sz} Tf", f"{x:.2f} {self.y:.2f} Td",
                                    f"({esc(s)}) Tj", "ET"]
        self.y -= (leading if leading else sz*1.5)
    def right(self,s,f,sz,col=WINE,yoff=0):
        w=len(s)*sz*0.5; self.rgb(col)
        self.ops += ["BT", f"/{f} {sz} Tf", f"{R-w:.2f} {self.y+yoff:.2f} Td",
                     f"({esc(s)}) Tj", "ET"]
    def rule(self,col=(0.886,0.851,0.776),width=0.7):
        self.ops += [f"{col[0]:.3f} {col[1]:.3f} {col[2]:.3f} RG", f"{width} w",
                     f"{L:.2f} {self.y:.2f} m {R:.2f} {self.y:.2f} l S"]
        self.y -= 16
    def gap(self,n=12): self.y -= n
    def wrap(self,s,f,sz,col,wc):
        line=""
        for wd in s.split():
            t=(line+" "+wd).strip()
            if len(t)>wc: self.text(line,f,sz,col,leading=sz*1.45); line=wd
            else: line=t
        if line: self.text(line,f,sz,col,leading=sz*1.45)
    def stream(self): return "\n".join(self.ops).encode("latin-1","replace")

def build(path,title,subtitle,sections):
    pages=[]; p=Page()
    def header(pg,first):
        pg.ops += [f"1.4 w {GOLD[0]:.3f} {GOLD[1]:.3f} {GOLD[2]:.3f} RG",
                   f"{L:.2f} {H-58:.2f} m {R:.2f} {H-58:.2f} l S"]
        if first:
            pg.y=H-108; pg.text("TALISMAN","HB",11,MUTE); pg.gap(6)
            pg.text(title,"TR",30,INK,leading=34); pg.wrap(subtitle,"TI",12.5,MUTE,78)
            pg.gap(10); pg.rule(GOLD,1.0)
        else: pg.y=H-96
    header(p,True)
    for sec in sections:
        if p.y<190: pages.append(p); p=Page(); header(p,False)
        p.gap(10); p.text(sec["name"].upper(),"HB",10.5,WINE,leading=17)
        if sec.get("note"): p.wrap(sec["note"],"TI",11,MUTE,84)
        p.gap(4); p.rule()
        for it in sec["items"]:
            if p.y<96: pages.append(p); p=Page(); header(p,False)
            name,price,desc=it[0],it[1],(it[2] if len(it)>2 else "")
            p.text(name,"TR",14,INK,leading=17)
            if price: p.right(price,"TR",12,WINE,yoff=17)
            if desc: p.wrap(desc,"H",9.5,MUTE,96)
            p.gap(9)
    p.y=62; p.rgb(MUTE); p.ops.append("BT /H 8.5 Tf")
    p.ops.append(f"{L:.2f} 54 Td (Ngong Road, Karen, Nairobi   |   +254 705 999 997   |   talisman.co.ke) Tj ET")
    pages.append(p)

    fonts={"H":"/Helvetica","HB":"/Helvetica-Bold","TR":"/Times-Roman","TI":"/Times-Italic"}
    n=len(pages); fs=3+n*2
    objs=["<< /Type /Catalog /Pages 2 0 R >>",
          f"<< /Type /Pages /Count {n} /Kids [{' '.join(f'{3+i*2} 0 R' for i in range(n))}] >>"]
    fref=" ".join(f"/{k} {fs+i} 0 R" for i,k in enumerate(fonts))
    for i,pg in enumerate(pages):
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W:.2f} {H:.2f}] "
                    f"/Resources << /Font << {fref} >> >> /Contents {4+i*2} 0 R >>")
        objs.append(("STREAM",pg.stream()))
    for k,b in fonts.items():
        objs.append(f"<< /Type /Font /Subtype /Type1 /BaseFont {b} /Encoding /WinAnsiEncoding >>")

    out=bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"); offs=[]
    for i,o in enumerate(objs,1):
        offs.append(len(out))
        if isinstance(o,tuple):
            d=zlib.compress(o[1])
            out+=f"{i} 0 obj\n<< /Length {len(d)} /Filter /FlateDecode >>\nstream\n".encode()
            out+=d+b"\nendstream\nendobj\n"
        else: out+=f"{i} 0 obj\n{o}\nendobj\n".encode()
    x=len(out); out+=f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
    for o in offs: out+=f"{o:010d} 00000 n \n".encode()
    out+=f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{x}\n%%EOF\n".encode()
    os.makedirs(os.path.dirname(path),exist_ok=True); open(path,"wb").write(out)
    print(f"  {os.path.basename(path):30} {len(pages)}p  {len(out)//1024}KB")
