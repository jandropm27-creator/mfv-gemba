import { campo, ligar } from '../ui.js';

export default function cabecalho(el, ctx) {
  ctx.titulo('Cabeçalho');
  const c = ctx.mfv.cabecalho;
  el.innerHTML = `<div class="cartao">
    ${campo('Cliente', c.cliente, { id: 'cliente' })}
    ${campo('Produto / família', c.produto, { id: 'produto' })}
    ${campo('Data da coleta', c.data, { id: 'data', tipo: 'date' })}
    ${campo('Consultor', c.consultor, { id: 'consultor' })}
    ${campo('Unidade da demanda e do estoque', c.unidade, { id: 'unidade', dica: 'Ex.: kg, peças, unid, m, L', attrs: 'list="unidades"' })}
    <datalist id="unidades"><option>kg</option><option>peças</option><option>unid</option><option>m</option><option>L</option></datalist>
  </div>`;
  ligar(el, c, { cliente: { prop: 'cliente' }, produto: { prop: 'produto' }, data: { prop: 'data' },
    consultor: { prop: 'consultor' }, unidade: { prop: 'unidade' } }, ctx.salvar);
}
