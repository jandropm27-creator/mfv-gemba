"""Gera app/sw.js com a lista de arquivos do app e versão = hash do conteúdo.

uso: python3 tools/gerar_sw.py   (rodar sempre que alterar arquivos em app/)
"""
import hashlib, os

APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app")


def gerar():
    arqs = sorted(os.path.relpath(os.path.join(d, f), APP).replace(os.sep, "/")
                  for d, _, fs in os.walk(APP) for f in fs if f != "sw.js")
    h = hashlib.sha256()
    for a in arqs:
        h.update(a.encode()); h.update(open(os.path.join(APP, a), "rb").read())
    lista = ",\n  ".join(f"'{x}'" for x in ["./"] + ["./" + a for a in arqs])
    js = f"""// Gerado por tools/gerar_sw.py — não editar à mão.
// Guarda todos os arquivos do app para funcionar sem internet; a VERSAO muda quando qualquer arquivo muda.
const VERSAO = 'mfv-gemba-{h.hexdigest()[:12]}';
const ARQUIVOS = [
  {lista},
];

self.addEventListener('install', (e) => {{
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
}});

self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
}});

self.addEventListener('fetch', (e) => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, {{ ignoreSearch: true }}).then((r) => r || fetch(e.request)));
}});
"""
    with open(os.path.join(APP, "sw.js"), "w", encoding="utf-8") as f:
        f.write(js)
    return h.hexdigest()[:12]


if __name__ == "__main__":
    print("sw.js versão", gerar())
