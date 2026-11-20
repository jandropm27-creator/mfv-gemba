import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { servir, abrirCelular } from './apoio.mjs';

let srv, nav, ctx, page;
const URL_TAREFA = () => `${srv.url}#/mfv/exemplo/processo/p0/tarefa/t0`;
before(async () => {
  srv = await servir();
  ({ navegador: nav, contexto: ctx } = await abrirCelular());
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('ERRO NA PÁGINA:', e.message));
  await page.clock.install();
  await page.goto(srv.url);
});
after(async () => { await nav?.close(); await srv?.fechar(); });
beforeEach(async () => {
  const ex = JSON.parse(await readFile('tests/fixtures/mfv_exemplo.json', 'utf8'));
  ex.processos[0].tarefas[0].leituras = [];
  await page.goto(srv.url);
  await page.evaluate(async (m) => { sessionStorage.clear(); await (await import('./js/db.js')).salvar(m); }, ex);
  await page.goto(URL_TAREFA());
  await page.getByRole('button', { name: 'Iniciar' }).waitFor();
});

async function ler(seg, decisao) {
  await page.getByRole('button', { name: 'Iniciar' }).click();
  await page.clock.runFor(seg * 1000);
  await page.getByRole('button', { name: 'Parar' }).click();
  if (decisao) await page.locator('dialog[open]').getByRole('button', { name: decisao }).click();
}
const nLeituras = () => page.locator('#leituras li').count();

test('Voltar com cronômetro rodando pede confirmação; cancelar mantém a leitura em andamento', async () => {
  await page.getByRole('button', { name: 'Iniciar' }).click();
  await page.clock.runFor(5000);
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('link', { name: 'Voltar' }).click();
  assert.equal(page.url(), URL_TAREFA());
  await page.getByRole('button', { name: 'Parar' }).waitFor();
});

test('sair pelo botão voltar do aparelho e voltar retoma o cronômetro', async () => {
  await page.getByRole('button', { name: 'Iniciar' }).click();
  await page.clock.runFor(10000);
  await page.goBack();
  await page.goForward();
  await page.getByRole('button', { name: 'Parar' }).waitFor();
  await page.clock.runFor(5000);
  await page.getByRole('button', { name: 'Parar' }).click();
  const txt = await page.locator('#leituras li').first().innerText();
  assert.match(txt, /15,[0-2] s/);   // 10 s antes + 5 s depois de voltar (± ms do relógio simulado)
});

test('toque duplo (< 1 s) não vira leitura', async () => {
  await ler(0.3);
  assert.equal(await nLeituras(), 0);
  await page.getByText(/muito curta/).waitFor();
});

test('restaurar uma leitura refaz a checagem de discrepância', async () => {
  await ler(100); await ler(100); await ler(100);
  await ler(50, 'Descartar leitura');                   // 50 < 80% da média → descartada
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await page.locator('dialog[open]').getByRole('heading', { name: /abaixo da média/ }).waitFor();
});

test('aviso fechado com Esc/voltar do Android não trava', async () => {
  const r = await page.evaluate(async () => {
    const { perguntar } = await import('./js/ui.js');
    let resultado = 'travou';
    perguntar('Teste', { botoes: [{ texto: 'OK', valor: 'ok' }] }).then((x) => { resultado = x; });
    document.getElementById('dialogo').dispatchEvent(new Event('cancel', { cancelable: true }));
    for (let i = 0; i < 5; i++) await Promise.resolve();
    return { resultado, aberto: document.getElementById('dialogo').open };
  });
  assert.equal(r.aberto, false);
  r.botao = r.resultado?.botao;
  r.resultado = r.resultado === 'travou' ? 'travou' : 'ok';
  assert.notEqual(r.resultado, 'travou');
  assert.equal(r.botao, null);
});
