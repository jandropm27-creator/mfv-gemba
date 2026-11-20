// Gera prints de cada tela (Pixel 7) em out/telas/ usando a fixture de exemplo.
import { readFile, mkdir } from 'node:fs/promises';
import { servir, chromium, devices } from './apoio.mjs';
const srv = await servir();
const nav = await chromium.launch();
const ctx = await nav.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
await page.goto(srv.url);
const ex = JSON.parse(await readFile('tests/fixtures/mfv_exemplo.json', 'utf8'));
ex.processos[2].tarefas.push({ id: 'tx', nome: 'Soldar', leituras: [
  { seg: 40, descartada: false, motivo: '', confirmada: true, motivoConfirmacao: 'operador experiente' },
  { seg: 61, descartada: false, motivo: '', confirmada: false, motivoConfirmacao: '' },
  { seg: 75, descartada: true, motivo: 'buscou material', confirmada: false, motivoConfirmacao: '' }] });
await page.evaluate(async (m) => (await import('./js/db.js')).salvar(m), ex);
await mkdir('out/telas', { recursive: true });
const b = '#/mfv/exemplo';
const telas = [['01_lista', '#/'], ['02_painel', b], ['03_cabecalho', `${b}/cabecalho`], ['04_producao', `${b}/producao`],
  ['05_fluxos', `${b}/fluxos`], ['06_processos', `${b}/processos`], ['07_processo', `${b}/processo/p2`],
  ['08_cronometro', `${b}/processo/p2/tarefa/tx`], ['09_tr', `${b}/processo/p2/tr`], ['10_resumo', `${b}/resumo`], ['11_gerar', `${b}/gerar`]];
for (const [nome, hash] of telas) {
  await page.goto(srv.url + hash);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `out/telas/${nome}.png`, fullPage: true });
}
await nav.close(); await srv.fechar();
console.log('ok', telas.length);
