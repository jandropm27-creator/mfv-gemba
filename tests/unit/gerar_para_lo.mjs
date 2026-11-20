// uso: node tests/unit/gerar_para_lo.mjs tests/fixtures/x.json out/x.xlsx
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { gerarPlanilha } from '../../app/js/xlsx.js';
const [, , fixture, saida] = process.argv;
const raiz = new URL('../../', import.meta.url);
const bytes = await gerarPlanilha(JSZip, readFileSync(new URL('app/modelo/MFV_12P.xlsx', raiz)),
  JSON.parse(readFileSync(new URL('app/modelo/mapa.json', raiz))), JSON.parse(readFileSync(fixture)),
  { DOMParser, XMLSerializer });
mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, bytes);
