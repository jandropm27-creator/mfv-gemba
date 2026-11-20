"""Recalcula um .xlsx no LibreOffice headless (recálculo forçado ao abrir) e lê valores.

uso: python3 tests/lo_recalc.py entrada.xlsx  -> imprime caminho do arquivo recalculado
"""
import os, subprocess, sys, tempfile

PERFIL = os.path.join(tempfile.gettempdir(), "mfv_lo_perfil")
XCU = """<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop></item>
<item oor:path="/org.openoffice.Office.Calc/Formula/Load"><prop oor:name="ODFRecalcMode" oor:op="fuse"><value>0</value></prop></item>
</oor:items>"""


def _perfil():
    d = os.path.join(PERFIL, "user")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "registrymodifications.xcu"), "w") as f:
        f.write(XCU)
    return "file://" + PERFIL


def recalcular(xlsx: str) -> str:
    out = tempfile.mkdtemp(prefix="lo_")
    base = os.path.join(out, "entrada.xlsx")
    with open(xlsx, "rb") as a, open(base, "wb") as b:
        b.write(a.read())
    saida = os.path.join(out, "saida")
    os.makedirs(saida)
    subprocess.run(["soffice", f"-env:UserInstallation={_perfil()}", "--headless",
                    "--convert-to", "xlsx:Calc MS Excel 2007 XML", "--outdir", saida, base],
                   check=True, capture_output=True, timeout=240)
    return os.path.join(saida, "entrada.xlsx")


def ler_valores(xlsx: str, refs, aba="MFV EP"):
    import openpyxl
    ws = openpyxl.load_workbook(xlsx, data_only=True)[aba]
    return {r: ws[r].value for r in refs}


def valores_da_aba(xlsx: str, aba="MFV EP"):
    import openpyxl
    ws = openpyxl.load_workbook(xlsx, data_only=True)[aba]
    return {c.coordinate: c.value for row in ws.iter_rows() for c in row if c.value is not None}


if __name__ == "__main__":
    print(recalcular(sys.argv[1]))
