import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { gerarPlanilha, nomeArquivo } from '../../app/js/xlsx.js';

const raiz = new URL('../../', import.meta.url);
const modelo = readFileSync(new URL('app/modelo/MFV_12P.xlsx', raiz));
const mapa = JSON.parse(readFileSync(new URL('app/modelo/mapa.json', raiz)));
const fx = (n) => JSON.parse(readFileSync(new URL(`tests/fixtures/${n}.json`, raiz)));
const xmlApi = { DOMParser, XMLSerializer };

async function gerar(n) {
  const bytes = await gerarPlanilha(JSZip, modelo, mapa, fx(n), xmlApi);
  const z = await JSZip.loadAsync(bytes);
  const parte = async (p) => z.file(p).async('string');
  return { z, parte, aba: await parte('xl/worksheets/sheet1.xml'), desenho: await parte('xl/drawings/drawing1.xml') };
}
const cel = (xml, ref) => (xml.match(new RegExp(`<c r="${ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`)) || [null])[0];
const num = (xml, ref) => Number((cel(xml, ref) || '').match(/<v>([^<]*)<\/v>/)?.[1]);
const txt = (xml, ref) => (cel(xml, ref) || '').match(/<t[^>]*>([^<]*)<\/t>/)?.[1];
const parse = (s) => {
  const erros = [];
  new DOMParser({ onError: (_, m) => erros.push(m) }).parseFromString(s, 'text/xml');
  return erros;
};

test('exemplo: valores de entrada nas células do mapa', async () => {
  const { aba } = await gerar('mfv_exemplo');
  assert.ok(Math.abs(num(aba, 'L37') - 52 / 60) < 1e-9);
  assert.equal(txt(aba, 'K33'), 'Corte');
  assert.equal(num(aba, 'L34'), 2);
  assert.equal(num(aba, 'L38'), 0.19);
  assert.equal(num(aba, 'L39'), 90);
  assert.equal(num(aba, 'H37'), 91);
  assert.equal(num(aba, 'CB37'), 65);
  assert.equal(txt(aba, 'I37'), 'kg');
  assert.equal(num(aba, 'CG15'), 5000);
  assert.equal(num(aba, 'CN52'), 20);
  assert.equal(num(aba, 'CT52'), 0.6);
  assert.equal(txt(aba, 'CM48'), 'X');
  assert.ok(Math.abs(num(aba, 'CT48') - 450 / 1440) < 1e-9);
  assert.equal(txt(aba, 'C26'), 'Indústria Exemplo');
  assert.equal(txt(aba, 'C28'), '20/11/2026');
});

test('exemplo: textos das formas substituídos, nada do modelo original', async () => {
  const { desenho } = await gerar('mfv_exemplo');
  assert.ok(desenho.includes('Fornecedor Alfa de fibras'));
  assert.ok(desenho.includes('Lista diária de entregas'));
  for (const t of ['Fardos', 'Distribuidores', 'MRP']) assert.ok(!desenho.includes(t), t);
});

test('fórmulas sem valor em cache', async () => {
  const { aba } = await gerar('mfv_exemplo');
  assert.equal(/<f>[^<]*<\/f><v>/.test(aba), false);
});

test('3 processos: só 3 caixas e 4 triângulos; blocos vazios apagados', async () => {
  const { aba, desenho } = await gerar('mfv_3proc');
  const caixas = desenho.match(/name="MFV_P\d+_CAIXA"/g) || [];
  const tri = desenho.match(/name="MFV_(P\d+_ESTOQUE|ESTOQUE_FINAL)"/g) || [];
  assert.equal(caixas.length, 3);
  assert.equal(tri.length, 4);
  assert.equal(txt(aba, 'AC33'), undefined);        // nome do bloco 4 vazio
  assert.equal(txt(aba, 'AC37'), undefined);        // rótulo T/C: do bloco 4 apagado
  assert.match(cel(aba, 'AC37'), / s="1"/);
  assert.doesNotMatch(cel(aba, 'W37'), / s="1"/);   // bloco 3 mantém rótulo e estilo
});

test('caracteres especiais geram XML válido', async () => {
  const { aba, desenho, parte } = await gerar('mfv_3proc');
  assert.deepEqual(parse(aba), []);
  assert.deepEqual(parse(desenho), []);
  assert.ok(aba.includes('Mistura &amp; &lt;Sova&gt;'));
  assert.deepEqual(parse(await parte('xl/worksheets/sheet5.xml')), []);
});

test('aba CRONOANÁLISE registrada', async () => {
  const { parte } = await gerar('mfv_3proc');
  assert.match(await parte('xl/workbook.xml'), /name="CRONOANÁLISE"/);
  assert.match(await parte('[Content_Types].xml'), /\/xl\/worksheets\/sheet5\.xml/);
  assert.match(await parte('xl/_rels/workbook.xml.rels'), /worksheets\/sheet5\.xml/);
  const s5 = await parte('xl/worksheets/sheet5.xml');
  assert.ok(s5.includes('Pesar &quot;massa&quot;') || s5.includes('Pesar "massa"'));
  assert.ok(s5.includes('Não se aplica'));
});

test('nomeArquivo normaliza cliente', () => {
  assert.equal(nomeArquivo(fx('mfv_3proc')), 'MFV_Padaria_Sao_Jose_Cia_Teste_1_2026-11-20.xlsx');
});

test('campo de pausa vazio num turno existente fica em branco (não 00:00)', async () => {
  const m = fx('mfv_exemplo');
  m.producao.turnos[0].pausaT = '';
  const bytes = await gerarPlanilha(JSZip, modelo, mapa, m, xmlApi);
  const aba = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
  assert.doesNotMatch(cel(aba, mapa.producao.turnos[0].pausa_t), /<v>/);
  assert.match(cel(aba, mapa.producao.turnos[0].entrada), /<v>/);
});

test('gráfico mostra só os processos cadastrados', async () => {
  const { parte } = await gerar('mfv_3proc');
  const g = await parte('xl/charts/chart1.xml');
  for (const c of ['A', 'B', 'C']) assert.ok(g.includes(`$${c}$52:$${c}$54<`), `série ${c}`);
  assert.ok(!g.includes('$63<'));
});

test('CRONOANÁLISE com colunas largas o bastante para os textos', async () => {
  const { parte } = await gerar('mfv_exemplo');
  const s5 = await parte('xl/worksheets/sheet5.xml');
  const larg = Object.fromEntries([...s5.matchAll(/<col min="(\d+)" max="\d+" width="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])]));
  const cab = [...s5.match(/<row r="1">([\s\S]*?)<\/row>/)[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]);
  cab.forEach((titulo, i) => assert.ok((larg[i + 1] || 0) >= Math.min(titulo.length + 2, 34), `coluna ${i + 1} (${titulo}) estreita: ${larg[i + 1]}`));
  assert.ok(larg[cab.indexOf('Descartes (motivo)') + 1] >= 30);
});

// --- mapa compactado: blocos não usados ocultos, desenho acompanha
function geometria(aba) {
  const w = {};
  for (const m of aba.matchAll(/<col min="(\d+)" max="(\d+)"([^>]*)\/>/g)) {
    const larg = Number(m[3].match(/width="([\d.]+)"/)[1]);
    for (let i = Number(m[1]); i <= Number(m[2]); i++) w[i] = { larg, oculta: / hidden="1"/.test(m[3]) };
  }
  const emu = (c) => Math.trunc(((256 * c + Math.trunc(128 / 7)) / 256) * 7) * 9525;
  const x = (col1) => { let s = 0; for (let i = 1; i < col1; i++) s += emu((w[i] || { larg: 14.42578125 }).larg); return s; };
  return { w, x };
}
function ancorasTopo(desenho) {
  return [...desenho.matchAll(/<xdr:oneCellAnchor>([\s\S]*?)<\/xdr:oneCellAnchor>/g)].map((m) => {
    const a = m[1];
    return { col: Number(a.match(/<xdr:col>(\d+)</)[1]), off: Number(a.match(/<xdr:colOff>(-?\d+)</)[1]),
      row: Number(a.match(/<xdr:row>(\d+)</)[1]), cx: Number(a.match(/<xdr:ext cx="(\d+)"/)[1]) };
  }).filter((a) => a.row < 32);
}

test('mapa compactado: colunas dos blocos não usados ficam ocultas', async () => {
  const { aba } = await gerar('mfv_3proc');
  const { w } = geometria(aba);
  // 3 processos: o fluxo superior comprimiria demais (fator 0,36 < 0,55), então ficam visíveis
  // os blocos vazios 4–6 e oculta-se a partir do 7º (fator 0,57)
  const c0 = mapa.processos[6].colunas[0], c1 = mapa.processos[11].colunas[1];
  for (let i = 1; i <= 120; i++) if (w[i]) assert.equal(w[i].oculta, i >= c0 && i <= c1, `coluna ${i}`);
});

test('mapa compactado: com 6 processos a expedição encosta no último processo', async () => {
  const m = fx('mfv_exemplo'); m.processos = m.processos.slice(0, 6);
  const bytes = await gerarPlanilha(JSZip, modelo, mapa, m, xmlApi);
  const aba = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
  const { w } = geometria(aba);
  const c0 = mapa.processos[6].colunas[0], c1 = mapa.processos[11].colunas[1];
  for (let i = 1; i <= 120; i++) if (w[i]) assert.equal(w[i].oculta, i >= c0 && i <= c1, `coluna ${i}`);
});

test('mapa compactado: nenhuma forma do fluxo superior fica ancorada em coluna oculta', async () => {
  const { aba, desenho } = await gerar('mfv_3proc');
  const { w } = geometria(aba);
  for (const a of ancorasTopo(desenho)) assert.ok(!w[a.col + 1]?.oculta, `forma ancorada na coluna oculta ${a.col + 1}`);
});

// setas só de linha no fluxo superior = setas da programação (8 para os blocos A–H + 1 para a expedição)
const setasProgramacao = (desenho) => [...desenho.matchAll(/<xdr:oneCellAnchor>([\s\S]*?)<\/xdr:oneCellAnchor>/g)]
  .map((m) => m[1]).filter((a) => Number(a.match(/<xdr:row>(\d+)</)[1]) < 32 && /cxnSp/.test(a) && !/<xdr:sp[ >]/.test(a) && !/<xdr:pic[ >]/.test(a));

test('mapa compactado: setas da programação só para os processos cadastrados + expedição', async () => {
  assert.equal(setasProgramacao((await gerar('mfv_exemplo')).desenho).length, 9);
  assert.equal(setasProgramacao((await gerar('mfv_3proc')).desenho).length, 4);
});

test('mapa compactado: fluxo superior proporcional, sem o cliente sobre o PCP', async () => {
  const { aba, desenho } = await gerar('mfv_3proc');
  const { w, x } = geometria(aba);
  const xv = (col1) => { let s = 0; for (let i = 1; i < col1; i++) if (!w[i]?.oculta) s += Math.trunc(((256 * (w[i]?.larg ?? 14.42578125) + 18) / 256) * 7) * 9525; return s; };
  const pos = (nome) => {
    const a = [...desenho.matchAll(/<xdr:oneCellAnchor>([\s\S]*?)<\/xdr:oneCellAnchor>/g)].map((m) => m[1]).find((t) => t.includes(`name="${nome}"`));
    const x0 = xv(Number(a.match(/<xdr:col>(\d+)</)[1]) + 1) + Number(a.match(/<xdr:colOff>(-?\d+)</)[1]);
    return [x0, x0 + Number(a.match(/<xdr:ext cx="(\d+)"/)[1])];
  };
  const [f0, f1] = pos('MFV_FORNECEDOR'), [p0, p1] = pos('MFV_PCP_SISTEMA'), [c0, c1] = pos('MFV_CLIENTE');
  assert.ok(f1 <= p0 && p1 <= c0, `ordem fornecedor < PCP < cliente: ${[f0, f1, p0, p1, c0, c1]}`);
  const exped = xv(mapa.processos[11].colunas[1] + 1);           // início da área da expedição/estoque final
  assert.ok(c1 > exped, 'cliente continua do lado da expedição');
});

test('mapa com 12 processos não oculta nada', async () => {
  const m = fx('mfv_exemplo');
  while (m.processos.length < 12) m.processos.push(structuredClone(m.processos[0]));
  const bytes = await gerarPlanilha(JSZip, modelo, mapa, m, xmlApi);
  const aba = await (await JSZip.loadAsync(bytes)).file('xl/worksheets/sheet1.xml').async('string');
  assert.doesNotMatch(aba, / hidden="1"/);
});
