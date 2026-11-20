"""Fórmulas em minutos, nomes definidos, formas nomeadas e mapa.json do modelo de 12 processos."""
import re
from lxml import etree
import refs, blocos
from inserir import NS_M, NS_XDR, NS_A, _xml

L = refs.col_letras
N_PROC = 12
ESTILO_VAZIO = "1"

# Endereços (após inserir 24 colunas em BD)
END = dict(DEMANDA="CG15", UNID_DEMANDA="CH15", DIAS_MES="CN52", DISP_FAMILIA="CT52",
           HORAS_DIA="DC51", MIN_DIA="DB51", SEG_DIA="DA52", SEG_TRAB="CZ52",
           DEMANDA_DIA="CQ52", TAKT="CW52", UNID_TAKT="CX52",
           ESTOQUE_FINAL="CB37", UNID_ESTOQUE="I37",
           RES_TAKT="CF41", RES_LT="CF43", RES_LT_U="CG43", RES_TAV="CF45", RES_TAV_U="CG45")
NOMES = ["DEMANDA", "DIAS_MES", "DISP_FAMILIA", "HORAS_DIA", "DEMANDA_DIA", "TAKT"]
COL_DIAS = ["CM", "CN", "CO", "CP", "CQ", "CR"]                  # S T Q Q S S
COL_HORAS = dict(entrada="CT", pausa_m="CU", refeicao="CV", pausa_t="CW", saida="CX")
LINHAS_TURNO = [48, 49, 50]
CABECALHO = dict(cliente=("A26", "C26", "Cliente:"), produto=("A27", "C27", "Produto/família:"),
                 data=("A28", "C28", "Data:"), consultor=("A29", "C29", "Consultor:"))
FORMAS = [  # (campo em Mfv.fluxos, nome da forma, trecho do texto do exemplo)
    ("fornecedor", "MFV_FORNECEDOR", "Fornecedores"),
    ("entregaFornecedor", "MFV_ENTREGA_FORNECEDOR", "Quarta e sexta"),
    ("pcpSistema", "MFV_PCP_SISTEMA", "MRP+EXCEL"),
    ("previsaoFornecedor", "MFV_PREVISAO_FORNECEDOR", "Previsão 4"),
    ("pedidoFornecedor", "MFV_PEDIDO_FORNECEDOR", "E-mail semanal"),
    ("cliente", "MFV_CLIENTE", "Distribuidores"),
    ("previsaoCliente", "MFV_PREVISAO_CLIENTE", "Previsão 30/60"),
    ("pedidoCliente", "MFV_PEDIDO_CLIENTE", "Pedidos diários"),
    ("entregaCliente", "MFV_ENTREGA_CLIENTE", "1 x semana"),
    ("progProducao", "MFV_PROG_PRODUCAO", "Programação diária"),
    ("progExpedicao", "MFV_PROG_EXPEDICAO", "Programação semanal"),
]


def col_estoque(k): return 8 + 6 * k
def col_nome(k): return 11 + 6 * k
def col_valor(k): return 12 + 6 * k
def col_unid(k): return 13 + 6 * k


def processo(k):
    return dict(nome=f"{L(col_nome(k))}33", operadores=f"{L(col_valor(k))}34",
                tc=f"{L(col_valor(k))}37", tr=f"{L(col_valor(k))}38", disp=f"{L(col_valor(k))}39",
                estoque=f"{L(col_estoque(k))}37", colunas=[col_estoque(k), col_unid(k)])


class Aba:
    def __init__(self, xml):
        self.root = etree.fromstring(xml)
        self.linhas = blocos._linhas(self.root)

    def cel(self, ref):
        r = int(re.sub(r"[A-Z]", "", ref))
        return blocos._celula(self.linhas[r], ref)

    def f(self, ref, formula):
        blocos._formula(self.cel(ref), formula.lstrip("="))

    def txt(self, ref, s):
        blocos._texto(self.cel(ref), s)

    def limpar(self, ref):
        c = self.cel(ref)
        for ch in list(c):
            c.remove(ch)
        c.attrib.pop("t", None)

    def xml(self):
        return _xml(self.root)


def _formulas(a: Aba):
    E = END
    a.limpar(E["DEMANDA"])
    a.f(E["UNID_DEMANDA"], f'IF($I$37="","",$I$37&" /")')
    a.limpar(E["DIAS_MES"]); a.limpar(E["DISP_FAMILIA"])
    for r in LINHAS_TURNO:
        for c in COL_DIAS + list(COL_HORAS.values()):
            a.limpar(f"{c}{r}")
    a.f(E["SEG_TRAB"], 'IF(SUM($CS$48:$CS$50)=0,"",SUM(CZ48:CZ50)/SUM($CS$48:$CS$50))')
    a.f(E["SEG_DIA"], 'IF(SUM($CS$48:$CS$50)=0,"",SUM(DA48:DA50)/SUM($CS$48:$CS$50))')
    a.f(E["MIN_DIA"], f'IF({E["SEG_DIA"]}="","",{E["SEG_DIA"]}/60)')
    a.f(E["HORAS_DIA"], f'IF({E["MIN_DIA"]}="","",{E["MIN_DIA"]}/60)')
    a.f(E["DEMANDA_DIA"], 'IF(OR(DEMANDA="",DIAS_MES="",DIAS_MES=0),"",DEMANDA/DIAS_MES)')
    a.f(E["TAKT"], 'IF(OR(DEMANDA_DIA="",HORAS_DIA="",DISP_FAMILIA=""),"",HORAS_DIA*DISP_FAMILIA*60/DEMANDA_DIA)')
    a.txt(E["UNID_TAKT"], "min/unid")

    lead, tav = [], []
    for k in range(N_PROC + 1):          # k = 12 → estoque final
        s = col_estoque(k) if k < N_PROC else 80
        S = L(s)
        a.limpar(f"{S}37")
        if k > 0:
            a.f(f"{L(s + 2)}37", f'IF({S}37="","",$I$37)')
        a.f(f"{S}43", f'IF(OR({S}37="",DEMANDA_DIA=""),"",{S}37/DEMANDA_DIA)')
        a.f(f"{L(s + 2)}43", f'IF({S}43="","","d")')
        lead.append(f"{S}43")
        if k == N_PROC:
            break
        V, U, Nm = L(col_valor(k)), L(col_unid(k)), L(col_nome(k))
        for r in (33,):
            a.limpar(f"{Nm}{r}")
        for r in (34, 37, 38, 39):
            a.limpar(f"{V}{r}")
        a.f(f"{U}37", f'IF({V}37="","","min")')
        a.f(f"{U}38", f'IF({V}38="","","min")')
        a.f(f"{U}39", f'IF({V}39="","","%")')
        a.f(f"{V}45", f'IF({V}37="","",{V}37)')
        a.f(f"{U}45", f'IF({V}45="","","min")')
        tav.append(f"{V}45")
        r = 52 + k
        a.f(f"A{r}", f'IF({Nm}33="","",{Nm}33)')
        a.f(f"B{r}", f'IF(OR({Nm}33="",{V}37=""),NA(),{V}37)')
        a.f(f"C{r}", f'IF({Nm}33="",NA(),TAKT)')
    a.limpar(E["UNID_ESTOQUE"])
    a.f(E["RES_TAKT"], "TAKT")
    a.f(E["RES_LT"], f"SUM({','.join(lead)})")
    a.txt(E["RES_LT_U"], "d")
    a.f(E["RES_TAV"], f"SUM({','.join(tav)})")
    a.txt(E["RES_TAV_U"], "min")
    for rot, val, texto in CABECALHO.values():
        a.txt(rot, texto); a.limpar(val)
    # Remove valores em cache de todas as fórmulas
    for c in a.root.iter(f"{{{NS_M}}}c"):
        if c.find(f"{{{NS_M}}}f") is not None:
            v = c.find(f"{{{NS_M}}}v")
            if v is not None:
                c.remove(v)
            if c.get("t") in ("str", "e", "b", "n"):
                c.attrib.pop("t")


def _workbook(p):
    wb = etree.fromstring(p["xl/workbook.xml"])
    nome_aba = wb.find(f".//{{{NS_M}}}sheet").get("name")
    dns = wb.find(f"{{{NS_M}}}definedNames")
    if dns is None:
        dns = etree.Element(f"{{{NS_M}}}definedNames")
        wb.find(f"{{{NS_M}}}sheets").addnext(dns)
    for n in NOMES:
        c, r = re.fullmatch(r"([A-Z]+)(\d+)", END[n]).groups()
        el = etree.SubElement(dns, f"{{{NS_M}}}definedName"); el.set("name", n)
        el.text = f"'{nome_aba}'!${c}${r}"
    calc = wb.find(f"{{{NS_M}}}calcPr")
    calc.set("fullCalcOnLoad", "1")
    p["xl/workbook.xml"] = _xml(wb)
    p.pop("xl/calcChain.xml", None)
    for parte, padrao in (("[Content_Types].xml", rb'<Override[^>]*calcChain[^>]*/>'),
                          ("xl/_rels/workbook.xml.rels", rb'<Relationship[^>]*calcChain[^>]*/>')):
        p[parte] = re.sub(padrao, b"", p[parte])


def definir_texto(sp, texto):
    """Primeiro a:r do primeiro a:p recebe o texto; demais runs e parágrafos saem."""
    tx = sp.find(f"{{{NS_XDR}}}txBody")
    ps = tx.findall(f"{{{NS_A}}}p")
    for extra in ps[1:]:
        tx.remove(extra)
    p0 = ps[0]
    runs = p0.findall(f"{{{NS_A}}}r")
    for r in runs[1:]:
        p0.remove(r)
    for br in p0.findall(f"{{{NS_A}}}br"):
        p0.remove(br)
    if runs:
        runs[0].find(f"{{{NS_A}}}t").text = texto
    else:
        r = etree.Element(f"{{{NS_A}}}r"); etree.SubElement(r, f"{{{NS_A}}}t").text = texto
        end = p0.find(f"{{{NS_A}}}endParaRPr")
        (end.addprevious(r) if end is not None else p0.append(r))


def _desenho(p):
    d = etree.fromstring(p["xl/drawings/drawing1.xml"])
    achadas = {}
    for sp in d.iter(f"{{{NS_XDR}}}sp"):
        if sp.find(f"{{{NS_XDR}}}txBody") is None:
            continue
        texto = "".join(t.text or "" for t in sp.iter(f"{{{NS_A}}}t"))
        for campo, nome, trecho in FORMAS:
            if trecho in texto and nome not in achadas:
                sp.find(f"{{{NS_XDR}}}nvSpPr/{{{NS_XDR}}}cNvPr").set("name", nome)
                definir_texto(sp, "")
                achadas[nome] = campo
                break
    faltam = {n for _, n, _ in FORMAS} - set(achadas)
    if faltam:
        raise ValueError(f"Formas não encontradas: {faltam}")
    for anc in d:
        pic = anc.find(f"{{{NS_XDR}}}pic")
        if pic is None:
            continue
        fr = anc.find(f"{{{NS_XDR}}}from")
        col, row = int(fr.find(f"{{{NS_XDR}}}col").text), int(fr.find(f"{{{NS_XDR}}}row").text)
        nome = None
        if row == 33 and (col - 10) % 6 == 0:
            nome = f"MFV_P{(col - 10) // 6 + 1}_CAIXA"
        elif row == 32 and col == 79:
            nome = "MFV_ESTOQUE_FINAL"
        elif row == 32 and (col - 7) % 6 == 0:
            nome = f"MFV_P{(col - 7) // 6 + 1}_ESTOQUE"
        if nome:
            pic.find(f"{{{NS_XDR}}}nvPicPr/{{{NS_XDR}}}cNvPr").set("name", nome)
    p["xl/drawings/drawing1.xml"] = _xml(d)


def _duas_casas(p, a: Aba):
    """Células de T/C e T/R (em minutos) passam a exibir 2 casas decimais (numFmtId 2 = 0.00)."""
    import copy
    st = etree.fromstring(p["xl/styles.xml"])
    xfs = st.find(f"{{{NS_M}}}cellXfs")
    clones = {}
    for k in range(N_PROC):
        for r in (37, 38):
            c = a.cel(f"{L(col_valor(k))}{r}")
            s0 = c.get("s", "0")
            if s0 not in clones:
                novo = copy.deepcopy(xfs.findall(f"{{{NS_M}}}xf")[int(s0)])
                novo.set("numFmtId", "2"); novo.set("applyNumberFormat", "1")
                xfs.append(novo)
                clones[s0] = str(len(xfs) - 1)
            c.set("s", clones[s0])
    xfs.set("count", str(len(xfs)))
    p["xl/styles.xml"] = _xml(st)


def _grafico_sem_cache(p):
    """Remove os pontos em cache do gráfico: visualizadores que não recalculam
    (prévia do WhatsApp/Drive) mostrariam os números do exemplo."""
    NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart"
    g = etree.fromstring(p["xl/charts/chart1.xml"])
    for cache in list(g.iter(f"{{{NS_C}}}numCache")) + list(g.iter(f"{{{NS_C}}}strCache")):
        for pt in cache.findall(f"{{{NS_C}}}pt"):
            cache.remove(pt)
        cnt = cache.find(f"{{{NS_C}}}ptCount")
        if cnt is not None:
            cnt.set("val", "0")
    p["xl/charts/chart1.xml"] = _xml(g)


def aplicar(p):
    p = dict(p)
    _grafico_sem_cache(p)
    a = Aba(p["xl/worksheets/sheet1.xml"])
    _formulas(a)
    _duas_casas(p, a)
    p["xl/worksheets/sheet1.xml"] = a.xml()
    _workbook(p)
    _desenho(p)
    return p


def mapa():
    return {
        "aba": "xl/worksheets/sheet1.xml",
        "desenho": "xl/drawings/drawing1.xml",
        "processos": [processo(k) for k in range(N_PROC)],
        "estoque_final": END["ESTOQUE_FINAL"],
        "unidade": END["UNID_ESTOQUE"],
        "producao": {
            "demanda": END["DEMANDA"], "dias_mes": END["DIAS_MES"], "disp_familia": END["DISP_FAMILIA"],
            "turnos": [dict(dias=[f"{c}{r}" for c in COL_DIAS],
                            **{k: f"{c}{r}" for k, c in COL_HORAS.items()}) for r in LINHAS_TURNO],
        },
        "cabecalho": {k: v[1] for k, v in CABECALHO.items()},
        "formas": {campo: nome for campo, nome, _ in FORMAS},
        "imagens_bloco": {"caixa": "MFV_P{k}_CAIXA", "estoque": "MFV_P{k}_ESTOQUE"},
        "bloco_vazio": {"linhas": [32, 42], "estilo": ESTILO_VAZIO},
    }
