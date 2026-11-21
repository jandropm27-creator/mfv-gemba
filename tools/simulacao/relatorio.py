"""Monta o relatório de uma simulação: recalcula a planilha gerada pelo app (LibreOffice),
extrai os indicadores, renderiza o mapa e a aba CRONOANÁLISE e gera um PDF passo a passo.

uso: python3 tools/simulacao/relatorio.py <pasta_da_simulacao>
"""
import glob, json, os, re, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, os.path.join(RAIZ, "tools"))
sys.path.insert(0, os.path.join(RAIZ, "tests"))
import xlsxpkg, lo_recalc  # noqa: E402

M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
A4 = (2480, 3508)
FONTE = sorted(glob.glob("/usr/share/fonts/**/DejaVuSans.ttf", recursive=True))[0]
NEGRITO = sorted(glob.glob("/usr/share/fonts/**/DejaVuSans-Bold.ttf", recursive=True))[0]
F, FB, FT, FG = (ImageFont.truetype(FONTE, 30), ImageFont.truetype(NEGRITO, 40),
                 ImageFont.truetype(NEGRITO, 64), ImageFont.truetype(FONTE, 40))
num = lambda v, c=2: f"{v:,.{c}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def pdf_da_aba(xlsx, pasta, nome_aba, ajuste):
    """Converte só a aba pedida em PDF (as outras ficam ocultas) e devolve o PNG da 1ª página."""
    p = xlsxpkg.ler(xlsx)
    wb = p["xl/workbook.xml"].decode()
    rels = p["xl/_rels/workbook.xml.rels"].decode()
    abas = re.findall(r'<sheet [^>]*?name="([^"]+)"[^>]*?r:id="([^"]+)"[^>]*/>', wb)
    idx = [a[0] for a in abas].index(nome_aba)
    rid = abas[idx][1]
    alvo = "xl/" + re.search(r'Id="%s"[^>]*Target="([^"]+)"' % rid, rels).group(1).replace("/xl/", "").lstrip("/")

    def vis(m):
        tag = re.sub(r'\s*state="[^"]*"', "", m.group(0))
        return tag if f'name="{nome_aba}"' in tag else tag.replace("<sheet ", '<sheet state="hidden" ', 1)
    wb = re.sub(r"<sheet [^>]*/>", vis, wb)
    wb = re.sub(r'activeTab="\d+"', f'activeTab="{idx}"', wb)
    wb = re.sub(r'firstSheet="\d+"', f'firstSheet="{idx}"', wb)
    s = p[alvo].decode()
    s = re.sub(r"<sheetPr[^>]*/>|<sheetPr[^>]*>.*?</sheetPr>", "", s, flags=re.S)
    s = re.sub(r"<pageSetup[^>]*/>", "", s)
    s = re.sub(r"<worksheet([^>]*)>", r'<worksheet\1><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' if ajuste else r"<worksheet\1><sheetPr/>", s, count=1)
    ps = ('<pageSetup paperSize="8" orientation="landscape" fitToWidth="1" fitToHeight="1"/>' if ajuste
          else '<pageSetup paperSize="8" orientation="landscape" scale="38"/>')
    if "<pageMargins" in s:
        s = re.sub(r"(<pageMargins[^>]*/>)", r"\1" + ps, s, count=1)
    else:
        s = s.replace("</worksheet>", '<pageMargins left="0.2" right="0.2" top="0.3" bottom="0.3" header="0" footer="0"/>' + ps + "</worksheet>")
    p[alvo] = s.encode(); p["xl/workbook.xml"] = wb.encode()
    tmp = os.path.join(pasta, f"_{idx}.xlsx")
    xlsxpkg.gravar(p, tmp)
    subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", pasta, tmp], capture_output=True, timeout=240)
    subprocess.run(["pdftoppm", "-r", "260", "-png", "-f", "1", "-l", "1", tmp[:-5] + ".pdf", tmp[:-5]])
    return Image.open(tmp[:-5] + "-1.png").convert("RGB")


def recortar(im, margem=30):
    bb = im.convert("L").point(lambda x: 0 if x > 250 else 255).getbbox()
    return im.crop((max(bb[0] - margem, 0), max(bb[1] - margem, 0), min(bb[2] + margem, im.width), min(bb[3] + margem, im.height)))


def quebrar(d, txt, f, larg):
    linhas, atual = [], ""
    for w in txt.split():
        t = (atual + " " + w).strip()
        if d.textlength(t, font=f) > larg and atual:
            linhas.append(atual); atual = w
        else:
            atual = t
    return linhas + [atual]


def pagina_telas(itens, pasta):
    pg = Image.new("RGB", A4, "white"); d = ImageDraw.Draw(pg)
    larg = (A4[0] - 120) // 4
    for i, it in enumerate(itens):
        x0 = 60 + i * larg
        y = 70
        for l in quebrar(d, it["titulo"], FB, larg - 40):
            d.text((x0 + 10, y), l, font=FB, fill="#1f4e79"); y += 52
        y += 8
        for l in quebrar(d, it["texto"], F, larg - 40):
            d.text((x0 + 10, y), l, font=F, fill="#333"); y += 40
        im = Image.open(os.path.join(pasta, it["arq"])).convert("RGB")
        esc = min((larg - 30) / im.width, (A4[1] - y - 80) / im.height)
        im = im.resize((int(im.width * esc), int(im.height * esc)))
        pg.paste(im, (x0 + 10, y + 20))
        d.rectangle([x0 + 10, y + 20, x0 + 10 + im.width, y + 20 + im.height], outline="#cfd6dd", width=3)
    return pg


def pagina_larga(blocos):
    pg = Image.new("RGB", (A4[1], A4[0]), "white"); d = ImageDraw.Draw(pg)
    y = 60
    disponivel = pg.height - 60 - 120 * len(blocos)
    for titulo, texto, im in blocos:
        d.text((60, y), titulo, font=FB, fill="#1f4e79"); y += 56
        d.text((60, y), texto, font=F, fill="#333"); y += 50
        esc = min((pg.width - 120) / im.width, disponivel / len(blocos) / im.height)
        im2 = im.resize((int(im.width * esc), int(im.height * esc)))
        pg.paste(im2, (60, y)); y += im2.height + 50
    return pg


def main(pasta):
    meta = json.load(open(os.path.join(pasta, "legendas.json"), encoding="utf-8"))
    C, xlsx = meta["cenario"], os.path.join(pasta, meta["planilha"])
    rec = lo_recalc.recalcular(xlsx)
    v = lo_recalc.valores_da_aba(rec)
    un = C["cabecalho"]["unidade"]
    procs = [(v.get(f"A{r}"), v.get(f"B{r}")) for r in range(52, 64) if v.get(f"A{r}")]
    takt = v["CW52"]
    garg = max(procs, key=lambda p: p[1] if isinstance(p[1], (int, float)) else -1)
    ind = {"takt": takt, "takt_s": takt * 60, "lt": v["CF43"], "tav": v["CF45"], "un_takt": v.get("CX52"),
           "demanda_dia": v["CQ52"], "horas_dia": v["DC51"], "gargalo": garg[0], "tc_gargalo": garg[1],
           "acima": garg[1] > takt, "erros": sorted(k for k, x in v.items() if isinstance(x, str) and x.startswith("#")
                                                     and not (k[0] in "ABC" and k[1:].isdigit() and 52 <= int(k[1:]) <= 63))}
    json.dump(ind, open(os.path.join(pasta, "indicadores.json"), "w"), ensure_ascii=False, indent=1)

    tmp = tempfile.mkdtemp(prefix="rel_")
    mapa = recortar(pdf_da_aba(rec, tmp, "MFV EP", True))
    # separa o mapa (esquerda) do bloco Dados de produção (direita, fundo verde)
    w, h = mapa.size
    px = mapa.load()
    verde = [x for x in range(w) if sum(1 for y in range(0, h, 5) if px[x, y][1] > px[x, y][2] + 12 and px[x, y][1] > px[x, y][0] + 5 and px[x, y][1] > 200) > 8]
    corte = min(verde) - 20 if verde else w
    mapa_esq, dados = recortar(mapa.crop((0, 0, corte, h))), recortar(mapa.crop((corte, 0, w, int(h * 0.6))))
    crono = recortar(pdf_da_aba(rec, tmp, "CRONOANÁLISE", False))
    mapa_esq.save(os.path.join(pasta, "excel_mapa_mfv.png"))
    dados.save(os.path.join(pasta, "excel_dados_producao.png"))
    crono.save(os.path.join(pasta, "excel_cronoanalise.png"))

    capa = Image.new("RGB", A4, "white"); d = ImageDraw.Draw(capa)
    d.text((160, 360), "Simulação – App MFV Gemba", font=FT, fill="#1f4e79")
    linhas = [
        f"Empresa simulada: {C['cabecalho']['cliente']}",
        f"Setor: {C['titulo']}",
        f"Produto: {C['cabecalho']['produto']}",
        "Dados fictícios, com ordens de grandeza típicas do setor. Coleta feita no app publicado, num celular simulado (Pixel 7).",
        "",
        "Processos: " + " → ".join(p["nome"] for p in C["processos"]),
        f"Demanda: {C['producao']['demanda']} {un}/mês · {C['producao']['dias']} dias · disponibilidade da família {C['producao']['disp']}%",
        "",
        "Resultado (planilha gerada pelo app):",
        f"  • Takt = {num(takt, 3)} min/{un} ({num(takt * 60, 1)} s por {un})",
        f"  • Lead Time = {num(ind['lt'], 1)} dias  (demanda diária {num(ind['demanda_dia'], 0)} {un}/dia)",
        f"  • TAV = {num(ind['tav'], 3)} min/{un}",
        f"  • Maior T/C efetivo: {garg[0]} – {num(garg[1], 3)} min/{un}" + (" — acima do Takt (gargalo)" if ind["acima"] else " — abaixo do Takt"),
        "",
        "Páginas seguintes: telas do celular passo a passo e a planilha gerada, como aparece no Excel.",
    ]
    if meta.get("abreviacoes"):
        linhas += ["", "Abreviação automática no mapa (limite 22 caracteres):"]
        linhas += [f"  • {x['onde']}: “{x['de']}” → “{x['para']}”" for x in meta["abreviacoes"]]
    y = 520
    for l in linhas:
        for ll in (quebrar(d, l, FG, A4[0] - 320) if l else [""]):
            d.text((160, y), ll, font=FG, fill="#222"); y += 62
    paginas = [capa]
    L = meta["legendas"]
    for i in range(0, len(L), 4):
        paginas.append(pagina_telas(L[i:i + 4], pasta))
    paginas.append(pagina_larga([("Resultado no Excel – mapa MFV", "Processos, estoques, fluxos de informação e material, linha do tempo, Takt, Lead Time, TAV e gráfico T/C × Takt.", mapa_esq)]))
    paginas.append(pagina_larga([("Resultado no Excel – Dados de produção", "Turnos, horas/dia, demanda diária e Takt.", dados),
                                 ("Resultado no Excel – aba CRONOANÁLISE", "Todas as leituras, descartes com motivo, confirmações, origem do T/R e T/C efetivo.", crono)]))
    saida = os.path.join(pasta, f"Simulacao_MFV_{C['id']}_passo_a_passo.pdf")
    paginas[0].save(saida, save_all=True, append_images=paginas[1:], resolution=200)
    print(saida, len(paginas), "páginas")
    print(json.dumps(ind, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1])
