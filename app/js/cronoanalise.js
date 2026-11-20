// Estatísticas de cronoanálise: mínimo de 3 leituras válidas; adota-se a menor.
export const MIN_LEITURAS = 3;
export const LIMITE_DISCREPANCIA = 0.2;

export function estatisticas(leituras = []) {
  const v = leituras.filter((l) => !l.descartada).map((l) => l.seg);
  if (!v.length) return { validas: 0, minSeg: null, mediaSeg: null, maxSeg: null, completa: false, discrepante: false };
  const minSeg = Math.min(...v);
  const mediaSeg = v.reduce((a, b) => a + b, 0) / v.length;
  return {
    validas: v.length,
    minSeg,
    mediaSeg,
    maxSeg: Math.max(...v),
    completa: v.length >= MIN_LEITURAS,
    discrepante: v.length > 1 && minSeg < (1 - LIMITE_DISCREPANCIA) * mediaSeg,
  };
}
