import os, sys, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import refs

class TestRefs(unittest.TestCase):
    def test_col(self):
        self.assertEqual(refs.col_num("BG"), 59)
        self.assertEqual(refs.col_num("A"), 1)
        self.assertEqual(refs.col_letras(83), "CE")
        self.assertEqual(refs.col_letras(26), "Z")

    def test_deslocar(self):
        d = refs.deslocar_formula
        self.assertEqual(d("=((BD37)/($BI$15/21))", 56, 24), "=((CB37)/($CG$15/21))")
        self.assertEqual(d("=SUM(H43,N43,BD43)", 56, 24), "=SUM(H43,N43,CB43)")
        self.assertEqual(d('=IF(A1="BD1";1;0)', 56, 24), '=IF(A1="BD1";1;0)')
        self.assertEqual(d("=SIGLAS!BD1", 56, 24), "=SIGLAS!BD1")
        self.assertEqual(d("='MFV EP'!BD1+BD1", 56, 24), "='MFV EP'!BD1+CB1")
        self.assertEqual(d("=SUM(CB48:CB50)", 56, 24), "=SUM(CZ48:CZ50)")
        self.assertEqual(d("SUM(BD1)", 56, 24), "SUM(CB1)")

    def test_transladar(self):
        t = refs.transladar_formula
        self.assertEqual(t("=((AX37)/($BI$15/21))", 6), "=((BD37)/($BI$15/21))")
        self.assertEqual(t("=AT37", 6), "=AZ37")
        self.assertEqual(t("=$AT37", 6), "=$AT37")
        self.assertEqual(t("=BB37", 1, 8), "=BC45")
        self.assertEqual(t("=B$37+$C5", 0, 2), "=B$37+$C7")

if __name__ == "__main__":
    unittest.main()
