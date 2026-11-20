import { taktMin, leadTimeDias, tavMin, tcEfetivoMin, gargalo, pendencias } from '../calculo.js';
import { fmt, h } from '../ui.js';

export default function resumo(el, ctx) {
  ctx.titulo('Resumo');
  const m = ctx.mfv;
  const takt = taktMin(m), g = gargalo(m);
  const tcs = m.processos.map(tcEfetivoMin);
  const escala = Math.max(takt || 0, ...tcs.map((x) => x || 0)) * 1.1 || 1;
  const pend = pendencias(m);
  el.innerHTML = `<div class="kpis">
      <div class="kpi"><b>${fmt(takt)}</b><span>Takt (min/${h(m.cabecalho.unidade || 'unid')})</span></div>
      <div class="kpi"><b>${fmt(leadTimeDias(m), 1)}</b><span>Lead Time (dias)</span></div>
      <div class="kpi"><b>${fmt(tavMin(m))}</b><span>TAV (min)</span></div></div>
    <div class="cartao" style="margin-top:12px"><h2>T/C efetivo × Takt</h2>
      <div class="barras">${m.processos.map((p, i) => `<div class="barra ${i === g && takt && tcs[i] > takt ? 'gargalo' : ''}">
        <span class="nome">${h(p.nome)}</span>
        <div class="trilho"><div class="valor" style="width:${((tcs[i] || 0) / escala) * 100}%"></div>
          ${takt ? `<div class="takt" style="left:${(takt / escala) * 100}%"></div>` : ''}</div>
        <span>${fmt(tcs[i])}</span></div>`).join('') || '<p class="sutil">Nenhum processo cadastrado.</p>'}</div>
      ${g >= 0 ? `<p class="sutil">Maior T/C: <b>${h(m.processos[g].nome)}</b>${takt && tcs[g] > takt ? ' — acima do Takt (gargalo).' : '.'}</p>` : ''}
    </div>
    <div class="cartao"><h2>Pendências</h2>${pend.length ? `<ul class="pend">${pend.map((x) => `<li>${h(x)}</li>`).join('')}</ul>` : '<p class="status ok">Nenhuma pendência.</p>'}</div>`;
}
