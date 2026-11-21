import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abreviar, LIMITE_MAPA } from '../../app/js/abreviar.js';

test('limite padrão do mapa é 22 caracteres', () => {
  assert.equal(LIMITE_MAPA, 22);
});

test('até 22 caracteres o texto fica como está', () => {
  for (const t of ['Semanal', 'Quinzenal', 'Diária (milk run)', 'Inspeção dimensional', '1234567890123456789012']) {
    assert.equal(abreviar(t), t);
  }
});

test('acima de 22: primeiro tira de/do/da/dos/das', () => {
  assert.equal(abreviar('Pesagem de ingredientes'), 'Pesagem ingredientes');
});

test('depois usa abreviações conhecidas da indústria', () => {
  assert.equal(abreviar('Diária (caminhão refrigerado)'), 'Diária (cam. refrig.)');
  assert.equal(abreviar('Semanal por transportadora'), 'Sem. por transp.');
  assert.equal(abreviar('Passadoria e embalagem final'), 'Passad. e embal. final');
});

test('se ainda não couber, encurta as palavras mais longas até caber', () => {
  for (const t of ['Produtores e atravessadores – castanha in natura',
    'Separação, numeração e amarração de pacotes de vinte peças',
    'Supercalifragilisticexpialidocious']) {
    const a = abreviar(t);
    assert.ok(a.length <= 22, `${a} (${a.length})`);
    assert.ok(a.length >= 3, a);
  }
});

test('respeita outro limite quando informado', () => {
  const a = abreviar('Produtores e atravessadores – castanha in natura', 45);
  assert.ok(a.length <= 45);
  assert.equal(abreviar('Curto', 3).length <= 3, true);
});

test('texto vazio ou nulo continua vazio', () => {
  assert.equal(abreviar(''), '');
  assert.equal(abreviar(null), '');
});

test('casos reais: legível, sem ponto duplo nem reticências', () => {
  const casos = {
    'Pedidos semanais via representante comercial': null,
    'Preparação do cabedal (chanfração e dublagem)': null,
    'Acabamento, limpeza e revisão final': 'Acab. limp. rev. final',
  };
  for (const [t, esperado] of Object.entries(casos)) {
    const a = abreviar(t);
    assert.ok(a.length <= 22, `${a} (${a.length})`);
    assert.doesNotMatch(a, /\.\./, a);
    assert.doesNotMatch(a, /…/, a);
    if (esperado) assert.equal(a, esperado);
  }
  assert.match(abreviar('Preparação do cabedal (chanfração e dublagem)'), /^Prep\. cab/);
  assert.match(abreviar('Pedidos semanais via representante comercial'), /^Ped\. sem\./);
});
