import { novoProcesso } from '../modelo.js';
import { tcEfetivoMin, pendencias, MAX_PROCESSOS, podeAdicionarProcesso } from '../calculo.js';
import { estatisticas } from '../cronoanalise.js';
import { campo, ligar, numTxt, fmt, h } from '../ui.js';

function completo(p) {
  return p.tarefas.length && p.tarefas.every((t) => estatisticas(t.leituras).completa);
}

export default function processos(el, ctx) {
  ctx.titulo('Processos');
  const m = ctx.mfv;
  const cheio = !podeAdicionarProcesso(m);
  el.innerHTML = `
    <div class="lista">${m.processos.map((p, i) => `<div class="proc">
      <div class="ordem" style="flex-direction:column">
        <button class="sec" data-subir="${i}" aria-label="Subir ${h(p.nome)}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="sec" data-descer="${i}" aria-label="Descer ${h(p.nome)}" ${i === m.processos.length - 1 ? 'disabled' : ''}>↓</button></div>
      <a class="item" href="${ctx.base}/processo/${p.id}"><span>${i + 1}. ${h(p.nome)}<br><small>T/C ${fmt(tcEfetivoMin(p))} min</small></span>
        <small class="status ${completo(p) ? 'ok' : 'pend'}">${completo(p) ? 'Completo' : 'Pendente'}</small></a>
      <button class="perigo" data-remover="${i}" aria-label="Remover ${h(p.nome)}">✕</button></div>`).join('')}</div>
    ${cheio ? `<div class="aviso">Máximo de ${MAX_PROCESSOS} processos. Acima disso, tratar fora do app.</div>` : ''}
    <button id="add" class="largo" ${cheio ? 'disabled' : ''}>Adicionar processo</button>
    <div class="cartao" style="margin-top:16px">
      ${campo(`Estoque antes da expedição (${m.cabecalho.unidade || 'unid'})`, numTxt(m.estoqueFinal), { id: 'est-final', decimal: true })}</div>`;
  ligar(el, m, { 'est-final': { prop: 'estoqueFinal', tipo: 'num' } }, ctx.salvar);
  el.querySelector('#add').addEventListener('click', async () => {
    if (!podeAdicionarProcesso(m)) return;
    m.processos.push(novoProcesso(m.processos.length));
    await ctx.salvar(); ctx.redesenhar();
  });
  const mover = async (i, d) => {
    const [p] = m.processos.splice(i, 1); m.processos.splice(i + d, 0, p);
    await ctx.salvar(); ctx.redesenhar();
  };
  el.querySelectorAll('[data-subir]').forEach((b) => b.addEventListener('click', () => mover(Number(b.dataset.subir), -1)));
  el.querySelectorAll('[data-descer]').forEach((b) => b.addEventListener('click', () => mover(Number(b.dataset.descer), 1)));
  el.querySelectorAll('[data-remover]').forEach((b) => b.addEventListener('click', async () => {
    const i = Number(b.dataset.remover);
    if (!confirm(`Remover ${m.processos[i].nome} e todas as suas leituras?`)) return;
    m.processos.splice(i, 1);
    await ctx.salvar(); ctx.redesenhar();
  }));
}
