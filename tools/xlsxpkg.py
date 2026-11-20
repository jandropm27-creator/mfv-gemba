"""Leitura e gravação de um pacote xlsx como dicionário ordenado {parte: bytes}."""
import zipfile


def ler(caminho: str) -> dict:
    with zipfile.ZipFile(caminho) as z:
        return {i.filename: z.read(i.filename) for i in z.infolist()}


def gravar(partes: dict, caminho: str) -> None:
    nomes = list(partes)
    if "[Content_Types].xml" in nomes:
        nomes.remove("[Content_Types].xml")
        nomes.insert(0, "[Content_Types].xml")
    with zipfile.ZipFile(caminho, "w", zipfile.ZIP_DEFLATED) as z:
        for n in nomes:
            z.writestr(n, partes[n])
