import { test, before, after } from 'node:test';
import { servir, abrirCelular } from './apoio.mjs';

let srv, nav, ctx, page;
before(async () => {
  srv = await servir();
  ({ navegador: nav, contexto: ctx } = await abrirCelular());
  page = await ctx.newPage();
  await page.goto(srv.url);
});
after(async () => { await nav?.close(); await srv?.fechar(); });

test('mostra como o texto longo vai sair no mapa (fluxos e nome do processo)', { timeout: 60000 }, async () => {
  await page.getByRole('button', { name: 'Novo MFV' }).click();
  await page.getByRole('link', { name: /Fluxos/ }).click();
  await page.getByLabel('Frequência de entrega ao cliente').fill('Diária (caminhão refrigerado)');
  await page.getByText('No mapa: Diária (cam. refrig.)').waitFor();
  await page.getByLabel('Frequência de entrega ao cliente').fill('Semanal');
  await page.getByText(/No mapa:/).waitFor({ state: 'hidden' });
  await page.getByRole('link', { name: 'Voltar' }).click();
  await page.getByRole('link', { name: /Processos/ }).click();
  await page.getByRole('button', { name: 'Adicionar processo' }).click();
  await page.getByRole('link', { name: /PROC\. A/ }).click();
  await page.getByLabel('Nome do processo').fill('Pesagem de ingredientes');
  await page.getByText('No mapa: Pesagem ingredientes').waitFor();
});
