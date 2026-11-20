// Conversões de unidade de tempo. Padrão do app: minutos.
const FATOR = { seg: 1 / 60, min: 1, h: 60 };

export function numero(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s/g, '');
  // Padrão brasileiro: vírgula decimal, ponto de milhar ("12.500" = 12500; "1.234,5" = 1234,5).
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (s === '' || !/^-?\d*\.?\d+$/.test(s)) return null;
  return Number(s);
}

export function paraMin(valor, unidade = 'min') {
  const n = numero(valor);
  if (n === null) return null;
  return Math.round(n * FATOR[unidade] * 1e9) / 1e9;
}

export function hhmmParaMin(s) {
  if (!s) return 0;
  if (!String(s).includes(':')) return numero(s) || 0;   // só número = minutos
  const [h, m] = String(s).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
