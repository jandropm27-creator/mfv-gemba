import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { servir, abrirCelular } from './apoio.mjs';
const JSZip = createRequire(import.meta.url)('jszip');

let srv, nav, ctx, page;
before(async () => {
  srv = await servir();
  ({ navegador: nav, contexto: ctx } = await abrirCelular());
  page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('ERRO NA PÁGINA:', e.message));
  await page.addInitScript(() => {
    window.__persist = 0;
    if (navigator.storage) navigator.storage.persist = async () => { window.__persist++; return true; };
  });
  await page.clock.install();
  await page.goto(srv.url);
});
after(async () => { await nav?.close(); await srv?.fechar(); });

const hoje = () => new Date().toISOString().slice(0, 10);

let leituras = 0;
async function cronometrar(segundos) {
  const botao = page.getByRole('button', { name: /Iniciar/ });
  await botao.click();
  await page.clock.runFor(segundos * 1000);
  await page.getByRole('button', { name: /Parar/ }).click();
  await page.getByText(`L${++leituras}`, { exact: true }).waitFor();
}

test('pede armazenamento persistente ao abrir', async () => {
  await page.waitForFunction(() => window.__persist > 0, null, { timeout: 5000 });
});

test('fluxo completo no Gemba', async () => {
  await page.getByRole('button', { name: 'Novo MFV' }).click();

  await page.getByRole('link', { name: /Cabeçalho/ }).click();
  await page.getByLabel('Cliente').fill('Teste');
  await page.getByLabel('Unidade da demanda e do estoque').fill('kg');
  await page.getByRole('link', { name: 'Voltar' }).click();

  await page.getByRole('link', { name: /Dados de produção/ }).click();
  await page.getByLabel('Demanda mensal').fill('5000');
  await page.getByLabel('Dias trabalhados no mês').fill('20');
  await page.getByLabel('Disponibilidade da família (%)').fill('60');
  for (const d of ['Seg', 'Ter', 'Qua', 'Qui']) await page.getByRole('checkbox', { name: d }).check();
  await page.getByLabel('Entrada').fill('07:30');
  assert.equal(await page.getByLabel('Pausa manhã').getAttribute('type'), 'text', 'pausa é duração, não horário');
  await page.getByLabel('Pausa manhã').fill('00:14');
  await page.getByLabel('Refeição').fill('01:30');
  await page.getByLabel('Saída').fill('17:00');
  await assert.doesNotReject(page.getByText(/Takt/).first().waitFor());
  await page.getByRole('link', { name: 'Voltar' }).click();

  await page.getByRole('link', { name: /Processos/ }).click();
  await page.getByRole('button', { name: 'Adicionar processo' }).click();
  await page.getByRole('link', { name: /PROC\. A/ }).click();
  await page.getByLabel('Nome do processo').fill('Corte');
  await page.getByLabel('Nova tarefa').fill('Cortar');
  await page.getByRole('button', { name: 'Adicionar tarefa' }).click();
  await page.getByRole('link', { name: /Cortar/ }).click();

  await cronometrar(60);
  await cronometrar(62);
  await page.reload();                                     // celular recarregou no meio
  await assert.doesNotReject(page.getByText('L2', { exact: true }).waitFor());
  await cronometrar(70);
  await assert.doesNotReject(page.getByText(/Completa/).waitFor());
  await page.getByRole('link', { name: 'Voltar' }).click();

  await page.getByRole('link', { name: /T\/R/ }).click();
  await page.getByLabel('Como obter o T/R').selectOption('informado');
  await page.getByLabel('Valor do T/R').fill('0,5');
  await page.getByLabel('Unidade do T/R').selectOption('h');
  await page.getByRole('link', { name: 'Voltar' }).click();
  await page.getByRole('link', { name: 'Voltar' }).click();

  for (let i = 1; i < 12; i++) await page.getByRole('button', { name: 'Adicionar processo' }).click();
  await assert.doesNotReject(page.getByText('Máximo de 12 processos').waitFor());
  assert.equal(await page.getByRole('button', { name: 'Adicionar processo' }).isDisabled(), true);
  for (let i = 0; i < 11; i++) {
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /Remover PROC\./ }).last().click();
  }
  await page.getByRole('link', { name: 'Voltar' }).click();

  await page.getByRole('link', { name: /Gerar planilha/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Gerar planilha|Gerar mesmo assim/ }).click(),
  ]);
  assert.equal(download.suggestedFilename(), `MFV_Teste_${hoje()}.xlsx`);
  const z = await JSZip.loadAsync(await readFile(await download.path()));
  const aba = await z.file('xl/worksheets/sheet1.xml').async('string');
  const v = (ref) => Number(aba.match(new RegExp(`<c r="${ref}"[^>]*><v>([^<]*)</v>`))?.[1]);
  assert.ok(Math.abs(v('L37') - 1) < 0.01, `T/C = menor leitura (60 s = 1 min), obtido ${v('L37')}`);
  assert.equal(v('L38'), 30);
});
