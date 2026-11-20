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

def preencher(partes, valores):
    """Só para testes: escreve valores (número ou texto) em células da aba MFV EP."""
    import blocos
    p = dict(partes)
    t = etree.fromstring(p[ABA])
    linhas = blocos._linhas(t)
    for ref, v in valores.items():
        r = int(re.sub(r"[A-Z]", "", ref))
        c = blocos._celula(linhas[r], ref)
        for ch in list(c): c.remove(ch)
        c.attrib.pop("t", None)
        if isinstance(v, str):
            blocos._texto(c, v)
        else:
            etree.SubElement(c, f"{{{NS['m']}}}v").text = repr(float(v))
    p[ABA] = etree.tostring(t, xml_declaration=True, encoding="UTF-8", standalone=True)
    return p

def recalcular_partes(partes):
    import xlsxpkg
    sys_path = os.path.join(os.path.dirname(__file__), "..", "..", "tests")
    import sys; sys.path.insert(0, os.path.abspath(sys_path))
    import lo_recalc
    d = tempfile.mkdtemp(); f = os.path.join(d, "x.xlsx"); xlsxpkg.gravar(partes, f)
    return lo_recalc.recalcular(f)

def hhmm(s):
    h, m = map(int, s.split(":")); return (h * 60 + m) / 1440

def dados_exemplo(mapa):
    """Dados da planilha original, já em minutos, endereçados pelo mapa.json."""
    v = {}
    nomes = "ABCDEFGH"
    tc_s = [52, 69, 73, 61, 55.5, 57, 65, 64]
    est = [91, 155, 189, 95, 111, 76, 99, 83]
    for i in range(8):
        pr = mapa["processos"][i]
        v[pr["nome"]] = f"PROC. {nomes[i]}"
        v[pr["tc"]] = tc_s[i] / 60
        v[pr["estoque"]] = est[i]
    v[mapa["estoque_final"]] = 65
    v[mapa["unidade"]] = "kg"
    pd = mapa["producao"]
    v[pd["demanda"]] = 5000; v[pd["dias_mes"]] = 20; v[pd["disp_familia"]] = 0.6
    t0, t1 = pd["turnos"][0], pd["turnos"][1]
    for i in range(4): v[t0["dias"][i]] = "X"
    v[t1["dias"][4]] = "X"
    for t in (t0, t1):
        v[t["entrada"]] = hhmm("07:30"); v[t["pausa_m"]] = hhmm("00:14")
        v[t["refeicao"]] = hhmm("01:30"); v[t["pausa_t"]] = 0; v[t["saida"]] = hhmm("17:00")
    return v
