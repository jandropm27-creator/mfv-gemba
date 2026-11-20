// Gerado por tools/gerar_sw.py — não editar à mão.
// Guarda todos os arquivos do app para funcionar sem internet; a VERSAO muda quando qualquer arquivo muda.
const VERSAO = 'mfv-gemba-44914ce73c6d';
const ARQUIVOS = [
  './',
  './app.css',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './index.html',
  './js/app.js',
  './js/calculo.js',
  './js/cronoanalise.js',
  './js/db.js',
  './js/modelo.js',
  './js/telas/cabecalho.js',
  './js/telas/cronometro.js',
  './js/telas/fluxos.js',
  './js/telas/gerar.js',
  './js/telas/lista.js',
  './js/telas/painel.js',
  './js/telas/processo.js',
  './js/telas/processos.js',
  './js/telas/producao.js',
  './js/telas/resumo.js',
  './js/ui.js',
  './js/unidades.js',
  './js/xlsx.js',
  './manifest.webmanifest',
  './modelo/MFV_12P.xlsx',
  './modelo/mapa.json',
  './vendor/jszip.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
