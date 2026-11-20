// Persistência local em IndexedDB. Cada alteração é gravada imediatamente.
const NOME = 'mfv-gemba', STORE = 'mfvs';
let conexao;

function abrir() {
  if (conexao) return conexao;
  conexao = new Promise((ok, erro) => {
    const req = indexedDB.open(NOME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
  return conexao;
}

async function tx(modo, fn) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const t = db.transaction(STORE, modo);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
    t.onerror = () => erro(t.error);
  });
}

export const listar = async () => (await tx('readonly', (s) => s.getAll()))
  .sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
export const obter = (id) => tx('readonly', (s) => s.get(id));
export const excluir = (id) => tx('readwrite', (s) => s.delete(id));
export function salvar(mfv) {
  mfv.atualizadoEm = new Date().toISOString();
  return tx('readwrite', (s) => s.put(structuredClone(mfv)));
}
