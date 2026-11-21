import json, os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import xlsxpkg, construir_modelo, refs
from tests.helpers import *
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "tests")))
import lo_recalc

class TestModelo(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp()
        construir_modelo.construir(ORIG, cls.dir)
        cls.p = xlsxpkg.ler(os.path.join(cls.dir, "MFV_12P.xlsx"))
        with open(os.path.join(cls.dir, "mapa.json"), encoding="utf-8") as fh: cls.mapa = json.load(fh)
        cheio = preencher(cls.p, dados_exemplo(cls.mapa))
        cls.recalc = lo_recalc.valores_da_aba(recalcular_partes(cheio))

    def test_mapa(self):
        pr = self.mapa["processos"]
        self.assertEqual(len(pr), 12)
        self.assertEqual(pr[11]["nome"], refs.col_letras(11 + 6 * 11) + "33")
        self.assertEqual(pr[0], {"nome": "K33", "operadores": "L34", "tc": "L37", "tr": "L38",
                                 "disp": "L39", "estoque": "H37", "colunas": [8, 13]})
        self.assertEqual(self.mapa["estoque_final"], "CB37")
        self.assertEqual(self.mapa["unidade"], "I37")
        self.assertEqual(self.mapa["producao"]["dias_mes"], "CN52")
        self.assertEqual(len(self.mapa["formas"]), 11)
        self.assertEqual(set(self.mapa["cabecalho"]), {"cliente", "produto", "data", "consultor"})

    def test_formas_e_imagens_nomeadas(self):
        nomes = {n for a in ancoras(self.p) for n in a["nomes"]}
        for f in self.mapa["formas"].values():
            self.assertIn(f, nomes)
        for k in range(1, 13):
            self.assertIn(f"MFV_P{k}_CAIXA", nomes); self.assertIn(f"MFV_P{k}_ESTOQUE", nomes)
        self.assertIn("MFV_ESTOQUE_FINAL", nomes)
        self.assertIn(b"CONTROLE DE PRODU", self.p[DESENHO])

    def test_sem_texto_do_exemplo(self):
        d = self.p[DESENHO].decode("utf-8")
        for t in ("Fardos", "Distribuidores", "MRP", "semanal", "Quarta", "Previs", "Pedidos", "1 x"):
            self.assertNotIn(t, d)

    def test_modelo_em_branco(self):
        self.assertIsNone(valor(self.p, "L37"))
        self.assertIsNone(valor(self.p, "H37"))
        self.assertIsNone(valor(self.p, self.mapa["producao"]["demanda"]))

    def test_calc(self):
        wb = self.p["xl/workbook.xml"]
        self.assertIn(b'fullCalcOnLoad="1"', wb)
        self.assertNotIn("xl/calcChain.xml", self.p)
        self.assertNotIn(b"calcChain", self.p["[Content_Types].xml"])
        self.assertNotIn(b"calcChain", self.p["xl/_rels/workbook.xml.rels"])
        for n in (b"DEMANDA", b"DIAS_MES", b"DISP_FAMILIA", b"HORAS_DIA", b"DEMANDA_DIA", b"TAKT"):
            self.assertIn(b'name="' + n + b'"', wb)

    def test_unidades_em_minutos(self):
        self.assertEqual(self.recalc["M37"], "min")
        self.assertEqual(self.recalc["AW37"], "min")
        self.assertEqual(self.recalc["CX52"], "min/kg")    # unidade do cabeçalho
        self.assertEqual(self.recalc["CR52"], "kg/d")      # unidade da demanda diária

    def test_sem_metadados_pessoais(self):
        core = self.p["docProps/core.xml"].decode("utf-8")
        for t in ("Rodrigo", "Paulo", "Lima"):
            self.assertNotIn(t, core)
        self.assertNotIn(b"absPath", self.p["xl/workbook.xml"])
        self.assertNotIn(b"Users", self.p["xl/workbook.xml"])

    def test_turno_noturno(self):
        d = dados_exemplo(self.mapa)
        t0 = self.mapa["producao"]["turnos"][0]
        d[t0["entrada"]] = hhmm("22:00"); d[t0["saida"]] = hhmm("06:00")
        d[t0["pausa_m"]] = hhmm("00:15"); d[t0["refeicao"]] = hhmm("01:00"); d[t0["pausa_t"]] = hhmm("00:15")
        r = lo_recalc.valores_da_aba(recalcular_partes(preencher(self.p, d)))
        # O Excel dá #NÚM! em HORA() de duração negativa (o LibreOffice não), então exigimos MOD(…;1):
        for lin in (48, 49, 50):
            self.assertTrue(formula(self.p, f"CY{lin}").startswith("=MOD(CX"), f"CY{lin}")
        # turno 1 (seg–qui) noturno = 6,5 h; turno 2 (sex) = 7,7667 h → média por dia-turno
        self.assertAlmostEqual(r["DC51"], (4 * 6.5 + 7.7667) / 5, delta=0.001)
        erros = {k: v for k, v in r.items() if isinstance(v, str) and v.startswith("#")
                 and not (k[:1] in "ABC" and k[1:].isdigit() and 52 <= int(k[1:]) <= 63)}
        self.assertEqual(erros, {})

    def test_grafico_sem_valores_do_exemplo(self):
        g = self.p[GRAFICO].decode("utf-8")
        self.assertNotIn("<c:pt ", g)
        self.assertNotIn("67.10", g)

    def test_takt_em_branco_sem_disponibilidade(self):
        d = dados_exemplo(self.mapa); del d[self.mapa["producao"]["disp_familia"]]
        r = lo_recalc.valores_da_aba(recalcular_partes(preencher(self.p, d)))
        self.assertIsNone(r.get("CW52"))
        self.assertIsNone(r.get("CF41"))

    def _xf(self, ref):
        from lxml import etree
        st = etree.fromstring(self.p["xl/styles.xml"])
        return st.find("m:cellXfs", NS).findall("m:xf", NS)[int(celula(self.p, ref).get("s"))]

    def test_estoques_grandes_cabem_na_celula(self):
        """45.000 m não pode virar ###: formato #,##0 (id 3) e reduzir para caber."""
        for ref in ("H37", "N37", "BV37", "CB37"):   # estoque do bloco k em col 8+6k (k=11 → BV)
            xf = self._xf(ref)
            self.assertEqual(xf.get("numFmtId"), "3", ref)
            al = xf.find("m:alignment", NS)
            self.assertEqual(al.get("shrinkToFit") if al is not None else None, "1", ref)

    def test_rotulos_do_grafico_com_duas_casas(self):
        for ref in ("B52", "C52", "B63", "C63"):
            self.assertEqual(self._xf(ref).get("numFmtId"), "2", ref)
        self.assertIn(b'formatCode="#,##0.00"', self.p[GRAFICO])

    def test_formato_duas_casas_nos_tempos(self):
        from lxml import etree
        st = etree.fromstring(self.p["xl/styles.xml"])
        xfs = st.find("m:cellXfs", NS).findall("m:xf", NS)
        for ref in ("L37", "L38", "BZ37", "BZ38"):
            xf = xfs[int(celula(self.p, ref).get("s"))]
            self.assertEqual(xf.get("numFmtId"), "2", ref)

    def test_resultados_do_exemplo(self):
        r = self.recalc
        self.assertAlmostEqual(r["CW52"], 1.1184, delta=0.0005)   # TAKT
        self.assertAlmostEqual(r["CF41"], 1.1184, delta=0.0005)   # Tkt no resumo
        self.assertAlmostEqual(r["CF43"], 3.856, delta=0.001)     # Lead Time
        self.assertAlmostEqual(r["CF45"], 8.275, delta=0.001)     # TAV
        self.assertAlmostEqual(r["H43"], 91 / 250, delta=0.0001)
        self.assertEqual(r["A52"], "PROC. A")
        self.assertAlmostEqual(r["C52"], 1.1184, delta=0.0005)

    def test_sem_erros_com_blocos_vazios(self):
        """8 processos preenchidos: blocos 9–12 vazios sem #DIV/0!, #VALOR!, #N/D no mapa."""
        linha = lambda k: int("".join(ch for ch in k if ch.isdigit()))
        erros = {k: v for k, v in self.recalc.items()
                 if isinstance(v, str) and v.startswith("#") and linha(k) < 50}
        self.assertEqual(erros, {})
        self.assertIsNone(self.recalc.get("BG33"))   # nome do bloco 9 em branco
        self.assertIsNone(self.recalc.get("BD43"))   # lead time do estoque do bloco 9 em branco
        self.assertIsNone(self.recalc.get("BH45"))   # T/C na linha do TAV do bloco 9 em branco
        self.assertIsNone(self.recalc.get("BI37"))   # unidade do T/C do bloco 9 em branco

if __name__ == "__main__":
    unittest.main()
