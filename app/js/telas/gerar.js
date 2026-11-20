import { pendencias } from '../calculo.js';
import { gerarPlanilha, nomeArquivo } from '../xlsx.js';
import { h, perguntar } from '../ui.js';

async function carregarModelo() {
  const [buf, mapa] = await Promise.all([
    fetch('modelo/MFV_12P.xlsx').then((r) => r.arrayBuffer()),
    fetch('modelo/mapa.json').then((r) => r.json()),
  ]);
  return { buf, mapa };
}

export default function gerar(el, ctx) {
  ctx.titulo('Gerar planilha');
  const m = ctx.mfv;
  const pend = pendencias(m);
  el.innerHTML = `<div class="cartao">
      <p>Arquivo: <b>${h(nomeArquivo(m))}</b></p>
      ${pend.length ? `<div class="aviso">Há ${pend.length} pendência(s). Os campos faltantes ficam em branco na planilha.</div>
        <ul class="pend">${pend.map((x) => `<li>${h(x)}</li>`).join('')}</ul>` : '<p class="status ok">Coleta completa.</p>'}
      <button id="gerar" class="largo">${pend.length ? 'Gerar mesmo assim' : 'Gerar planilha'}</button>
      <p class="sutil">Depois de gerar, envie por WhatsApp, e-mail ou Drive e abra no Excel do notebook. A planilha recalcula ao abrir no Excel.</p>
    </div>`;
  const botao = el.querySelector('#gerar');
  botao.addEventListener('click', async () => {
    botao.disabled = true; botao.textContent = 'Gerando…';
    try {
      const { buf, mapa } = await carregarModelo();
      const bytes = await gerarPlanilha(window.JSZip, buf, mapa, m);
      const nome = nomeArquivo(m);
      const tipo = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const arquivo = new File([bytes], nome, { type: tipo });
      if (navigator.canShare?.({ files: [arquivo] })) {
        try { await navigator.share({ files: [arquivo], title: nome }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(arquivo); a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      await perguntar('Erro ao gerar a planilha', { texto: e.message, botoes: [{ texto: 'OK' }] });
    } finally {
      botao.disabled = false; botao.textContent = pend.length ? 'Gerar mesmo assim' : 'Gerar planilha';
    }
  });
}
