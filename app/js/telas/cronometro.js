import { novaLeitura } from '../modelo.js';
import { estatisticas } from '../cronoanalise.js';
import { trMin } from '../calculo.js';
import { campo, ligar, numTxt, fmt, h, perguntar } from '../ui.js';

const mmss = (ms) => {
  const s = ms / 1000;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};

export default function cronometro(el, ctx) {
  const m = ctx.mfv;
  const p = m.processos.find((x) => x.id === ctx.pid);
  if (!p) { location.hash = `${ctx.base}/processos`; return; }
  const alvo = ctx.tr ? p.tr : p.tarefas.find((t) => t.id === ctx.tid);
  if (!alvo) { location.hash = `${ctx.base}/processo/${p.id}`; return; }
  ctx.titulo(ctx.tr ? `T/R · ${p.nome}` : `${alvo.nome} · ${p.nome}`);

  let inicio = null, timer = null;
  ctx.aoSair(() => clearInterval(timer));

  const seletorTR = ctx.tr ? `<div class="cartao">
      <label for="modo">Como obter o T/R</label>
      <select id="modo">
        <option value="cronometrado" ${p.tr.modo === 'cronometrado' ? 'selected' : ''}>Cronometrar (mín. 3 trocas)</option>
        <option value="informado" ${p.tr.modo === 'informado' ? 'selected' : ''}>Informado pelo cliente</option>
        <option value="nao_aplica" ${p.tr.modo === 'nao_aplica' ? 'selected' : ''}>Não se aplica (sem setup)</option>
      </select>
      ${p.tr.modo === 'informado' ? `<div class="linha"><div>${campo('Valor do T/R', numTxt(p.tr.valor), { id: 'tr-valor', decimal: true })}</div>
        <div><label for="tr-un">Unidade do T/R</label><select id="tr-un">${['seg', 'min', 'h'].map((u) => `<option ${p.tr.unidade === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div></div>
        <p class="sutil">Equivale a <b id="tr-min">${fmt(trMin(p))}</b> min.</p>` : ''}
    </div>` : '';
  const usaCrono = !ctx.tr || p.tr.modo === 'cronometrado';

  el.innerHTML = `${seletorTR}${usaCrono ? `
    <div class="relogio" id="relogio">00:00.0</div>
    <button id="crono" class="btn-crono">Iniciar</button>
    <div class="kpis" id="stats" style="margin-top:14px"></div>
    <p id="status" class="status"></p>
    <div class="cartao"><h2>Leituras (seg)</h2><ul class="leituras" id="leituras"></ul></div>` : ''}`;

  if (ctx.tr) {
    el.querySelector('#modo').addEventListener('change', async (e) => { p.tr.modo = e.target.value; await ctx.salvar(); ctx.redesenhar(); });
    if (p.tr.modo === 'informado') {
      ligar(el, p.tr, { 'tr-valor': { prop: 'valor', tipo: 'num' } }, ctx.salvar, () => { el.querySelector('#tr-min').textContent = fmt(trMin(p)); });
      el.querySelector('#tr-un').addEventListener('change', (e) => { p.tr.unidade = e.target.value; ctx.salvar(); el.querySelector('#tr-min').textContent = fmt(trMin(p)); });
    }
  }
  if (!usaCrono) return;

  const desenhar = () => {
    const e = estatisticas(alvo.leituras);
    const min = (s) => fmt(s === null ? null : s / 60);
    el.querySelector('#stats').innerHTML = `
      <div class="kpi"><b>${min(e.minSeg)}</b><span>menor (min)</span></div>
      <div class="kpi"><b>${min(e.mediaSeg)}</b><span>média (min)</span></div>
      <div class="kpi"><b>${min(e.maxSeg)}</b><span>maior (min)</span></div>`;
    const st = el.querySelector('#status');
    st.textContent = e.completa ? `Completa · adotado ${min(e.minSeg)} min (menor leitura)` : `Incompleta (${e.validas}/3 leituras válidas)`;
    st.className = `status ${e.completa ? 'ok' : 'pend'}`;
    el.querySelector('#leituras').innerHTML = alvo.leituras.map((l, i) => `
      <li class="${l.descartada ? 'desc' : ''}"><b>L${i + 1}</b><span>${fmt(l.seg, 1)} s${l.confirmada ? ' ✓' : ''}${l.descartada && l.motivo ? ` — ${h(l.motivo)}` : ''}</span>
      ${l.descartada ? `<button class="sec" data-restaurar="${i}">Restaurar</button>` : `<button class="perigo" data-descartar="${i}">Descartar</button>`}</li>`).reverse().join('');
    el.querySelectorAll('[data-descartar]').forEach((b) => b.addEventListener('click', async () => {
      const r = await perguntar(`Descartar L${Number(b.dataset.descartar) + 1}?`, { campoRotulo: 'Motivo (opcional)',
        botoes: [{ texto: 'Cancelar', classe: 'sec', valor: false }, { texto: 'Descartar', classe: 'perigo', valor: true }] });
      if (!r.botao) return;
      Object.assign(alvo.leituras[b.dataset.descartar], { descartada: true, motivo: r.texto });
      await ctx.salvar(); desenhar();
    }));
    el.querySelectorAll('[data-restaurar]').forEach((b) => b.addEventListener('click', async () => {
      Object.assign(alvo.leituras[b.dataset.restaurar], { descartada: false, motivo: '' });
      await ctx.salvar(); desenhar();
    }));
  };

  async function verificarDiscrepancia() {
    const e = estatisticas(alvo.leituras);
    if (!e.discrepante) return;
    const i = alvo.leituras.findIndex((l) => !l.descartada && l.seg === e.minSeg);
    if (i < 0 || alvo.leituras[i].confirmada) return;
    const r = await perguntar('Leitura muito abaixo da média', {
      texto: `L${i + 1} (${fmt(e.minSeg, 1)} s) está mais de 20% abaixo da média (${fmt(e.mediaSeg, 1)} s). Confirmar esta leitura?`,
      campoRotulo: 'Motivo da confirmação (opcional)',
      botoes: [{ texto: 'Descartar leitura', classe: 'perigo', valor: 'descartar' }, { texto: 'Confirmar', valor: 'confirmar' }],
    });
    if (r.botao === 'confirmar') Object.assign(alvo.leituras[i], { confirmada: true, motivoConfirmacao: r.texto });
    else Object.assign(alvo.leituras[i], { descartada: true, motivo: 'Discrepante (>20% abaixo da média)' });
    await ctx.salvar();
    desenhar();
  }

  const relogio = el.querySelector('#relogio');
  const botao = el.querySelector('#crono');
  botao.addEventListener('click', async () => {
    if (inicio === null) {
      inicio = Date.now();
      botao.textContent = 'Parar'; botao.classList.add('parar');
      timer = setInterval(() => { relogio.textContent = mmss(Date.now() - inicio); }, 100);
    } else {
      const seg = (Date.now() - inicio) / 1000;
      clearInterval(timer); inicio = null;
      botao.textContent = 'Iniciar'; botao.classList.remove('parar');
      relogio.textContent = mmss(seg * 1000);
      alvo.leituras.push(novaLeitura(seg));
      await ctx.salvar();
      desenhar();
      await verificarDiscrepancia();
    }
  });
  desenhar();
}
