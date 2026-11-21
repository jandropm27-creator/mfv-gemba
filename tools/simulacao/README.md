# Simulações por indústria

Cada indústria é um arquivo em `cenarios/`. O executor roda a coleta no app (publicado, ou local com `LOCAL=1`),
tira prints de cada etapa e baixa a planilha; o relatório recalcula a planilha e monta o PDF passo a passo.

```bash
node tools/simulacao/simular.mjs tools/simulacao/cenarios/<cenario>.json <pasta>
python3 tools/simulacao/relatorio.py <pasta>
```

## Textos no mapa: até 22 caracteres, abreviação automática acima disso

O app abrevia sozinho, ao gerar a planilha, os textos que vão para formas pequenas do mapa
(nome do processo, caminhões, etiquetas de previsão/pedido/PCP, programação da expedição):

- até **22 caracteres**: o texto fica como está (caminhões com fonte 7 pt: ~11 caracteres por linha, 2 linhas);
- acima disso: tira "de/do/da", usa abreviações usuais (Quinzenal → Quinz., refrigerado → refrig.,
  ingredientes → ingred., embalagem → embal. …) e, se ainda não couber, encurta as palavras mais longas;
- fábricas (fornecedor, cliente) e a barra da programação aceitam até 45 caracteres;
- a aba CRONOANÁLISE mantém o nome completo do processo;
- na tela do app, abaixo do campo, aparece "No mapa: …" quando o texto vai ser abreviado.

O executor lista as abreviações feitas e o relatório as mostra.
