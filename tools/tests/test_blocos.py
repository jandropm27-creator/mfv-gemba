import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import xlsxpkg, inserir, blocos
from tests.helpers import *

class TestBlocos(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        p = inserir.inserir_colunas(xlsxpkg.ler(ORIG), ABA, DESENHO, GRAFICO, 56, 24)
        cls.p = blocos.replicar_blocos(p)

    def test_rotulos(self):
        self.assertEqual(valor(self.p, "BA33"), "PROC. H")
        self.assertEqual(valor(self.p, "BG33"), "PROC. I")
        self.assertEqual(valor(self.p, "BS33"), "PROC. K")
        self.assertEqual(valor(self.p, "BY33"), "PROC. L")

    def test_estilo_copiado(self):
        self.assertEqual(celula(self.p, "BZ37").get("s"), celula(self.p, "BB37").get("s"))
        self.assertEqual(celula(self.p, "BZ43").get("s"), celula(self.p, "BB43").get("s"))

    def test_formulas_transladadas(self):
        # Lead time do estoque antes do bloco 8 (col BD) — copiado de AX43
        self.assertEqual(formula(self.p, "BD43"), "=((BD37)/($CG$15/21))")
        self.assertEqual(formula(self.p, "BH45"), "=BH37")  # T/C na linha do TAV (bloco 8: col 60)

    def test_merges(self):
        m = merges(self.p)
        for r in ("BD37:BE37", "BV37:BW37", "BV43:BW43"):
            self.assertIn(r, m)

    def test_imagens(self):
        a = [x for x in ancoras(self.p) if x["tipo"] == "pic"]
        caixas = sorted(x["col"] for x in a if x["row"] == 33)
        triang = sorted(x["col"] for x in a if x["row"] == 32)
        self.assertEqual(caixas, [10 + 6 * k for k in range(12)])
        self.assertEqual(triang, [7 + 6 * k for k in range(12)] + [79])
        from lxml import etree
        ids = [n.get("id") for n in etree.fromstring(self.p[DESENHO]).iter(f"{{{NS['xdr']}}}cNvPr")]
        self.assertEqual(len(ids), len(set(ids)))

    def test_tabela_e_grafico(self):
        self.assertEqual(formula(self.p, "A63"), "=BY33")
        self.assertEqual(formula(self.p, "B63"), "=BZ37")
        self.assertIn(b"$A$52:$A$63", self.p[GRAFICO])
        self.assertIn(b"$B$52:$B$63", self.p[GRAFICO])
        self.assertIn(b"$C$52:$C$63", self.p[GRAFICO])

    def test_abre_no_libreoffice(self):
        self.assertTrue(abre_no_libreoffice(self.p))

if __name__ == "__main__":
    unittest.main()
