import os, re, subprocess, tempfile
from lxml import etree
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "c": "http://schemas.openxmlformats.org/drawingml/2006/chart"}
ORIG = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "modelo", "MFV_ME_EPP_original.xlsx"))
ABA, DESENHO, GRAFICO = "xl/worksheets/sheet1.xml", "xl/drawings/drawing1.xml", "xl/charts/chart1.xml"

def celula(partes, ref):
    t = etree.fromstring(partes[ABA])
    c = t.find(f".//m:c[@r='{ref}']", NS)
    return c

def valor(partes, ref):
    """Texto (sharedString/inlineStr) ou número como string; fórmula via formula()."""
    c = celula(partes, ref)
    if c is None: return None
    if c.get("t") == "s":
        ss = etree.fromstring(partes["xl/sharedStrings.xml"])
        si = ss.findall("m:si", NS)[int(c.find("m:v", NS).text)]
        return "".join(x.text or "" for x in si.iter(f"{{{NS['m']}}}t"))
    if c.get("t") == "inlineStr":
        return "".join(x.text or "" for x in c.iter(f"{{{NS['m']}}}t"))
    v = c.find("m:v", NS)
    return v.text if v is not None else None

def formula(partes, ref):
    c = celula(partes, ref)
    f = None if c is None else c.find("m:f", NS)
    return None if f is None else "=" + f.text

def merges(partes):
    t = etree.fromstring(partes[ABA])
    return {m.get("ref") for m in t.iter(f"{{{NS['m']}}}mergeCell")}

def ancoras(partes):
    t = etree.fromstring(partes[DESENHO])
    out = []
    for a in t:
        fr = a.find("xdr:from", NS)
        txt = "".join(x.text or "" for x in a.iter(f"{{{NS['a']}}}t"))
        nomes = [n.get("name") for n in a.iter(f"{{{NS['xdr']}}}cNvPr")]
        kind = "pic" if a.find("xdr:pic", NS) is not None else "outro"
        out.append(dict(col=int(fr.find("xdr:col", NS).text), row=int(fr.find("xdr:row", NS).text),
                        texto=txt, nomes=nomes, tipo=kind, el=a))
    return out

def abre_no_libreoffice(partes):
    import xlsxpkg
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "t.xlsx"); xlsxpkg.gravar(partes, p)
        r = subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", d, p],
                           capture_output=True, timeout=180)
        return r.returncode == 0 and os.path.exists(os.path.join(d, "t.pdf"))
