import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { servir, abrirCelular } from './apoio.mjs';

let srv, nav, ctx, page;
before(async () => {
  srv = await servir();
  ({ navegador: nav, contexto: ctx } = await abrirCelular());
  page = await ctx.newPage();
});
after(async () => { await nav?.close(); await srv?.fechar(); });

test('abre, coleta e gera planilha sem internet após o primeiro acesso', { timeout: 60000 }, async () => {
  await page.goto(srv.url);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await ctx.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Novo MFV' }).click();
  await page.getByRole('link', { name: /Cabeçalho/ }).click();
  await page.getByLabel('Cliente').fill('Offline');
  await page.getByRole('link', { name: 'Voltar' }).click();
  await page.getByRole('link', { name: /Gerar planilha/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Gerar/ }).click(),
  ]);
  assert.match(download.suggestedFilename(), /^MFV_Offline_/);
});

test('manifesto instalável', { timeout: 30000 }, async () => {
  await ctx.setOffline(false);
  await page.goto(srv.url);
  const m = await page.evaluate(async () => (await fetch('manifest.webmanifest', { cache: 'reload' })).json());
  assert.equal(m.name, 'MFV Gemba');
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some((i) => i.sizes === '512x512'));
});
