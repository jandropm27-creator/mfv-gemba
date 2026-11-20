"""Inserção de colunas numa aba, ajustando desenho, gráfico e nomes definidos."""
import re
from lxml import etree
import refs

NS_M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart"
EMU_PX = 9525
LINHA_FLUXO_SUPERIOR = 30          # formas acima desta linha formam o fluxo de informação
COL_LADO_CLIENTE = 40              # (0-based) formas do lado do cliente no fluxo superior


def _xml(t) -> bytes:
    return etree.tostring(t, xml_declaration=True, encoding="UTF-8", standalone=True)


def _split_ref(ref):
    m = re.fullmatch(r"([A-Z]+)(\d+)", ref)
    return refs.col_num(m.group(1)), int(m.group(2))


def _shift_ref(ref, a, n):
    c, r = _split_ref(ref)
    return f"{refs.col_letras(c + n if c >= a else c)}{r}"


def _shift_range(rng, a, n):
    return ":".join(_shift_ref(x, a, n) for x in rng.split(":"))


def _shift_sqref(sq, a, n):
    return " ".join(_shift_range(x, a, n) for x in sq.split())


def larguras(aba_root) -> dict:
    """{coluna 1-based: largura em caracteres} a partir de <cols>."""
    w = {}
    cols = aba_root.find(f"{{{NS_M}}}cols")
    if cols is not None:
        for c in cols:
            for i in range(int(c.get("min")), int(c.get("max")) + 1):
                w[i] = float(c.get("width"))
    return w


def largura_emu(w_chars: float) -> int:
    px = int(((256 * w_chars + int(128 / 7)) / 256) * 7)
    return px * EMU_PX


def deslocar_formula_qualificada(f: str, aba_nome: str, a: int, n: int) -> str:
    """Desloca referências qualificadas com o nome da própria aba (ex.: gráficos)."""
    pref = f"'{aba_nome}'!" if " " in aba_nome else f"{aba_nome}!"
    def rep(m):
        return pref + refs.deslocar_formula(m.group(1), a, n)
    return re.sub(re.escape(pref) + r"((?:\$?[A-Z]{1,3}\$?\d+)(?::\$?[A-Z]{1,3}\$?\d+)?)", rep, f)


def expandir_compartilhadas(root) -> None:
    """Converte fórmulas compartilhadas (t="shared") em fórmulas normais por célula."""
    mestres = {}
    for c in root.iter(f"{{{NS_M}}}c"):
        f = c.find(f"{{{NS_M}}}f")
        if f is not None and f.get("t") == "shared" and f.get("ref"):
            mestres[f.get("si")] = (c.get("r"), f.text)
    for c in root.iter(f"{{{NS_M}}}c"):
        f = c.find(f"{{{NS_M}}}f")
        if f is None or f.get("t") != "shared":
            continue
        rm, texto = mestres[f.get("si")]
        cm, lm = _split_ref(rm)
        cc, lc = _split_ref(c.get("r"))
        f.text = refs.transladar_formula(texto, cc - cm, lc - lm)
        for k in ("t", "ref", "si"):
            f.attrib.pop(k, None)


def _aba(root, a, n, origem_larg):
    expandir_compartilhadas(root)
    for c in root.iter(f"{{{NS_M}}}c"):
        c.set("r", _shift_ref(c.get("r"), a, n))
        f = c.find(f"{{{NS_M}}}f")
        if f is not None:
            if f.text:
                f.text = refs.deslocar_formula(f.text, a, n)
            if f.get("ref"):
                f.set("ref", _shift_range(f.get("ref"), a, n))
    for row in root.iter(f"{{{NS_M}}}row"):
        row.attrib.pop("spans", None)
    for m in root.iter(f"{{{NS_M}}}mergeCell"):
        m.set("ref", _shift_range(m.get("ref"), a, n))
    for tag in ("conditionalFormatting", "dataValidation", "selection"):
        for el in root.iter(f"{{{NS_M}}}{tag}"):
            if el.get("sqref"):
                el.set("sqref", _shift_sqref(el.get("sqref"), a, n))
    for el in root.iter(f"{{{NS_M}}}selection"):
        if el.get("activeCell"):
            el.set("activeCell", _shift_ref(el.get("activeCell"), a, n))
    dim = root.find(f"{{{NS_M}}}dimension")
    if dim is not None:
        dim.set("ref", _shift_range(dim.get("ref"), a, n))
    # larguras
    cols = root.find(f"{{{NS_M}}}cols")
    if cols is not None:
        attrs = {}
        for c in cols:
            for i in range(int(c.get("min")), int(c.get("max")) + 1):
                attrs[i] = dict(c.attrib)
        novos = {}
        for i, at in attrs.items():
            novos[i + n if i >= a else i] = at
        for j in range(n):
            novos[a + j] = dict(attrs.get(origem_larg[j % len(origem_larg)], {"width": "8"}))
        for c in list(cols):
            cols.remove(c)
        for i in sorted(novos):
            at = dict(novos[i]); at["min"] = at["max"] = str(i)
            el = etree.SubElement(cols, f"{{{NS_M}}}col")
            for k in ("min", "max"):
                el.set(k, at.pop(k))
            for k, v in at.items():
                el.set(k, v)


def _desenho(root, a0, n, larg_emu_inseridas):
    """a0 = primeira coluna deslocada, 0-based."""
    larg = None
    for anc in root:
        fr = anc.find(f"{{{NS_XDR}}}from")
        if fr is None:
            continue
        col = fr.find(f"{{{NS_XDR}}}col")
        row = int(fr.find(f"{{{NS_XDR}}}row").text)
        c = int(col.text)
        superior = row < LINHA_FLUXO_SUPERIOR
        if c >= a0 or (superior and c >= COL_LADO_CLIENTE):
            col.text = str(c + n)
            to = anc.find(f"{{{NS_XDR}}}to")
            if to is not None:
                tc = to.find(f"{{{NS_XDR}}}col"); tc.text = str(int(tc.text) + n)
    return root


def _cruza(anc, a0, posx):
    """True se a forma começa antes da coluna a0 e termina depois dela."""
    fr = anc.find(f"{{{NS_XDR}}}from")
    c = int(fr.find(f"{{{NS_XDR}}}col").text)
    off = int(fr.find(f"{{{NS_XDR}}}colOff").text)
    ext = anc.find(f"{{{NS_XDR}}}ext")
    if ext is None:
        return False
    x0 = posx(c) + off
    return x0 < posx(a0) < x0 + int(ext.get("cx"))


def _esticar(anc, delta):
    """Estica só o contêiner de topo: num grupo, os filhos escalam proporcionalmente
    (chExt fica igual), preservando o formato de setas em zigue-zague."""
    ext = anc.find(f"{{{NS_XDR}}}ext")
    ext.set("cx", str(int(ext.get("cx")) + delta))
    for topo in anc:
        sp_pr = topo.find(f"{{{NS_XDR}}}grpSpPr")
        if sp_pr is None:
            sp_pr = topo.find(f"{{{NS_XDR}}}spPr")
        if sp_pr is not None:
            x = sp_pr.find(f"{{{NS_A}}}xfrm/{{{NS_A}}}ext")
            if x is not None:
                x.set("cx", str(int(x.get("cx")) + delta))


def inserir_colunas(partes, aba_xml, desenho_xml, grafico_xml, a_partir_col, n):
    p = dict(partes)
    aba = etree.fromstring(p[aba_xml])
    larg_orig = larguras(aba)
    origem = list(range(a_partir_col - 6, a_partir_col))
    padrao = 14.42578125
    posx = lambda c0: sum(largura_emu(larg_orig.get(i, padrao)) for i in range(1, c0 + 1))
    delta = sum(largura_emu(larg_orig.get(origem[j % 6], padrao)) for j in range(n))

    _aba(aba, a_partir_col, n, origem)
    p[aba_xml] = _xml(aba)

    if desenho_xml in p:
        d = etree.fromstring(p[desenho_xml])
        a0 = a_partir_col - 1
        cruzam = [anc for anc in d if _cruza(anc, a0, posx)
                  and int(anc.find(f"{{{NS_XDR}}}from/{{{NS_XDR}}}row").text) < LINHA_FLUXO_SUPERIOR
                  and int(anc.find(f"{{{NS_XDR}}}from/{{{NS_XDR}}}col").text) < COL_LADO_CLIENTE]
        _desenho(d, a0, n, delta)
        for anc in cruzam:
            _esticar(anc, delta)
        p[desenho_xml] = _xml(d)

    wb = etree.fromstring(p["xl/workbook.xml"])
    nomes = {s.get("name") for s in wb.iter(f"{{{NS_M}}}sheet")}
    aba_nome = [s.get("name") for s in wb.iter(f"{{{NS_M}}}sheet")][0]
    for dn in wb.iter(f"{{{NS_M}}}definedName"):
        dn.text = deslocar_formula_qualificada(dn.text, aba_nome, a_partir_col, n)
    p["xl/workbook.xml"] = _xml(wb)

    if grafico_xml in p:
        g = etree.fromstring(p[grafico_xml])
        for f in g.iter(f"{{{NS_C}}}f"):
            f.text = deslocar_formula_qualificada(f.text, aba_nome, a_partir_col, n)
        p[grafico_xml] = _xml(g)
    return p
