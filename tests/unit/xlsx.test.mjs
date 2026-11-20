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
