// Utilidades de interface.
import { numero } from './unidades.js';
import { abreviar } from './abreviar.js';

export const h = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const fmt = (v, casas = 2) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas }));
export const numTxt = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','));

let seq = 0;
export function campo(rotulo, valor, { tipo = 'text', decimal = false, dica = '', id = `c${++seq}`, attrs = '' } = {}) {
  const im = decimal ? 'inputmode="decimal"' : '';
  return `<label for="${id}">${h(rotulo)}</label><input id="${id}" type="${tipo}" ${im} value="${h(valor)}" ${attrs}>${dica ? `<div class="sutil">${h(dica)}</div>` : ''}`;
}

// Liga inputs a propriedades: ao digitar, grava no objeto e chama salvar().
export function ligar(raiz, obj, mapa, salvar, aoMudar) {
  for (const [id, { prop, tipo }] of Object.entries(mapa)) {
    const el = raiz.querySelector(`#${id}`);
    if (!el) continue;
    el.addEventListener('input', () => {
      let v = el.value;
      if (tipo === 'num') v = numero(v);
      if (tipo === 'pct') { const n = numero(v); v = n === null ? null : n / 100; }
      obj[prop] = v;
      salvar();
      aoMudar?.();
    });
  }
}

export function perguntar(titulo, { texto = '', campoRotulo = '', botoes = [] } = {}) {
  const dlg = document.getElementById('dialogo');
  dlg.innerHTML = `<h2>${h(titulo)}</h2>${texto ? `<p>${h(texto)}</p>` : ''}
    ${campoRotulo ? `<label for="dlg-campo">${h(campoRotulo)}</label><input id="dlg-campo">` : ''}
    <div class="linha" style="margin-top:14px">${botoes.map((b, i) => `<button data-i="${i}" class="${b.classe || ''}">${h(b.texto)}</button>`).join('')}</div>`;
  return new Promise((ok) => {
    let feito = false;
    const fim = (botao) => {
      if (feito) return;
      feito = true;
      const v = dlg.querySelector('#dlg-campo')?.value || '';
      dlg.oncancel = dlg.onclose = null;
      if (dlg.open) dlg.close();
      ok({ botao, texto: v });
    };
    dlg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => fim(botoes[Number(b.dataset.i)].valor)));
    // Esc ou botão voltar do Android fecham o aviso sem escolher nada.
    dlg.oncancel = () => fim(null);
    dlg.onclose = () => fim(null);
    if (!dlg.open) dlg.showModal();
  });
}

// Abaixo do campo, mostra como o texto vai sair no mapa quando passar do limite (abreviação automática).
export function dicaMapa(raiz, id, limite) {
  const el = raiz.querySelector(`#${id}`);
  if (!el) return;
  const dica = document.createElement('div');
  dica.className = 'sutil dica-mapa';
  el.insertAdjacentElement('afterend', dica);
  const atualizar = () => {
    const v = el.value.trim(), a = abreviar(v, limite);
    dica.hidden = a === v;
    dica.textContent = a === v ? '' : `No mapa: ${a}`;
  };
  el.addEventListener('input', atualizar);
  atualizar();
}
