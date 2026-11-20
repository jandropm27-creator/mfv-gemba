// Indicadores do MFV, em minutos (tempos) e dias (lead time).
import { estatisticas } from './cronoanalise.js';
import { paraMin, hhmmParaMin, numero } from './unidades.js';

export const MAX_PROCESSOS = 12;

export function tcCronometradoMin(p) {
  if (!p.tarefas || !p.tarefas.length) return null;
  let soma = 0;
  for (const t of p.tarefas) {
    const e = estatisticas(t.leituras);
    if (!e.completa) return null;
    soma += e.minSeg;
  }
  return soma / 60;
}

export function tcEfetivoMin(p) {
  const tc = tcCronometradoMin(p);
  if (tc === null) return null;
  const qtd = (numero(p.qtdPorCiclo) || 1) * (numero(p.conversao) || 1);
  return tc / qtd / (numero(p.postosParalelo) || 1);
}

export function trMin(p) {
  const tr = p.tr || {};
  if (tr.modo === 'nao_aplica') return 0;
  if (tr.modo === 'informado') return paraMin(tr.valor, tr.unidade || 'min');
  if (tr.modo === 'cronometrado') {
    const e = estatisticas(tr.leituras);
    return e.completa ? e.minSeg / 60 : null;
  }
  return null;
}

function minutosTurno(t) {
  return hhmmParaMin(t.saida) - hhmmParaMin(t.entrada)
    - hhmmParaMin(t.pausaM) - hhmmParaMin(t.refeicao) - hhmmParaMin(t.pausaT);
}

export function horasDia(turnos = []) {
  let min = 0, dias = 0;
  for (const t of turnos) {
    const d = (t.dias || []).filter(Boolean).length;
    min += minutosTurno(t) * d;
    dias += d;
  }
  return dias ? min / dias / 60 : null;
}

function demandaDia(m) {
  const d = numero(m.producao.demandaMensal), n = numero(m.producao.diasMes);
  return d && n ? d / n : null;
}

export function taktMin(m) {
  const h = horasDia(m.producao.turnos), dd = demandaDia(m);
  const disp = numero(m.producao.dispFamilia);
  if (h === null || dd === null || disp === null) return null;
  return (h * disp * 60) / dd;
}

export function leadTimeDias(m) {
  const dd = demandaDia(m);
  if (dd === null) return null;
  const est = [...m.processos.map((p) => numero(p.estoqueAntes)), numero(m.estoqueFinal)];
  return est.reduce((a, b) => a + (b || 0), 0) / dd;
}

export function tavMin(m) {
  return m.processos.reduce((a, p) => a + (tcEfetivoMin(p) || 0), 0);
}

export function gargalo(m) {
  let idx = -1, max = -Infinity;
  m.processos.forEach((p, i) => {
    const tc = tcEfetivoMin(p);
    if (tc !== null && tc > max) { max = tc; idx = i; }
  });
  return idx;
}

export function podeAdicionarProcesso(m) {
  return m.processos.length < MAX_PROCESSOS;
}

export function pendencias(m) {
  const out = [];
  const c = m.cabecalho || {};
  if (!c.cliente) out.push('Cabeçalho: informe o cliente.');
  if (!c.unidade) out.push('Cabeçalho: informe a unidade da demanda/estoque.');
  const pr = m.producao || {};
  if (numero(pr.demandaMensal) === null) out.push('Produção: informe a demanda mensal.');
  if (numero(pr.diasMes) === null) out.push('Produção: informe os dias trabalhados no mês.');
  if (numero(pr.dispFamilia) === null) out.push('Produção: informe a disponibilidade da família.');
  if (horasDia(pr.turnos) === null) out.push('Produção: marque os dias e horários de ao menos um turno.');
  if (!m.processos.length) out.push('Cadastre ao menos um processo.');
  m.processos.forEach((p) => {
    const nome = p.nome || 'Processo sem nome';
    if (!p.tarefas.length) out.push(`${nome}: cadastre ao menos uma tarefa.`);
    for (const t of p.tarefas) {
      const e = estatisticas(t.leituras);
      if (!e.completa) out.push(`${nome} › ${t.nome}: ${e.validas}/3 leituras.`);
    }
    if (trMin(p) === null) out.push(`${nome}: T/R incompleto.`);
  });
  return out;
}
