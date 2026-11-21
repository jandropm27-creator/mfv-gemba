// Executa no app (publicado ou local) a coleta de um cenário de indústria, tirando prints
// de cada etapa, e baixa a planilha gerada pelo próprio app.
//
// uso: node tools/simulacao/simular.mjs tools/simulacao/cenarios/<cenario>.json <pasta_saida>
//      LOCAL=1 → usa a versão local do app (app/) em vez do site publicado
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium, devices, servir } from '../../tests/e2e/apoio.mjs';

const [, , arqCenario, OUT] = process.argv;
const C = JSON.parse(readFileSync(arqCenario, 'utf8'));

// Textos que precisam caber nas formas do mapa: se não couberem, use abreviação no cenário.
// Caminhões: ~8 caracteres por linha, 2 linhas. Caixa do processo: ~22 caracteres.
const LIMITES = { caminhaoPalavra: 8, caminhaoTotal: 18, processo: 22 };
const problemas = [];
for (const campo of ['Frequência de entrega do fornecedor', 'Frequência de entrega ao cliente']) {
  const t = C.fluxos[campo] || '';
  const longa = t.split(/\s+/).find((w) => w.length > LIMITES.caminhaoPalavra);
  if (longa || t.length > LIMITES.caminhaoTotal) problemas.push(`caminhão “${campo}”: “${t}” — abrevie (palavras até ${LIMITES.caminhaoPalavra} letras, total até ${LIMITES.caminhaoTotal})`);
}
for (const p of C.processos) if (p.nome.length > LIMITES.processo) problemas.push(`processo “${p.nome}” — abrevie (até ${LIMITES.processo} caracteres)`);
if (problemas.length) { console.error('Textos grandes demais para o mapa:\n- ' + problemas.join('\n- ')); process.exit(2); }

mkdirSync(OUT, { recursive: true });
const SRV = process.env.LOCAL ? await servir() : null;
const URL = SRV ? SRV.url : 'https://jandropm27-creator.github.io/mfv-gemba/';

const nav = await chromium.launch();
const ctx = await nav.newContext({ ...devices['Pixel 7'], acceptDownloads: true, locale: 'pt-BR' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('ERRO NA PÁGINA:', e.message));
await page.clock.install();
await page.goto(URL);

const legendas = [];
let n = 0;
async function foto(titulo, texto, full = false) {
  if (full) await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.waitForTimeout(250);
  const arq = `${String(++n).padStart(2, '0')}_tela.png`;
  await page.screenshot({ path: `${OUT}/${arq}`, fullPage: full });
  legendas.push({ arq, titulo: `${n}. ${titulo}`, texto });
}
const voltar = () => page.getByRole('link', { name: 'Voltar' }).click();
const fmtMin = (s) => (s / 60).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

let leituras = 0;
// uma leitura; se aparecer o alerta de discrepância, confirma (com motivo) ou descarta
async function ler(seg, { confirmar, fotoMeio } = {}) {
  await page.getByRole('button', { name: 'Iniciar' }).click();
  if (fotoMeio) {
    await page.clock.fastForward(seg * 600);
    await foto(...fotoMeio);
    await page.clock.fastForward(seg * 400);
  } else await page.clock.fastForward(seg * 1000);
  await page.getByRole('button', { name: 'Parar' }).click();
  await page.getByText(`L${++leituras}`, { exact: true }).waitFor();
  await page.waitForTimeout(200);
  const alerta = page.locator('dialog[open]');
  if (await alerta.isVisible()) {
    if (confirmar) {
      await page.getByLabel('Motivo da confirmação (opcional)').fill(confirmar);
      await foto('Alerta de leitura discrepante', `Leitura ${leituras} (${seg} s) ficou mais de 20% abaixo da média. O consultor confirma e registra o motivo: “${confirmar}”.`);
      await alerta.getByRole('button', { name: 'Confirmar' }).click();
    } else await alerta.getByRole('button', { name: 'Descartar leitura' }).click();
  }
}

async function cronometrar(t, { primeira, proc }) {
  leituras = 0;
  for (let i = 0; i < t.leituras.length; i++) {
    const fotoMeio = primeira && i === 1
      ? ['Cronômetro rodando', `${proc}: cronometrando “${t.nome}” — 2ª leitura em andamento.`] : null;
    await ler(t.leituras[i], { confirmar: t.confirmar, fotoMeio });
    if (t.descartar && t.descartar.leitura === i + 1) {
      await page.locator('#leituras li', { has: page.getByText(`L${i + 1}`, { exact: true }) }).getByRole('button', { name: 'Descartar' }).click();
      await page.getByLabel('Motivo (opcional)').fill(t.descartar.motivo);
      await page.locator('dialog[open]').getByRole('button', { name: 'Descartar' }).click();
    }
  }
  const validas = t.leituras.filter((_, i) => !(t.descartar && t.descartar.leitura === i + 1));
  if (primeira) await foto('Tarefa completa', `${proc}: ${t.leituras.length} leituras; adota-se a menor (${fmtMin(Math.min(...validas))} min).`);
  if (t.descartar) await foto('Leitura descartada', `${proc}: L${t.descartar.leitura} descartada — “${t.descartar.motivo}”. Adotada a menor leitura válida (${fmtMin(Math.min(...validas))} min).`);
}

// ---------------- roteiro ----------------
await foto('Abrir o app', 'Tela inicial no celular. Toque em “Novo MFV”.');
await page.getByRole('button', { name: 'Novo MFV' }).click();
await foto('Painel do MFV', 'Seções da coleta, com o status de cada uma à direita.');

await page.getByRole('link', { name: /Cabeçalho/ }).click();
await page.getByLabel('Cliente').fill(C.cabecalho.cliente);
await page.getByLabel('Produto / família').fill(C.cabecalho.produto);
await page.getByLabel('Consultor').fill(C.cabecalho.consultor);
await page.getByLabel('Unidade da demanda e do estoque').fill(C.cabecalho.unidade);
await foto('Cabeçalho', `Cliente, produto/família, data, consultor e unidade (${C.cabecalho.unidade}).`);
await voltar();

await page.getByRole('link', { name: /Dados de produção/ }).click();
const P = C.producao;
await page.getByLabel('Demanda mensal').fill(P.demanda);
await page.getByLabel('Dias trabalhados no mês').fill(P.dias);
await page.getByLabel('Disponibilidade da família (%)').fill(P.disp);
for (let i = 1; i < P.turnos.length; i++) await page.getByRole('button', { name: 'Adicionar turno' }).click();
for (let i = 0; i < P.turnos.length; i++) {
  const t = P.turnos[i], card = page.locator('.cartao', { hasText: `Turno ${i + 1}` });
  for (const d of t.dias) await card.getByRole('checkbox', { name: d }).check();
  await card.getByLabel('Entrada').fill(t.entrada);
  await card.getByLabel('Pausa manhã').fill(t.pausaM || '');
  await card.getByLabel('Refeição').fill(t.refeicao || '');
  await card.getByLabel('Pausa tarde').fill(t.pausaT || '');
  await card.getByLabel('Saída').fill(t.saida);
}
const turnosTxt = P.turnos.map((t) => `${t.dias.join('/')} ${t.entrada}–${t.saida}`).join('; ');
await foto('Dados de produção', `Demanda ${P.demanda} ${C.cabecalho.unidade}/mês, ${P.dias} dias, disponibilidade ${P.disp}%. Turno(s): ${turnosTxt}. Takt calculado na hora.`, true);
await voltar();

await page.getByRole('link', { name: /Fluxos/ }).click();
for (const [r, v] of Object.entries(C.fluxos)) await page.getByLabel(r).fill(v);
await foto('Fluxos de informação e material', 'Fornecedor, cliente, PCP, previsões, pedidos e frequências de entrega.', true);
await voltar();

await page.getByRole('link', { name: /Processos/ }).click();
for (let i = 0; i < C.processos.length; i++) await page.getByRole('button', { name: 'Adicionar processo' }).click();
await page.getByLabel(/Estoque antes da expedição/).fill(C.estoque_final);
await foto('Processos', `${C.processos.map((p) => p.nome).join(', ')} + estoque antes da expedição.`);

let fotoDuasTarefas = false, fotoTrInf = false;
for (let i = 0; i < C.processos.length; i++) {
  const p = C.processos[i];
  await page.getByRole('link', { name: new RegExp(`PROC\\. ${'ABCDEFGHIJKL'[i]}`) }).click();
  await page.getByLabel('Nome do processo').fill(p.nome);
  await page.getByLabel('Operadores', { exact: true }).fill(p.op);
  await page.getByLabel('Postos em paralelo').fill(p.postos);
  await page.getByLabel('Quantidade por ciclo').fill(p.qtd);
  await page.getByLabel('Unidade do ciclo', { exact: true }).fill(C.cabecalho.unidade);
  await page.getByLabel('Disponibilidade (%)').fill(p.disp);
  await page.getByLabel(/Estoque antes do processo/).fill(p.est);
  for (let j = 0; j < p.tarefas.length; j++) {
    const t = p.tarefas[j];
    await page.getByLabel('Nova tarefa').fill(t.nome);
    await page.getByRole('button', { name: 'Adicionar tarefa' }).click();
    await page.getByRole('link', { name: t.nome }).click();
    await cronometrar(t, { primeira: i === 0 && j === 0, proc: p.nome });
    await voltar();
  }
  // T/R
  await page.getByRole('link', { name: /T\/R/ }).click();
  await page.getByLabel('Como obter o T/R').selectOption(p.tr.modo);
  if (p.tr.modo === 'informado') {
    await page.getByLabel('Valor do T/R').fill(p.tr.valor);
    await page.getByLabel('Unidade do T/R').selectOption(p.tr.unidade);
    if (!fotoTrInf) { fotoTrInf = true; await foto('T/R informado pelo cliente', `${p.nome}: troca informada em ${p.tr.valor} ${p.tr.unidade}, convertida para minutos.`); }
  } else if (p.tr.modo === 'cronometrado') {
    leituras = 0;
    for (const s of p.tr.leituras) await ler(s);
    await foto('T/R cronometrado', `${p.nome}: ${p.tr.descricao || 'troca'} cronometrada em ${p.tr.leituras.length} trocas; adotada a menor (${fmtMin(Math.min(...p.tr.leituras))} min).`);
  }
  await voltar();
  if (p.tarefas.length > 1 && !fotoDuasTarefas) {
    fotoDuasTarefas = true;
    await foto('Processo com mais de uma tarefa', `${p.nome}: T/C = soma dos menores tempos de cada tarefa; T/C efetivo considera ${p.postos} posto(s) em paralelo e ${p.qtd} ${C.cabecalho.unidade} por ciclo.`, true);
  }
  await voltar();
}
await foto('Processos completos', 'Todos os processos com cronoanálise completa.', true);
await voltar();

await page.getByRole('link', { name: /Resumo/ }).click();
await foto('Resumo', 'Takt, Lead Time, TAV e o gráfico T/C efetivo × Takt, com o gargalo destacado.', true);
await voltar();
await foto('Painel final', 'Coleta concluída, sem pendências.');
await page.getByRole('link', { name: /Gerar planilha/ }).click();
await foto('Gerar planilha', 'Gera o .xlsx e compartilha (WhatsApp, e-mail, Drive).');
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Gerar/ }).click()]);
const nome = dl.suggestedFilename();
await dl.saveAs(`${OUT}/${nome}`);
writeFileSync(`${OUT}/legendas.json`, JSON.stringify({ cenario: C, planilha: nome, legendas }, null, 1));
console.log('planilha:', nome, '| telas:', n);
await nav.close(); await SRV?.fechar();
