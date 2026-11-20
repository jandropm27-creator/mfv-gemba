"""Constrói o modelo de 12 processos a partir da planilha original.

uso: python3 tools/construir_modelo.py modelo/MFV_ME_EPP_original.xlsx app/modelo/
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import xlsxpkg, inserir, blocos, formulas

ABA, DESENHO, GRAFICO = "xl/worksheets/sheet1.xml", "xl/drawings/drawing1.xml", "xl/charts/chart1.xml"


def construir(origem: str, destino: str) -> None:
    p = xlsxpkg.ler(origem)
    p = inserir.inserir_colunas(p, ABA, DESENHO, GRAFICO, 56, 24)
    p = blocos.replicar_blocos(p)
    p = formulas.aplicar(p)
    os.makedirs(destino, exist_ok=True)
    xlsxpkg.gravar(p, os.path.join(destino, "MFV_12P.xlsx"))
    with open(os.path.join(destino, "mapa.json"), "w", encoding="utf-8") as f:
        json.dump(formulas.mapa(), f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    construir(sys.argv[1], sys.argv[2])
    print("ok:", sys.argv[2])
