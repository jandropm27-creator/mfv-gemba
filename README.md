# MFV Gemba

App offline para celular que conduz a coleta do Mapeamento do Fluxo de Valor (MFV) no Gemba — cronoanálise com mínimo de 3 leituras (adota a menor), T/R, estoques, dados de produção e fluxos — e gera a planilha padrão **MFV EP (12 processos)** já preenchida.

- `app/` — o aplicativo (publicado no GitHub Pages). Funciona sem internet depois do primeiro acesso.
- `tools/` — constrói o modelo `app/modelo/MFV_12P.xlsx` e o `mapa.json` a partir de `modelo/MFV_ME_EPP_original.xlsx`.
- `docs/` — documento de design e plano de implementação.

## Comandos

```bash
npm install                 # dependências de teste
npm run modelo              # reconstrói o modelo de 12 processos
npm run sw                  # atualiza o service worker — rode sempre que alterar arquivos em app/
npm run test:unit
npm run test:e2e
(cd tools && python3 -m unittest discover -s tests)
python3 tests/test_xlsx_lo.py   # recálculo no LibreOffice
```
