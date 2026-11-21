import { campo, ligar, dicaMapa } from '../ui.js';
import { limiteDoCampo } from '../abreviar.js';

const CAMPOS = [
  ['fornecedor', 'Fornecedor / matéria-prima', 'Ex.: Fornecedores de fardos de fibras'],
  ['entregaFornecedor', 'Frequência de entrega do fornecedor', 'Ex.: Quarta e sexta'],
  ['pedidoFornecedor', 'Pedido ao fornecedor (meio e frequência)', 'Ex.: E-mail semanal'],
  ['previsaoFornecedor', 'Previsão enviada ao fornecedor', 'Ex.: Previsão 4 semanas'],
  ['pcpSistema', 'Sistema do PCP', 'Ex.: MRP + Excel'],
  ['cliente', 'Cliente / canal', 'Ex.: Distribuidores, varejo e atacado'],
  ['previsaoCliente', 'Previsão recebida do cliente', 'Ex.: Previsão 30/60 dias'],
  ['pedidoCliente', 'Pedidos do cliente', 'Ex.: Pedidos diários'],
  ['entregaCliente', 'Frequência de entrega ao cliente', 'Ex.: 1 x semana'],
  ['progProducao', 'Programação para a produção', 'Ex.: Programação diária'],
  ['progExpedicao', 'Programação para a expedição', 'Ex.: Programação semanal de entregas'],
];

export default function fluxos(el, ctx) {
  ctx.titulo('Fluxos');
  const f = ctx.mfv.fluxos;
  el.innerHTML = `<div class="cartao"><p class="sutil">Campo em branco fica em branco no mapa.</p>
    ${CAMPOS.map(([k, r, d]) => campo(r, f[k], { id: `f-${k}`, attrs: `placeholder="${d}"` })).join('')}</div>`;
  ligar(el, f, Object.fromEntries(CAMPOS.map(([k]) => [`f-${k}`, { prop: k }])), ctx.salvar);
  for (const [k] of CAMPOS) dicaMapa(el, `f-${k}`, limiteDoCampo(k));
}
