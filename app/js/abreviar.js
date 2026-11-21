// Abreviação automática dos textos que vão para as formas pequenas do mapa
// (caixa do processo, caminhões, etiquetas). Até o limite, o texto fica como está.
export const LIMITE_MAPA = 22;
// Fábricas (fornecedor/cliente) e a barra da programação comportam mais texto; o resto usa LIMITE_MAPA.
export const LIMITE_FORMA = { fornecedor: 45, cliente: 45, progProducao: 45 };
export const limiteDoCampo = (campo) => LIMITE_FORMA[campo] ?? LIMITE_MAPA;

const LIGACOES = /\s+(de|do|da|dos|das)\s+/gi;

// Abreviações usuais em chão de fábrica (minúsculas; a capitalização original é mantida).
const DICIONARIO = {
  semanal: 'sem.', semanais: 'sem.', quinzenal: 'quinz.', quinzenais: 'quinz.', mensal: 'mens.', mensais: 'mens.',
  semestral: 'semest.', trimestral: 'trim.', semana: 'sem.', semanas: 'sem.', vezes: 'x',
  caminhão: 'cam.', caminhões: 'cam.', refrigerado: 'refrig.', refrigerada: 'refrig.', transportadora: 'transp.',
  fornecedor: 'forn.', fornecedores: 'forn.', cliente: 'cli.', clientes: 'cli.', representante: 'repres.',
  previsão: 'prev.', previsões: 'prev.', programação: 'prog.', produção: 'prod.', pedido: 'ped.', pedidos: 'ped.',
  expedição: 'exped.', entrega: 'entr.', entregas: 'entr.', distribuidores: 'distrib.', atacado: 'atac.',
  ingredientes: 'ingred.', embalagem: 'embal.', passadoria: 'passad.', inspeção: 'insp.', dimensional: 'dim.',
  montagem: 'mont.', preparação: 'prep.', acabamento: 'acab.', separação: 'separ.', classificação: 'classif.',
  manutenção: 'manut.', usinagem: 'usin.', tratamento: 'trat.', térmico: 'térm.', superficial: 'superf.',
  ultracongelamento: 'ultracong.', congelamento: 'cong.', resfriamento: 'resfr.', fermentação: 'ferm.',
  beneficiamento: 'benef.', lavagem: 'lav.', secagem: 'sec.', pesagem: 'pes.', revisão: 'rev.', costura: 'cost.',
  injeção: 'inj.', impressão: 'impr.', acabamentos: 'acab.', automotivo: 'autom.', automotivos: 'autom.',
  sistemistas: 'sistem.', matéria: 'mat.', 'matéria-prima': 'MP', planilha: 'plan.',
};

const manterCaixa = (orig, abrev) => (orig[0] === orig[0].toUpperCase() && orig[0] !== orig[0].toLowerCase()
  ? abrev[0].toUpperCase() + abrev.slice(1) : abrev);

const limpar = (s) => s.replace(/\s+/g, ' ').trim();

export function abreviar(texto, max = LIMITE_MAPA) {
  let t = limpar(String(texto ?? ''));
  if (t.length <= max) return t;

  // 1) tira as ligações "de/do/da/dos/das"
  t = limpar(t.replace(LIGACOES, ' '));
  if (t.length <= max) return t;

  // 2) abreviações conhecidas
  t = t.replace(/[\p{L}-]+/gu, (w) => {
    const a = DICIONARIO[w.toLowerCase()];
    return a ? manterCaixa(w, a) : w;
  });
  if (t.length <= max) return t;

  // encurta a palavra mais longa que casar com o padrão; em empate, a mais à direita
  const encurtar = (padrao, letras) => {
    const ps = [...t.matchAll(padrao)];
    if (!ps.length) return false;
    const alvo = ps.reduce((a, b) => (b[1].length >= a[1].length ? b : a));
    t = t.slice(0, alvo.index) + alvo[1].slice(0, letras) + '.' + t.slice(alvo.index + alvo[0].length);
    return true;
  };

  // 3) palavras longas ainda não abreviadas → 4 letras + ponto
  while (t.length > max && encurtar(/(\p{L}{6,})(?![\p{L}.])/gu, 4));
  if (t.length <= max) return t;

  // 4) tira conectores e pontuação de ligação
  t = limpar(t.replace(/\s+(e|via|com|para)\s+/gi, ' ').replace(/\s*[,;–—]\s*|\s+-\s+/g, ' '));
  if (t.length <= max) return t;

  // 5) tira os parênteses (mantém o conteúdo)
  t = limpar(t.replace(/[()]/g, ''));
  if (t.length <= max) return t;

  // 6) encurta mais: qualquer palavra (abreviada ou não) com 4+ letras → 3 letras + ponto
  while (t.length > max && encurtar(/(\p{L}{4,})\.?/gu, 3));
  if (t.length <= max) return t;

  // 7) último recurso: tira palavras do fim (sem reticências)
  const ps = t.split(' ');
  while (ps.length > 1 && ps.join(' ').length > max) ps.pop();
  t = ps.join(' ');
  return t.length <= max ? t : t.slice(0, Math.max(1, max - 1)) + '.';
}
