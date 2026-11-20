// Fábricas do modelo de dados e backup em JSON.
const LETRAS = 'ABCDEFGHIJKL';
const CAMPOS_FLUXO = ['fornecedor', 'entregaFornecedor', 'pcpSistema', 'previsaoFornecedor', 'pedidoFornecedor',
  'cliente', 'previsaoCliente', 'pedidoCliente', 'entregaCliente', 'progProducao', 'progExpedicao'];
export const VERSAO_BACKUP = 1;

export function novoId() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
}

function hoje() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function novoTurno() {
  return { dias: [false, false, false, false, false, false], entrada: '', pausaM: '', refeicao: '', pausaT: '', saida: '' };
}

export function novoMfv() {
  const agora = new Date().toISOString();
  return {
    id: novoId(), criadoEm: agora, atualizadoEm: agora,
    cabecalho: { cliente: '', produto: '', data: hoje(), consultor: '', unidade: '' },
    producao: { demandaMensal: null, diasMes: null, dispFamilia: null, turnos: [novoTurno()] },
    fluxos: Object.fromEntries(CAMPOS_FLUXO.map((c) => [c, ''])),
    processos: [], estoqueFinal: null,
  };
}

export function novoProcesso(indice) {
  return {
    id: novoId(), nome: `PROC. ${LETRAS[indice] ?? indice + 1}`, operadores: null, postosParalelo: 1,
    qtdPorCiclo: 1, unidadeCiclo: '', conversao: 1, disponibilidade: null, estoqueAntes: null,
    tarefas: [], tr: { modo: 'cronometrado', leituras: [], valor: null, unidade: 'min' },
  };
}

export function novaTarefa(nome) {
  return { id: novoId(), nome, leituras: [] };
}

export function novaLeitura(seg) {
  return { seg: Math.round(seg * 100) / 100, descartada: false, motivo: '', confirmada: false, motivoConfirmacao: '' };
}

export function exportarBackup(mfvs) {
  return JSON.stringify({ versao: VERSAO_BACKUP, exportadoEm: new Date().toISOString(), mfvs }, null, 1);
}

export function importarBackup(json) {
  let d;
  try { d = JSON.parse(json); } catch { throw new Error('Arquivo de backup inválido.'); }
  if (!d || d.versao !== VERSAO_BACKUP) throw new Error(`Backup de versão desconhecida (${d?.versao}).`);
  if (!Array.isArray(d.mfvs)) throw new Error('Arquivo de backup inválido.');
  return d.mfvs;
}
