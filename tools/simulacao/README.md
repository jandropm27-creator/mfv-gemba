# Simulações por indústria

Cada indústria é um arquivo em `cenarios/`. O executor roda a coleta no app (publicado, ou local com `LOCAL=1`),
tira prints de cada etapa e baixa a planilha; o relatório recalcula a planilha e monta o PDF passo a passo.

```bash
node tools/simulacao/simular.mjs tools/simulacao/cenarios/<cenario>.json <pasta>
python3 tools/simulacao/relatorio.py <pasta>
```

## Regra de textos no mapa (abreviar quando não couber)

As formas do mapa têm espaço limitado. Quando o texto não couber, **use abreviação** no cenário (e no Gemba):

| Onde | Limite | Exemplos de abreviação |
|---|---|---|
| Caminhões (frequência de entrega) | palavras até 8 letras, total até 18 | Quinzenal → **Quinz.**; Semanal (transportadora) → **Semanal**; Diária (refrigerado) → **Diária refrig.**; 2 vezes por semana → **2x sem.** |
| Caixa do processo (nome) | até 22 caracteres | Pesagem de ingredientes → **Pesagem ingred.**; Passadoria e embalagem → **Passad. e embal.** |

O executor confere esses limites antes de rodar e aponta o campo a abreviar.
