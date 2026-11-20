"""Ponta a ponta: gera a planilha com o app (Node) e recalcula no LibreOffice."""
import os, subprocess, sys, unittest
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lo_recalc


def gerar(fx):
    out = os.path.join(RAIZ, "out", fx + ".xlsx")
    subprocess.run(["node", "tests/unit/gerar_para_lo.mjs", f"tests/fixtures/{fx}.json", out], cwd=RAIZ, check=True)
    return lo_recalc.valores_da_aba(lo_recalc.recalcular(out))


def erros_fora_da_tabela(r):
    """Erros (#...) em qualquer célula, exceto a tabela auxiliar do gráfico A52:C63 (usa NA() de propósito)."""
    def na_tabela(k):
        col = "".join(ch for ch in k if ch.isalpha()); lin = int("".join(ch for ch in k if ch.isdigit()))
        return col in ("A", "B", "C") and 52 <= lin <= 63
    return {k: v for k, v in r.items() if isinstance(v, str) and v.startswith("#") and not na_tabela(k)}


class TestPontaAPonta(unittest.TestCase):
    def test_exemplo(self):
        r = gerar("mfv_exemplo")
        self.assertEqual(erros_fora_da_tabela(r), {})
        self.assertAlmostEqual(r["CW52"], 1.1184, delta=0.0005)
        self.assertAlmostEqual(r["CF43"], 3.856, delta=0.001)
        self.assertAlmostEqual(r["CF45"], 8.275, delta=0.001)

    def test_tres_processos(self):
        r = gerar("mfv_3proc")
        self.assertEqual(erros_fora_da_tabela(r), {})
        self.assertAlmostEqual(r["DC51"], 7.7667, delta=0.001)     # horas/dia (bloco Dados de produção)
        self.assertAlmostEqual(r["CW52"], 1.1184, delta=0.0005)    # Takt
        self.assertEqual(r["CX52"], "min/kg")
        tc = (52 + (69 + 30)) / 60 + 73 / 60     # P2 tem 2 tarefas (69 s + 30 s)
        self.assertAlmostEqual(r["CF45"], tc, delta=0.001)

if __name__ == "__main__":
    unittest.main()
