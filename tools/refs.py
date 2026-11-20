"""Conversão de colunas e deslocamento de referências A1 em fórmulas."""
import re


def col_num(letras: str) -> int:
    n = 0
    for ch in letras.upper():
        n = n * 26 + (ord(ch) - 64)
    return n


def col_letras(n: int) -> str:
    s = ""
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


_CELL = r"\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?"
_TOKEN = re.compile(
    r'(?P<str>"[^"]*")'
    r"|(?P<qual>(?:'[^']*'|[A-Za-z_][A-Za-z0-9_.]*)!" + _CELL + ")"
    r"|(?<![A-Za-z0-9_.$])(?P<ref>(?P<d1>\$?)(?P<col>[A-Z]{1,3})(?P<d2>\$?)(?P<row>\d+))(?![A-Za-z0-9_(])"
)


def _mapear(f: str, func) -> str:
    def rep(m):
        if m.group("ref") is None:
            return m.group(0)
        return func(m.group("d1"), m.group("col"), m.group("d2"), m.group("row"))
    return _TOKEN.sub(rep, f)


def deslocar_formula(f: str, a_partir_col: int, n: int) -> str:
    """Soma n a toda referência de coluna >= a_partir_col (absoluta ou relativa)."""
    def func(d1, col, d2, row):
        c = col_num(col)
        if c >= a_partir_col:
            c += n
        return f"{d1}{col_letras(c)}{d2}{row}"
    return _mapear(f, func)


def transladar_formula(f: str, dcol: int) -> str:
    """Move referências com coluna relativa em dcol colunas (como copiar/colar)."""
    def func(d1, col, d2, row):
        c = col_num(col)
        if not d1:
            c += dcol
        return f"{d1}{col_letras(c)}{d2}{row}"
    return _mapear(f, func)
