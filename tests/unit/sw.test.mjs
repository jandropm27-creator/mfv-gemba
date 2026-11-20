import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../../app/', import.meta.url));
const listar = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? listar(join(d, n)) : [join(d, n)]));

test('service worker guarda todos os arquivos do app para uso offline', () => {
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  const lista = JSON.parse(sw.match(/const ARQUIVOS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const esperados = listar(APP).map((f) => './' + relative(APP, f)).filter((f) => f !== './sw.js').sort();
  assert.deepEqual([...lista].filter((f) => f !== './').sort(), esperados);
  assert.ok(lista.includes('./'));
});

test('versão do service worker corresponde ao conteúdo atual (rode npm run sw)', async () => {
  const { createHash } = await import('node:crypto');
  const arqs = listar(APP).map((f) => relative(APP, f).split('\\').join('/')).filter((f) => f !== 'sw.js').sort();
  const h = createHash('sha256');
  for (const a of arqs) { h.update(a); h.update(readFileSync(join(APP, a))); }
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  assert.equal(sw.match(/const VERSAO = 'mfv-gemba-([0-9a-f]+)'/)[1], h.digest('hex').slice(0, 12));
});

test('instalação do service worker ignora o cache HTTP (evita misturar versões)', () => {
  const sw = readFileSync(join(APP, 'sw.js'), 'utf8');
  assert.match(sw, /new Request\(u, \{ cache: 'reload' \}\)/);
});
