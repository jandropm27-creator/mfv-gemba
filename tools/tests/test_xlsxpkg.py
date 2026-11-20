import os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import xlsxpkg
ORIG = os.path.join(os.path.dirname(__file__), "..", "..", "modelo", "MFV_ME_EPP_original.xlsx")

class TestPacote(unittest.TestCase):
    def test_roundtrip(self):
        p = xlsxpkg.ler(ORIG)
        self.assertIn("xl/worksheets/sheet1.xml", p)
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "x.xlsx")
            xlsxpkg.gravar(p, out)
            p2 = xlsxpkg.ler(out)
        self.assertEqual(list(p2), list(p))
        self.assertEqual(list(p2)[0], "[Content_Types].xml")
        for k in p:
            self.assertEqual(p[k], p2[k])

if __name__ == "__main__":
    unittest.main()
