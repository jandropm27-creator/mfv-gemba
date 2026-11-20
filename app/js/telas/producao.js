import { campo, ligar, numTxt, fmt, h } from '../ui.js';
import { novoTurno } from '../modelo.js';
import { horasDia, taktMin } from '../calculo.js';
import { numero } from '../unidades.js';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HORAS = [['entrada', 'Entrada'], ['pausaM', 'Pausa manhã'], ['refeicao', 'Refeição'], ['pausaT', 'Pausa tarde'], ['saida', 'Saída']];

export default function producao(el, ctx) {
  ctx.titulo('Dados de produção');
  const m = ctx.mfv, p = m.producao;
  const kpis = () => {
    const dd = numero(p.demandaMensal) && numero(p.diasMes) ? p.demandaMensal / p.diasMes : null;
    el.querySelector('#kpis').innerHTML = `
      <div class="kpi"><b>${fmt(horasDia(p.turnos))}</b><span>horas/dia</span></div>
      <div class="kpi"><b>${fmt(dd, 1)}</b><span>${h(m.cabecalho.unidade || 'unid')}/dia</span></div>
      <div class="kpi"><b>${fmt(taktMin(m))}</b><span>Takt (min/${h(m.cabecalho.unidade || 'unid')})</span></div>`;
  };
  const turnos = p.turnos.map((t, i) => `<div class="cartao"><h2>Turno ${i + 1}</h2>
    <div class="dias">${DIAS.map((d, j) => `<label><input type="checkbox" data-t="${i}" data-d="${j}" ${t.dias[j] ? 'checked' : ''} aria-label="${d}">${d}</label>`).join('')}</div>
    ${HORAS.map(([k, r]) => {
      const duracao = k !== 'entrada' && k !== 'saida';
      const rot = p.turnos.length === 1 ? r : `${r} (turno ${i + 1})`;
      return duracao
        ? campo(`${rot}`, t[k], { id: `t${i}-${k}`, dica: 'Duração em hh:mm (ex.: 00:15)', attrs: 'inputmode="numeric" placeholder="00:00" pattern="[0-9]{1,2}:[0-9]{2}"' })
        : campo(rot, t[k], { id: `t${i}-${k}`, tipo: 'time' });
    }).join('')}
    ${p.turnos.length > 1 ? `<button class="perigo largo" data-remover="${i}">Remover turno ${i + 1}</button>` : ''}</div>`).join('');
  el.innerHTML = `<div class="kpis" id="kpis"></div>
    <div class="cartao" style="margin-top:12px">
      ${campo('Demanda mensal', numTxt(p.demandaMensal), { id: 'demanda', decimal: true, dica: `em ${m.cabecalho.unidade || 'unidade do cabeçalho'}` })}
      ${campo('Dias trabalhados no mês', numTxt(p.diasMes), { id: 'dias', decimal: true, dica: 'Ex.: 20, 21, 22 — vale para Takt e Lead Time' })}
      ${campo('Disponibilidade da família (%)', p.dispFamilia === null ? '' : numTxt(Math.round(p.dispFamilia * 10000) / 100), { id: 'disp', decimal: true })}
    </div>${turnos}
    ${p.turnos.length < 3 ? '<button id="add-turno" class="sec largo">Adicionar turno</button>' : ''}`;
  kpis();
  ligar(el, p, { demanda: { prop: 'demandaMensal', tipo: 'num' }, dias: { prop: 'diasMes', tipo: 'num' },
    disp: { prop: 'dispFamilia', tipo: 'pct' } }, ctx.salvar, kpis);
  p.turnos.forEach((t, i) => ligar(el, t, Object.fromEntries(HORAS.map(([k]) => [`t${i}-${k}`, { prop: k }])), ctx.salvar, kpis));
  el.querySelectorAll('[data-d]').forEach((cb) => cb.addEventListener('change', () => {
    p.turnos[cb.dataset.t].dias[cb.dataset.d] = cb.checked; ctx.salvar(); kpis();
  }));
  el.querySelector('#add-turno')?.addEventListener('click', async () => { p.turnos.push(novoTurno()); await ctx.salvar(); ctx.redesenhar(); });
  el.querySelectorAll('[data-remover]').forEach((b) => b.addEventListener('click', async () => {
    p.turnos.splice(Number(b.dataset.remover), 1); await ctx.salvar(); ctx.redesenhar();
  }));
}
