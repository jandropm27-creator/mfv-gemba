import { novaTarefa } from '../modelo.js';
import { tcCronometradoMin, tcEfetivoMin, trMin } from '../calculo.js';
import { estatisticas } from '../cronoanalise.js';
import { campo, ligar, numTxt, fmt, h, dicaMapa } from '../ui.js';
import { LIMITE_MAPA } from '../abreviar.js';

const TR_TXT = { cronometrado: 'cronometrado', informado: 'informado pelo cliente', nao_aplica: 'não se aplica' };

export default function processo(el, ctx) {
  const m = ctx.mfv;
  const p = m.processos.find((x) => x.id === ctx.pid);
  if (!p) { location.hash = `${ctx.base}/processos`; return; }
  ctx.titulo(p.nome);
  const un = m.cabecalho.unidade || 'unid';
  const precisaConversao = () => p.unidadeCiclo && p.unidadeCiclo.trim() !== un;
  const resumo = () => {
    el.querySelector('#tc').innerHTML = `
      <div class="kpi"><b>${fmt(tcCronometradoMin(p))}</b><span>T/C cronometrado (min)</span></div>
      <div class="kpi"><b>${fmt(tcEfetivoMin(p))}</b><span>T/C efetivo (min/${h(un)})</span></div>
      <div class="kpi"><b>${fmt(trMin(p))}</b><span>T/R (min)</span></div>`;
    el.querySelector('#conv-box').hidden = !precisaConversao();
  };
  el.innerHTML = `<div class="kpis" id="tc"></div>
    <div class="cartao" style="margin-top:12px"><h2>Tarefas cronometradas</h2>
      <div class="lista">${p.tarefas.map((t) => {
        const e = estatisticas(t.leituras);
        return `<div class="proc"><a class="item" href="${ctx.base}/processo/${p.id}/tarefa/${t.id}">
          <span>${h(t.nome)}<br><small>menor ${fmt(e.minSeg === null ? null : e.minSeg / 60)} min</small></span>
          <small class="status ${e.completa ? 'ok' : 'pend'}">${e.validas}/3</small></a>
          <button class="perigo" data-rem-tarefa="${t.id}" aria-label="Remover tarefa ${h(t.nome)}">✕</button></div>`;
      }).join('') || '<p class="sutil">Cadastre as tarefas na ordem em que o operador executa.</p>'}</div>
      <label for="nova-tarefa">Nova tarefa</label>
      <div class="linha"><input id="nova-tarefa" placeholder="Ex.: Posicionar"><button id="add-tarefa" style="flex:0 0 auto">Adicionar tarefa</button></div>
    </div>
    <nav class="menu"><a href="${ctx.base}/processo/${p.id}/tr">T/R (troca/setup) <small>${TR_TXT[p.tr.modo]} · ${fmt(trMin(p))} min</small></a></nav>
    <div class="cartao">
      ${campo('Nome do processo', p.nome, { id: 'nome' })}
      <div class="linha"><div>${campo('Operadores', numTxt(p.operadores), { id: 'op', decimal: true })}</div>
        <div>${campo('Postos em paralelo', numTxt(p.postosParalelo), { id: 'postos', decimal: true })}</div></div>
      <div class="linha"><div>${campo('Quantidade por ciclo', numTxt(p.qtdPorCiclo), { id: 'qtd', decimal: true })}</div>
        <div>${campo('Unidade do ciclo', p.unidadeCiclo || un, { id: 'unciclo' })}</div></div>
      <div id="conv-box">${campo(`Conversão (${un} por unidade do ciclo)`, numTxt(p.conversao), { id: 'conv', decimal: true, dica: 'Ex.: 0,25 kg por peça' })}</div>
      ${campo('Disponibilidade (%)', numTxt(p.disponibilidade), { id: 'disp', decimal: true })}
      ${campo(`Estoque antes do processo (${un})`, numTxt(p.estoqueAntes), { id: 'est', decimal: true })}
    </div>`;
  resumo();
  ligar(el, p, {
    nome: { prop: 'nome' }, op: { prop: 'operadores', tipo: 'num' }, postos: { prop: 'postosParalelo', tipo: 'num' },
    qtd: { prop: 'qtdPorCiclo', tipo: 'num' }, unciclo: { prop: 'unidadeCiclo' }, conv: { prop: 'conversao', tipo: 'num' },
    disp: { prop: 'disponibilidade', tipo: 'num' }, est: { prop: 'estoqueAntes', tipo: 'num' },
  }, ctx.salvar, () => { if (!precisaConversao()) p.conversao = 1; resumo(); ctx.titulo(p.nome); });
  dicaMapa(el, 'nome', LIMITE_MAPA);
  el.querySelector('#add-tarefa').addEventListener('click', async () => {
    const nome = el.querySelector('#nova-tarefa').value.trim();
    if (!nome) return;
    p.tarefas.push(novaTarefa(nome));
    await ctx.salvar(); ctx.redesenhar();
  });
  el.querySelectorAll('[data-rem-tarefa]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Remover esta tarefa e suas leituras?')) return;
    p.tarefas = p.tarefas.filter((t) => t.id !== b.dataset.remTarefa);
    await ctx.salvar(); ctx.redesenhar();
  }));
}
