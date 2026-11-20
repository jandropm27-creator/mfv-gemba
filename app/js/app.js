// Roteador por hash e estado do MFV aberto.
import * as db from './db.js';
import lista from './telas/lista.js';
import painel from './telas/painel.js';
import cabecalho from './telas/cabecalho.js';
import producao from './telas/producao.js';
import fluxos from './telas/fluxos.js';
import processos from './telas/processos.js';
import processo from './telas/processo.js';
import cronometro from './telas/cronometro.js';
import resumo from './telas/resumo.js';
import gerar from './telas/gerar.js';

const rotas = [
  [/^#\/$/, lista],
  [/^#\/mfv\/([^/]+)$/, painel],
  [/^#\/mfv\/([^/]+)\/cabecalho$/, cabecalho],
  [/^#\/mfv\/([^/]+)\/producao$/, producao],
  [/^#\/mfv\/([^/]+)\/fluxos$/, fluxos],
  [/^#\/mfv\/([^/]+)\/processos$/, processos],
  [/^#\/mfv\/([^/]+)\/processo\/([^/]+)$/, processo],
  [/^#\/mfv\/([^/]+)\/processo\/([^/]+)\/tarefa\/([^/]+)$/, cronometro],
  [/^#\/mfv\/([^/]+)\/processo\/([^/]+)\/tr$/, cronometro],
  [/^#\/mfv\/([^/]+)\/resumo$/, resumo],
  [/^#\/mfv\/([^/]+)\/gerar$/, gerar],
];

let limpeza = null;

export function pai(hash) {
  let m;
  if ((m = hash.match(/^(#\/mfv\/[^/]+\/processo\/[^/]+)\/(tarefa\/[^/]+|tr)$/))) return m[1];
  if ((m = hash.match(/^(#\/mfv\/[^/]+)\/processo\/[^/]+$/))) return `${m[1]}/processos`;
  if ((m = hash.match(/^(#\/mfv\/[^/]+)\/[a-z]+$/))) return m[1];
  return '#/';
}

async function rotear() {
  const hash = location.hash || '#/';
  limpeza?.(); limpeza = null;
  const el = document.getElementById('tela');
  const voltar = document.getElementById('voltar');
  for (const [re, tela] of rotas) {
    const m = hash.match(re);
    if (!m) continue;
    const [, id, pid, tid] = m;
    let mfv = null;
    if (id) {
      mfv = await db.obter(id);
      if (!mfv) { location.hash = '#/'; return; }
    }
    voltar.hidden = hash === '#/';
    voltar.href = pai(hash);
    const ctx = {
      mfv, pid, tid, tr: hash.endsWith('/tr'), base: id ? `#/mfv/${id}` : '#/',
      salvar: () => db.salvar(mfv),
      titulo: (t) => { document.getElementById('titulo').textContent = t; },
      redesenhar: () => rotear(),
      aoSair: (fn) => { limpeza = fn; },
    };
    el.innerHTML = '';
    await tela(el, ctx);
    window.scrollTo(0, 0);
    return;
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', rotear);
rotear();

// Pede ao navegador para não apagar os dados locais (coletas) por falta de espaço ou inatividade.
navigator.storage?.persist?.().catch(() => {});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
