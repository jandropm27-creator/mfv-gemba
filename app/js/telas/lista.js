import * as db from '../db.js';
import { novoMfv, exportarBackup, importarBackup } from '../modelo.js';
import { pendencias } from '../calculo.js';
import { h, perguntar } from '../ui.js';

export default async function lista(el, ctx) {
  ctx.titulo('MFV Gemba');
  const mfvs = await db.listar();
  el.innerHTML = `
    <button id="novo" class="largo">Novo MFV</button>
    <div class="lista" style="margin-top:16px">
      ${mfvs.length ? '' : '<p class="sutil">Nenhum MFV ainda. Toque em “Novo MFV” para começar a coleta.</p>'}
      ${mfvs.map((m) => {
        const n = pendencias(m).length;
        return `<div class="proc"><a class="item" href="#/mfv/${m.id}">
          <span>${h(m.cabecalho.cliente || 'Sem cliente')}<br><small>${h(m.cabecalho.produto || '')} · ${h(m.cabecalho.data)} · ${m.processos.length} processo(s)</small></span>
          <small>${n ? `${n} pendência(s)` : 'Completo'}</small></a>
          <button class="perigo" data-excluir="${m.id}" aria-label="Excluir ${h(m.cabecalho.cliente || 'MFV')}">✕</button></div>`;
      }).join('')}
    </div>
    <div class="cartao" style="margin-top:24px"><h2>Backup</h2>
      <p class="sutil">Guarde uma cópia de todos os MFVs deste celular.</p>
      <div class="linha"><button id="exportar" class="sec">Exportar backup</button>
      <button id="importar" class="sec">Importar backup</button></div>
      <input id="arquivo" type="file" accept="application/json,.json" hidden></div>`;

  el.querySelector('#novo').addEventListener('click', async () => {
    const m = novoMfv();
    await db.salvar(m);
    location.hash = `#/mfv/${m.id}`;
  });
  el.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Excluir este MFV? Esta ação não pode ser desfeita.')) return;
    await db.excluir(b.dataset.excluir);
    ctx.redesenhar();
  }));
  el.querySelector('#exportar').addEventListener('click', async () => {
    const blob = new Blob([exportarBackup(await db.listar())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup_mfv_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const arq = el.querySelector('#arquivo');
  el.querySelector('#importar').addEventListener('click', () => arq.click());
  arq.addEventListener('change', async () => {
    try {
      const mfvs2 = importarBackup(await arq.files[0].text());
      for (const m of mfvs2) await db.salvar(m);
      ctx.redesenhar();
    } catch (e) {
      await perguntar('Não foi possível importar', { texto: e.message, botoes: [{ texto: 'OK' }] });
    }
  });
}
