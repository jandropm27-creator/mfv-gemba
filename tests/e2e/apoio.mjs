// Servidor estático mínimo + navegador Playwright para os testes de ponta a ponta.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
export const { chromium, devices } = require('playwright');
const RAIZ = fileURLToPath(new URL('../../app/', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml' };

export async function servir() {
  // MFV_URL=https://…/ roda os testes contra o site publicado em vez do servidor local.
  if (process.env.MFV_URL) return { url: process.env.MFV_URL.replace(/\/?$/, '/'), fechar: async () => {} };
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const arq = normalize(join(RAIZ, p));
    if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    try {
      const corpo = await readFile(arq);
      res.writeHead(200, { 'Content-Type': TIPOS[extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(corpo);
    } catch { res.writeHead(404); res.end('404'); }
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  return { url: `http://127.0.0.1:${srv.address().port}/`, fechar: () => new Promise((ok) => srv.close(ok)) };
}

export async function abrirCelular() {
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ ...devices['Pixel 7'], acceptDownloads: true });
  return { navegador, contexto };
}
