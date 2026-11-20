import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import xlsxpkg, inserir
from tests.helpers import *

class TestInserir(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p = inserir.inserir_colunas(xlsxpkg.ler(ORIG), ABA, DESENHO, GRAFICO, 56, 24)

    def test_celulas_deslocadas(self):
        self.assertEqual(valor(self.p, "CE33"), "EXPEDIÇÃO")
        self.assertEqual(valor(self.p, "CB37"), "65")
        self.assertIsNone(valor(self.p, "BD37"))
        self.assertEqual(valor(self.p, "BB37"), "64")  # antes da inserção, não muda

    def test_formulas(self):
        self.assertEqual(formula(self.p, "CB43"), "=((CB37)/($CG$15/21))")
        self.assertIn("CB43", formula(self.p, "CF43"))
        self.assertEqual(formula(self.p, "H43"), "=((H37)/($CG$15/21))")

    def test_formulas_compartilhadas_expandidas(self):
        self.assertNotIn(b't="shared"', self.p[ABA])
        self.assertEqual(formula(self.p, "BC45"), "=BC37")
        self.assertEqual(formula(self.p, "C60"), "=C59")

    def test_merges(self):
        m = merges(self.p)
        self.assertIn("CB37:CC37", m)
        self.assertNotIn("BD37:BE37", m)
        self.assertIn("CM46:DC46", m)  # BO46:CE46 deslocado

    def test_desenho(self):
        a = ancoras(self.p)
        pics55 = [x for x in a if x["tipo"] == "pic" and x["col"] == 79]
        self.assertEqual(len(pics55), 1)
        self.assertFalse([x for x in a if x["tipo"] == "pic" and x["col"] == 55])
        cli = [x for x in a if "Distribuidores" in x["texto"]][0]
        self.assertEqual(cli["col"], 83)

    def test_grafico_coluna_a_inalterada(self):
        self.assertIn(b"$A$52:$A$59", self.p[GRAFICO])

    def test_larguras(self):
        from lxml import etree
        t = etree.fromstring(self.p[ABA])
        w = {}
        for c in t.find("m:cols", NS):
            for i in range(int(c.get("min")), int(c.get("max")) + 1):
                w[i] = c.get("width")
        self.assertEqual(w[56], w[50]); self.assertEqual(w[79], w[55])

    def test_abre_no_libreoffice(self):
        self.assertTrue(abre_no_libreoffice(self.p))

if __name__ == "__main__":
    unittest.main()
