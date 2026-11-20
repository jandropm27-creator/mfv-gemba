import { pendencias, taktMin, podeAdicionarProcesso, MAX_PROCESSOS } from '../calculo.js';
import { h, fmt } from '../ui.js';

export default function painel(el, ctx) {
  const m = ctx.mfv;
  ctx.titulo(m.cabecalho.cliente || 'Novo MFV');
  const pend = pendencias(m).length;
  const b = ctx.base;
  el.innerHTML = `<nav class="menu">
    <a href="${b}/cabecalho">Cabeçalho <small>${h(m.cabecalho.cliente || 'cliente, produto, data')}</small></a>
    <a href="${b}/producao">Dados de produção <small>Takt ${fmt(taktMin(m))} min</small></a>
    <a href="${b}/fluxos">Fluxos de informação e material <small>fornecedor, cliente, PCP</small></a>
    <a href="${b}/processos">Processos <small>${m.processos.length}/${MAX_PROCESSOS}</small></a>
    <a href="${b}/resumo">Resumo <small>${pend ? `${pend} pendência(s)` : 'sem pendências'}</small></a>
    <a href="${b}/gerar">Gerar planilha <small>.xlsx</small></a></nav>`;
}
