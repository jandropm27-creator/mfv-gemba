// Gera a planilha MFV preenchida a partir do modelo (MFV_12P.xlsx) e do mapa.json.
// Só escreve células de entrada e textos de formas; as fórmulas ficam no modelo.
import { tcEfetivoMin, tcCronometradoMin, trMin } from './calculo.js';
import { estatisticas } from './cronoanalise.js';
import { hhmmParaMin, numero } from './unidades.js';

const NS_M = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NOME_ABA_CRONO = 'CRONOANÁLISE';

export function escaparXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colNum(letras) { let n = 0; for (const ch of letras) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
function colLetras(n) { let s = ''; while (n) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - 1 - r) / 26; } return s; }
function partesRef(ref) { const m = /^([A-Z]+)(\d+)$/.exec(ref); return [colNum(m[1]), Number(m[2])]; }

class Aba {
  constructor(doc) {
    this.doc = doc;
    this.linhas = new Map();
    const rows = doc.getElementsByTagNameNS(NS_M, 'row');
    for (let i = 0; i < rows.length; i++) this.linhas.set(Number(rows[i].getAttribute('r')), rows[i]);
  }
  celula(ref) {
    const [col, lin] = partesRef(ref);
    let row = this.linhas.get(lin);
    if (!row) throw new Error(`Linha ${lin} inexistente no modelo`);
    let depois = null;
    for (let c = row.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      const r = c.getAttribute('r');
      if (r === ref) return c;
      if (partesRef(r)[0] > col) { depois = c; break; }
    }
    const nova = this.doc.createElementNS(NS_M, 'c');
    nova.setAttribute('r', ref);
    row.insertBefore(nova, depois);
    return nova;
  }
  limpar(ref) {
    const c = this.celula(ref);
    while (c.firstChild) c.removeChild(c.firstChild);
    c.removeAttribute('t');
    return c;
  }
  numero(ref, v) {
    const c = this.limpar(ref);
    if (v === null || v === undefined || Number.isNaN(v)) return;
    const el = this.doc.createElementNS(NS_M, 'v');
    el.appendChild(this.doc.createTextNode(String(v)));
    c.appendChild(el);
  }
  texto(ref, s) {
    const c = this.limpar(ref);
    if (s === null || s === undefined || s === '') return;
    c.setAttribute('t', 'inlineStr');
    const is = this.doc.createElementNS(NS_M, 'is');
    const t = this.doc.createElementNS(NS_M, 't');
    t.setAttribute('xml:space', 'preserve');
    t.appendChild(this.doc.createTextNode(String(s)));
    is.appendChild(t); c.appendChild(is);
  }
  semCacheDeFormulas() {
    const cs = this.doc.getElementsByTagNameNS(NS_M, 'c');
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (!c.getElementsByTagNameNS(NS_M, 'f').length) continue;
      const vs = c.getElementsByTagNameNS(NS_M, 'v');
      for (let j = vs.length - 1; j >= 0; j--) c.removeChild(vs[j]);
    }
  }
}

function ancoraDe(el) {
  let n = el;
  while (n.parentNode && n.parentNode.parentNode && n.parentNode.parentNode.nodeType === 1) n = n.parentNode;
  return n;
}

function porNome(doc, nome) {
  const ns = doc.getElementsByTagNameNS(NS_XDR, 'cNvPr');
  for (let i = 0; i < ns.length; i++) if (ns[i].getAttribute('name') === nome) return ns[i];
  return null;
}

function definirTextoForma(doc, nome, texto) {
  const cnv = porNome(doc, nome);
  if (!cnv) throw new Error(`Forma ${nome} não encontrada no modelo`);
  const sp = cnv.parentNode.parentNode;                 // cNvPr → nvSpPr → sp
  const tx = sp.getElementsByTagNameNS(NS_XDR, 'txBody')[0];
  const ps = tx.getElementsByTagNameNS(NS_A, 'p');
  for (let i = ps.length - 1; i > 0; i--) tx.removeChild(ps[i]);
  const p0 = ps[0];
  const runs = p0.getElementsByTagNameNS(NS_A, 'r');
  for (let i = runs.length - 1; i > 0; i--) p0.removeChild(runs[i]);
  let t;
  if (runs.length) {
    t = runs[0].getElementsByTagNameNS(NS_A, 't')[0];
    while (t.firstChild) t.removeChild(t.firstChild);
  } else {
    const r = doc.createElementNS(NS_A, 'a:r');
    t = doc.createElementNS(NS_A, 'a:t');
    r.appendChild(t);
    const end = p0.getElementsByTagNameNS(NS_A, 'endParaRPr')[0];
    p0.insertBefore(r, end || null);
  }
  t.appendChild(doc.createTextNode(texto || ''));
}

function dataBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
}

export function nomeArquivo(mfv) {
  const cli = (mfv.cabecalho.cliente || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'cliente';
  return `MFV_${cli}_${mfv.cabecalho.data || 'sem-data'}.xlsx`;
}

function preencherAba(aba, mapa, mfv) {
  const c = mfv.cabecalho;
  aba.texto(mapa.cabecalho.cliente, c.cliente);
  aba.texto(mapa.cabecalho.produto, c.produto);
  aba.texto(mapa.cabecalho.data, dataBr(c.data));
  aba.texto(mapa.cabecalho.consultor, c.consultor);
  aba.texto(mapa.unidade, c.unidade);
  const pd = mapa.producao, pr = mfv.producao;
  aba.numero(pd.demanda, numero(pr.demandaMensal));
  aba.numero(pd.dias_mes, numero(pr.diasMes));
  aba.numero(pd.disp_familia, numero(pr.dispFamilia));
  pd.turnos.forEach((cel, i) => {
    const t = pr.turnos[i];
    cel.dias.forEach((ref, d) => aba.texto(ref, t && t.dias[d] ? 'X' : ''));
    for (const [k, campo] of [['entrada', 'entrada'], ['pausa_m', 'pausaM'], ['refeicao', 'refeicao'], ['pausa_t', 'pausaT'], ['saida', 'saida']]) {
      aba.numero(cel[k], t && t[campo] ? hhmmParaMin(t[campo]) / 1440 : null);
    }
  });
  mapa.processos.forEach((cel, k) => {
    const p = mfv.processos[k];
    if (!p) {
      const [ini, fim] = cel.colunas;
      const [l0, l1] = mapa.bloco_vazio.linhas;
      for (let lin = l0; lin <= l1; lin++) {
        for (let col = ini; col <= fim; col++) {
          const el = aba.limpar(`${colLetras(col)}${lin}`);
          el.setAttribute('s', mapa.bloco_vazio.estilo);
        }
      }
      return;
    }
    aba.texto(cel.nome, p.nome);
    aba.numero(cel.operadores, numero(p.operadores));
    aba.numero(cel.tc, tcEfetivoMin(p));
    aba.numero(cel.tr, trMin(p));
    aba.numero(cel.disp, numero(p.disponibilidade));
    aba.numero(cel.estoque, numero(p.estoqueAntes));
  });
  aba.numero(mapa.estoque_final, numero(mfv.estoqueFinal));
  aba.semCacheDeFormulas();
}

function preencherDesenho(doc, mapa, mfv) {
  for (const [campo, nome] of Object.entries(mapa.formas)) definirTextoForma(doc, nome, mfv.fluxos[campo]);
  const n = mfv.processos.length;
  for (let k = n + 1; k <= mapa.processos.length; k++) {
    for (const modelo of Object.values(mapa.imagens_bloco)) {
      const cnv = porNome(doc, modelo.replace('{k}', k));
      if (cnv) { const a = ancoraDe(cnv); a.parentNode.removeChild(a); }
    }
  }
}

const fmt = (v, d = 2) => (v === null || v === undefined ? '' : Number(v.toFixed(d)));

function linhasCronoanalise(mfv) {
  const linhas = [];
  let maxL = 3;
  for (const p of mfv.processos) {
    for (const t of p.tarefas) maxL = Math.max(maxL, t.leituras.length);
    if (p.tr.modo === 'cronometrado') maxL = Math.max(maxL, p.tr.leituras.length);
  }
  const cab = ['Processo', 'Tarefa / T/R', ...Array.from({ length: maxL }, (_, i) => `L${i + 1} (seg)`),
    'Descartes (motivo)', 'Mín (min)', 'Média (min)', 'Máx (min)', 'Adotado (min)',
    'Discrepância confirmada (motivo)', 'Origem', 'Unidade original', 'Qtd/ciclo', 'Conversão',
    'Postos paralelos', 'T/C cronometrado (min)', 'T/C efetivo (min)'];
  linhas.push(cab);
  const linhaLeituras = (proc, nome, leituras, origem, unidade, extra) => {
    const e = estatisticas(leituras);
    const ls = Array.from({ length: maxL }, (_, i) => (leituras[i] ? leituras[i].seg + (leituras[i].descartada ? ' (desc.)' : '') : ''));
    const desc = leituras.map((l, i) => (l.descartada ? `L${i + 1}: ${l.motivo || 'sem motivo'}` : null)).filter(Boolean).join('; ');
    const conf = leituras.map((l, i) => (l.confirmada ? `L${i + 1}: ${l.motivoConfirmacao || 'confirmada'}` : null)).filter(Boolean).join('; ');
    const m = (s) => (s === null ? '' : fmt(s / 60, 4));
    return [proc, nome, ...ls, desc, m(e.minSeg), m(e.mediaSeg), m(e.maxSeg), e.completa ? m(e.minSeg) : '',
      conf, origem, unidade, ...extra];
  };
  for (const p of mfv.processos) {
    const extra = [numero(p.qtdPorCiclo) ?? 1, numero(p.conversao) ?? 1, numero(p.postosParalelo) ?? 1,
      fmt(tcCronometradoMin(p), 4), fmt(tcEfetivoMin(p), 4)];
    for (const t of p.tarefas) linhas.push(linhaLeituras(p.nome, t.nome, t.leituras, 'Cronometrado', 'seg', extra));
    const tr = p.tr;
    if (tr.modo === 'cronometrado') {
      linhas.push(linhaLeituras(p.nome, 'T/R', tr.leituras, 'Cronometrado', 'seg', ['', '', '', '', '']));
    } else {
      const vazio = Array(maxL + 6).fill('');
      const origem = tr.modo === 'informado' ? 'Informado pelo cliente' : 'Não se aplica';
      const linha = [p.nome, 'T/R', ...vazio, origem, tr.modo === 'informado' ? (tr.unidade || 'min') : '', '', '', '', '', ''];
      linha[2 + maxL + 4] = fmt(trMin(p), 4);
      linhas.push(linha);
    }
  }
  return linhas;
}

// Largura de cada coluna: o maior texto da coluna (cabeçalho ou célula), entre 10 e 40 caracteres.
function larguras(linhas) {
  const n = Math.max(...linhas.map((l) => l.length));
  return Array.from({ length: n }, (_, j) => Math.min(40, Math.max(
    /motivo/i.test(String(linhas[0][j])) ? 30 : 10,          // motivos digitados no Gemba costumam ser longos
    ...linhas.map((l) => String(l[j] ?? '').length + 2))));
}

function xmlCronoanalise(linhas) {
  const rows = linhas.map((cols, i) => {
    const cells = cols.map((v, j) => {
      const ref = `${colLetras(j + 1)}${i + 1}`;
      if (v === '' || v === null || v === undefined) return '';
      if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(v)}</t></is></c>`;
    }).join('');
    return `<row r="${i + 1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${NS_M}" xmlns:r="${NS_R}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${larguras(linhas).map((w, j) => `<col min="${j + 1}" max="${j + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

async function adicionarAba(zip, xml) {
  let n = 1;
  while (zip.file(`xl/worksheets/sheet${n}.xml`)) n++;
  zip.file(`xl/worksheets/sheet${n}.xml`, xml);
  let ct = await zip.file('[Content_Types].xml').async('string');
  ct = ct.replace('</Types>', `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file('[Content_Types].xml', ct);
  let rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  let id = 1;
  while (rels.includes(`Id="rId${id}"`)) id++;
  rels = rels.replace('</Relationships>', `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/></Relationships>`);
  zip.file('xl/_rels/workbook.xml.rels', rels);
  let wb = await zip.file('xl/workbook.xml').async('string');
  const ids = [...wb.matchAll(/sheetId="(\d+)"/g)].map((m) => Number(m[1]));
  wb = wb.replace('</sheets>', `<sheet name="${NOME_ABA_CRONO}" sheetId="${Math.max(...ids) + 1}" r:id="rId${id}"/></sheets>`);
  zip.file('xl/workbook.xml', wb);
}

export async function gerarPlanilha(JSZip, modeloBuf, mapa, mfv, xmlApi = globalThis) {
  const { DOMParser, XMLSerializer } = xmlApi;
  const zip = await JSZip.loadAsync(modeloBuf);
  const parse = async (p) => new DOMParser().parseFromString(await zip.file(p).async('string'), 'text/xml');
  const ser = (doc) => new XMLSerializer().serializeToString(doc);

  const abaDoc = await parse(mapa.aba);
  preencherAba(new Aba(abaDoc), mapa, mfv);
  zip.file(mapa.aba, ser(abaDoc));

  const desDoc = await parse(mapa.desenho);
  preencherDesenho(desDoc, mapa, mfv);
  zip.file(mapa.desenho, ser(desDoc));

  // Gráfico de balanceamento só com os processos cadastrados (sem barras vazias nem Takt caindo a zero).
  if (mapa.grafico && mfv.processos.length) {
    const ini = mapa.grafico.primeira_linha, fim = ini + mfv.processos.length - 1;
    const g = await zip.file(mapa.grafico.parte).async('string');
    zip.file(mapa.grafico.parte, g.replace(new RegExp(`\\$([ABC])\\$${ini}:\\$\\1\\$\\d+`, 'g'), `$$$1$$${ini}:$$$1$$${fim}`));
  }

  await adicionarAba(zip, xmlCronoanalise(linhasCronoanalise(mfv)));
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
