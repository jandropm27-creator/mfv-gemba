"""Replica o bloco de processo H nos blocos I–L e estende a tabela do gráfico."""
import copy, re
from lxml import etree
import refs
from inserir import NS_M, NS_XDR, _xml, _split_ref

LARGURA_BLOCO = 6
COL_INICIO_BLOCO = 8          # coluna (1-based) do estoque antes do bloco k=0
LINHA_TABELA = 52             # primeira linha da tabela OP × T/C × TKT
LETRAS = "ABCDEFGHIJKL"


def col_nome(k): return COL_INICIO_BLOCO + 3 + LARGURA_BLOCO * k   # K, Q, W…
def col_valor(k): return col_nome(k) + 1                            # L, R, X…


def _linhas(root):
    return {int(r.get("r")): r for r in root.iter(f"{{{NS_M}}}row")}


def _por_ref(row):
    return {c.get("r"): c for c in row.findall(f"{{{NS_M}}}c")}


def _inserir_celula(row, nova):
    col = _split_ref(nova.get("r"))[0]
    antiga = _por_ref(row).get(nova.get("r"))
    if antiga is not None:
        row.replace(antiga, nova); return
    for i, c in enumerate(row.findall(f"{{{NS_M}}}c")):
        if _split_ref(c.get("r"))[0] > col:
            c.addprevious(nova); return
    row.append(nova)


def _texto(c, s):
    for ch in list(c):
        c.remove(ch)
    c.set("t", "inlineStr")
    is_ = etree.SubElement(c, f"{{{NS_M}}}is")
    etree.SubElement(is_, f"{{{NS_M}}}t").text = s


def _formula(c, f):
    for ch in list(c):
        c.remove(ch)
    c.attrib.pop("t", None)
    etree.SubElement(c, f"{{{NS_M}}}f").text = f


def _celula(row, ref, estilo_de=None):
    c = _por_ref(row).get(ref)
    if c is None:
        c = etree.Element(f"{{{NS_M}}}c"); c.set("r", ref)
        _inserir_celula(row, c)
    if estilo_de is not None and estilo_de.get("s"):
        c.set("s", estilo_de.get("s"))
    return c


def replicar_blocos(partes, origem_k=7, destinos=(8, 9, 10, 11)):
    p = dict(partes)
    aba = etree.fromstring(p["xl/worksheets/sheet1.xml"])
    linhas = _linhas(aba)
    c0 = COL_INICIO_BLOCO + LARGURA_BLOCO * origem_k
    cols_origem = range(c0, c0 + LARGURA_BLOCO)
    merges_el = aba.find(f"{{{NS_M}}}mergeCells")
    merges_origem = []
    for m in merges_el:
        a, b = m.get("ref").split(":")
        if _split_ref(a)[0] in cols_origem:
            merges_origem.append((a, b))

    for k in destinos:
        dcol = LARGURA_BLOCO * (k - origem_k)
        for r, row in linhas.items():
            for c in list(row.findall(f"{{{NS_M}}}c")):
                col, lin = _split_ref(c.get("r"))
                if col not in cols_origem:
                    continue
                nova = copy.deepcopy(c)
                nova.set("r", f"{refs.col_letras(col + dcol)}{lin}")
                f = nova.find(f"{{{NS_M}}}f")
                if f is not None and f.text:
                    f.text = refs.transladar_formula(f.text, dcol)
                v = nova.find(f"{{{NS_M}}}v")
                if f is not None and v is not None:
                    nova.remove(v)
                _inserir_celula(row, nova)
        _texto(_por_ref(linhas[33])[f"{refs.col_letras(col_nome(k))}33"], f"PROC. {LETRAS[k]}")
        for a, b in merges_origem:
            m = etree.SubElement(merges_el, f"{{{NS_M}}}mergeCell")
            sh = lambda x: f"{refs.col_letras(_split_ref(x)[0] + dcol)}{_split_ref(x)[1]}"
            m.set("ref", f"{sh(a)}:{sh(b)}")
    merges_el.set("count", str(len(merges_el)))

    # Tabela OP × T/C × TKT: linhas 52..63 = processos 1..12
    ultima = LINHA_TABELA + 11
    for i in range(12):
        r = LINHA_TABELA + i
        row = linhas[r]
        modelo = _por_ref(linhas[LINHA_TABELA + 7])  # linha do PROC. H
        a = _celula(row, f"A{r}", modelo.get(f"A{LINHA_TABELA + 7}"))
        b = _celula(row, f"B{r}", modelo.get(f"B{LINHA_TABELA + 7}"))
        _formula(a, f"{refs.col_letras(col_nome(i))}33")
        _formula(b, f"{refs.col_letras(col_valor(i))}37")
        if i > 0:
            c = _celula(row, f"C{r}", modelo.get(f"C{LINHA_TABELA + 7}"))
            _formula(c, f"C{r - 1}")
    p["xl/worksheets/sheet1.xml"] = _xml(aba)

    g = p["xl/charts/chart1.xml"].decode("utf-8")
    g = re.sub(r"\$([ABC])\$52:\$\1\$\d+", lambda m: f"${m.group(1)}$52:${m.group(1)}${ultima}", g)
    p["xl/charts/chart1.xml"] = g.encode("utf-8")

    # Imagens: triângulo (row 32) e caixa (row 33) do bloco de origem
    d = etree.fromstring(p["xl/drawings/drawing1.xml"])
    ids = [int(n.get("id")) for n in d.iter(f"{{{NS_XDR}}}cNvPr")]
    prox = max(ids) + 1
    alvo = {(32, c0 - 1), (33, c0 + 2)}
    origem = []
    for anc in d:
        fr = anc.find(f"{{{NS_XDR}}}from")
        if fr is None or anc.find(f"{{{NS_XDR}}}pic") is None:
            continue
        pos = (int(fr.find(f"{{{NS_XDR}}}row").text), int(fr.find(f"{{{NS_XDR}}}col").text))
        if pos in alvo:
            origem.append(anc)
    for k in destinos:
        dcol = LARGURA_BLOCO * (k - origem_k)
        for anc in origem:
            nova = copy.deepcopy(anc)
            col = nova.find(f"{{{NS_XDR}}}from/{{{NS_XDR}}}col")
            col.text = str(int(col.text) + dcol)
            for n in nova.iter(f"{{{NS_XDR}}}cNvPr"):
                n.set("id", str(prox)); prox += 1
            d.append(nova)
    p["xl/drawings/drawing1.xml"] = _xml(d)
    return p
