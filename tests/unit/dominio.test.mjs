import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { paraMin, hhmmParaMin } from '../../app/js/unidades.js';
import { estatisticas } from '../../app/js/cronoanalise.js';
import * as calc from '../../app/js/calculo.js';

const fx = (n) => JSON.parse(readFileSync(new URL(`../fixtures/${n}.json`, import.meta.url)));
const L = (seg, descartada = false) => ({ seg, descartada, motivo: '', confirmada: false, motivoConfirmacao: '' });
const perto = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('paraMin converte seg/min/h e aceita vírgula decimal', () => {
  assert.equal(paraMin('0,33', 'h'), 19.8);
  perto(paraMin(52, 'seg'), 0.8667);
  assert.equal(paraMin('12', 'min'), 12);
  assert.equal(paraMin('', 'min'), null);
  assert.equal(paraMin('abc', 'min'), null);
});

test('hhmmParaMin', () => {
  assert.equal(hhmmParaMin('07:30'), 450);
  assert.equal(hhmmParaMin(''), 0);
  assert.equal(hhmmParaMin('15'), 15);     // número sem ":" em duração = minutos
  assert.equal(hhmmParaMin('1:30'), 90);
});

test('estatísticas: menor leitura válida, completa com 3', () => {
  const e = estatisticas([L(60), L(62), L(70)]);
  assert.equal(e.minSeg, 60); assert.equal(e.maxSeg, 70); assert.equal(e.validas, 3);
  assert.equal(e.completa, true); assert.equal(e.discrepante, false);
  assert.equal(estatisticas([L(60), L(62)]).completa, false);
});

test('leitura descartada não conta', () => {
  const e = estatisticas([L(10, true), L(60), L(62), L(70)]);
  assert.equal(e.minSeg, 60); assert.equal(e.validas, 3);
});

test('discrepância: menor > 20% abaixo da média', () => {
  assert.equal(estatisticas([L(40), L(62), L(70)]).discrepante, true);
  assert.equal(estatisticas([L(50), L(62), L(70)]).discrepante, false);
});

test('T/C do processo = soma dos menores tempos das tarefas', () => {
  const p = { tarefas: [
    { leituras: [L(0.28 * 60), L(20), L(21)] },
    { leituras: [L(0.69 * 60), L(45), L(46)] },
    { leituras: [L(0.38 * 60), L(25), L(26)] }], qtdPorCiclo: 1, conversao: 1, postosParalelo: 1 };
  perto(calc.tcCronometradoMin(p), 1.35);
  p.tarefas[2].leituras.pop();
  assert.equal(calc.tcCronometradoMin(p), null);
  assert.equal(calc.tcCronometradoMin({ tarefas: [] }), null);
});

test('T/C efetivo divide por qtd/ciclo × conversão e postos paralelos', () => {
  const p = { tarefas: [{ leituras: [L(144), L(150), L(160)] }], qtdPorCiclo: 2, conversao: 1, postosParalelo: 2 };
  perto(calc.tcEfetivoMin(p), 0.6);
});

test('T/R por modo', () => {
  assert.equal(calc.trMin({ tr: { modo: 'nao_aplica' } }), 0);
  assert.equal(calc.trMin({ tr: { modo: 'informado', valor: 0.5, unidade: 'h' } }), 30);
  assert.equal(calc.trMin({ tr: { modo: 'cronometrado', leituras: [L(600), L(540), L(660)] } }), 9);
  assert.equal(calc.trMin({ tr: { modo: 'cronometrado', leituras: [L(600)] } }), null);
});

test('indicadores do exemplo batem com a planilha', () => {
  const m = fx('mfv_exemplo');
  perto(calc.horasDia(m.producao.turnos), 7.7667);
  perto(calc.taktMin(m), 1.1184);
  perto(calc.leadTimeDias(m), 3.856);
  perto(calc.tavMin(m), 8.275, 1e-3);
  assert.equal(calc.gargalo(m), 2);
});

test('pendências apontam tarefa com menos de 3 leituras', () => {
  const m = fx('mfv_exemplo');
  m.processos[1].tarefas[0].leituras.pop();
  const p = calc.pendencias(m);
  assert.ok(p.some((x) => x.includes('Dobra') && x.includes('2/3')), p.join('\n'));
  assert.deepEqual(calc.pendencias(fx('mfv_exemplo')), []);
});

test('máximo de 12 processos', () => {
  const m = fx('mfv_exemplo');
  assert.equal(calc.podeAdicionarProcesso(m), true);
  while (m.processos.length < 12) m.processos.push({ ...m.processos[0] });
  assert.equal(calc.podeAdicionarProcesso(m), false);
});
