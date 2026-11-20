import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as modelo from '../../app/js/modelo.js';

test('novoProcesso nomeia por letra', () => {
  assert.equal(modelo.novoProcesso(0).nome, 'PROC. A');
  assert.equal(modelo.novoProcesso(11).nome, 'PROC. L');
  const p = modelo.novoProcesso(0);
  assert.equal(p.postosParalelo, 1); assert.equal(p.qtdPorCiclo, 1); assert.equal(p.conversao, 1);
  assert.equal(p.tr.modo, 'cronometrado'); assert.deepEqual(p.tarefas, []);
});

test('novoMfv vazio com 1 turno e data de hoje', () => {
  const m = modelo.novoMfv();
  assert.ok(m.id);
  assert.equal(m.producao.turnos.length, 1);
  assert.equal(m.producao.demandaMensal, null);
  assert.equal(m.producao.diasMes, null);
  assert.deepEqual(m.processos, []);
  assert.match(m.cabecalho.data, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(Object.keys(m.fluxos).length, 11);
});

test('novaTarefa', () => {
  const t = modelo.novaTarefa('Cortar');
  assert.equal(t.nome, 'Cortar'); assert.deepEqual(t.leituras, []); assert.ok(t.id);
});

test('backup ida e volta', () => {
  const ms = [modelo.novoMfv(), modelo.novoMfv()];
  ms[0].processos.push(modelo.novoProcesso(0));
  assert.deepEqual(modelo.importarBackup(modelo.exportarBackup(ms)), ms);
});

test('backup de versão desconhecida é rejeitado', () => {
  assert.throws(() => modelo.importarBackup(JSON.stringify({ versao: 99, mfvs: [] })), /versão/i);
  assert.throws(() => modelo.importarBackup('não é json'), /inválido/i);
});

test('backup com MFV malformado é rejeitado com mensagem clara', () => {
  const ruim = (m) => JSON.stringify({ versao: 1, mfvs: [m] });
  const ok = modelo.novoMfv();
  assert.throws(() => modelo.importarBackup(ruim({ ...ok, processos: undefined })), /MFV 1.*processos/i);
  assert.throws(() => modelo.importarBackup(ruim({ ...ok, id: 5 })), /MFV 1.*id/i);
  const semTarefas = structuredClone(ok); semTarefas.processos.push({ ...modelo.novoProcesso(0), tarefas: null });
  assert.throws(() => modelo.importarBackup(ruim(semTarefas)), /tarefas/i);
  assert.throws(() => modelo.importarBackup(ruim({ ...ok, producao: { turnos: 'x' } })), /turnos/i);
});

test('conflitos lista MFVs do backup que já existem no celular', () => {
  const a = modelo.novoMfv(), b = modelo.novoMfv(), c = modelo.novoMfv();
  assert.deepEqual(modelo.conflitos([a, b], [b, c]).map((m) => m.id), [b.id]);
});
