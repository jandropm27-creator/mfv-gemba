# App MFV Gemba — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um PWA offline para o celular que conduz a coleta do MFV no Gemba e gera a planilha padrão `MFV EP` (reestruturada para 12 processos) já preenchida.

**Architecture:** Duas partes ligadas por um contrato. (1) Uma ferramenta Python de uso único (`tools/`) transforma a planilha original em um modelo de 12 processos (`app/modelo/MFV_12P.xlsx`), editando o XML do pacote diretamente (lxml), e publica um mapa de células/formas (`app/modelo/mapa.json`). (2) Um PWA em JS puro (sem build) guarda a coleta em IndexedDB e, ao final, abre o modelo com JSZip, escreve apenas as células de entrada e os textos das formas, acrescenta a aba `CRONOANÁLISE` e entrega o `.xlsx` via Web Share / download. Fórmulas ficam no modelo; o Excel recalcula ao abrir.

**Tech Stack:** Python 3 + lxml (ferramenta do modelo, testes com `unittest`); JavaScript ES modules, JSZip 3.10.1 (vendorizado), IndexedDB, Service Worker; testes com `node --test` (Node 22) e Playwright (pré-instalado); LibreOffice headless para recalcular planilhas nos testes de ponta a ponta.

**Spec:** `docs/2026-11-20-app-mfv-gemba-design.md`

## Global Constraints

- Coleta 100% offline após o primeiro carregamento.
- Máximo de **12 processos**; o 13º é bloqueado com aviso.
- Toda célula de tempo da planilha em **minutos**; entradas manuais aceitam `seg` / `min` / `h` (padrão `min`).
- Cronometragem: **mínimo 3 leituras válidas** por tarefa; valor adotado = **menor leitura válida**; T/C do processo = soma dos menores tempos das tarefas.
- Alerta de discrepância: menor leitura **> 20% abaixo da média** das válidas → pede confirmação (não bloqueia); confirmação e motivo registrados.
- **T/C efetivo = T/C cronometrado ÷ (qtdPorCiclo × conversao) ÷ postosParalelo** — é este valor que vai para o mapa, para o Takt e para o gráfico.
- T/R: `cronometrado` (mesma regra das 3 leituras) | `informado` (valor + unidade) | `nao_aplica` (= 0).
- Dias trabalhados/mês: **uma única célula**, usada por Takt e Lead Time.
- Nenhum texto do exemplo (fornecedor, cliente, PCP, frequências) pode sobrar na planilha gerada; campo vazio no app = texto vazio.
- Modelo: preservar imagens, estilos, mesclagens, gráfico e abas ocultas (`SIGLAS`, `MATRIZ DE PRIORIZAÇÃO`, `LEAN X ISHIKAWA`) intactos.
- Nome do arquivo: `MFV_<cliente>_<AAAA-MM-DD>.xlsx` (cliente sem acentos/espaços → `_`).
- Interface em português; botões de cronômetro com no mínimo 72 px de altura (uso com uma mão).

## Review Focus

1. **Valores em cache desatualizados:** o arquivo aberto num visualizador do celular (WhatsApp/Drive) mostra o cache das fórmulas. Esperado: o modelo marca `fullCalcOnLoad` e o gerador apaga os `<v>` de células com fórmula, para nunca exibir números do exemplo. → teste na Task 6.
2. **Mapa com poucos processos (ex.: 3):** blocos 4–12 sem ícones, sem `#DIV/0!`, sem `#VALOR!`, e fora de Lead Time/TAV. → teste na Task 6 (fixture de 3 processos recalculada no LibreOffice).
3. **App fechado ou celular reiniciado no meio do cronômetro:** a leitura em andamento não é salva, mas todas as leituras já paradas permanecem. → teste na Task 8.
4. **Texto com caracteres especiais** (`&`, `<`, acentos, `"`) em nomes de processo, cliente e tarefas não corrompe o XML. → teste na Task 6.
5. **Número digitado com vírgula decimal** ("0,33" h) é aceito como 0,33. → teste na Task 5.

---

## Estrutura de arquivos

```
mfv-app/
  docs/                                  (spec + este plano)
  modelo/MFV_ME_EPP_original.xlsx        (entrada, não alterar)
  tools/
    xlsxpkg.py        ler/gravar pacote xlsx como dict {parte: bytes}
    refs.py           converter colunas, deslocar referências em fórmulas
    inserir.py        inserir colunas em sheet + drawing + chart
    blocos.py         replicar bloco de processo, tabela OP×T/C×TKT
    formulas.py       nomes definidos, fórmulas em minutos, nomes das formas, mapa.json
    construir_modelo.py  CLI que encadeia tudo → app/modelo/
    tests/test_*.py
  app/
    index.html  app.css  manifest.webmanifest  sw.js  icones/
    vendor/jszip.min.js
    modelo/MFV_12P.xlsx  modelo/mapa.json
    js/unidades.js  js/cronoanalise.js  js/calculo.js
    js/xlsx.js  js/db.js  js/modelo.js  js/app.js  js/telas/*.js
  tests/
    fixtures/mfv_exemplo.json  fixtures/mfv_3proc.json
    unit/*.test.mjs     e2e/*.spec.mjs    lo_recalc.py
  package.json
```

## Geometria da planilha original (aba `MFV EP`, colunas 1-based)

- Bloco do processo k (k = 0…7, A…H) ocupa as colunas `8+6k … 13+6k`. Dentro do bloco: estoque antes em col `8+6k` (mesclado com `9+6k`, linhas 37/38/43); nome em col `11+6k` linha 33; operadores col `12+6k` linha 34; T/C, T/R, DISP em col `12+6k` linhas 37/38/39 (rótulos na col `11+6k`, unidade na col `13+6k`); Lead Time do estoque linha 43; T/C na linha do TAV linha 45.
- Imagens (drawing1, `from.col` 0-based): triângulo de estoque em `7+6k` linha 32; caixa de processo em `10+6k` linha 33. Triângulo final (antes da expedição) em 55.
- Estoque final: col 56 (`BD`); `EXPEDIÇÃO` col 59 (`BG`); resumos `BG41:BI45`; Dados de Produção `BO46:CE52`; tabela do gráfico `A51:C60`; gráfico em `xl/charts/chart1.xml` (`A52:A59`, `B52:B59`, `C52:C60`).

---

### Task 1: Pacote xlsx e deslocamento de referências

**Files:**
- Create: `tools/xlsxpkg.py`, `tools/refs.py`, `tools/tests/test_refs.py`, `tools/tests/test_xlsxpkg.py`
- Create: repositório git em `/home/user/mfv-app` com `.gitignore` (`node_modules/`, `__pycache__/`, `*.pyc`, `out/`)

**Interfaces:**
- Produces:
  - `xlsxpkg.ler(caminho: str) -> dict[str, bytes]`; `xlsxpkg.gravar(partes: dict[str, bytes], caminho: str) -> None` (mantém a ordem original das partes; `[Content_Types].xml` primeiro).
  - `refs.col_num(letras: str) -> int` (1-based), `refs.col_letras(n: int) -> str`.
  - `refs.deslocar_formula(f: str, a_partir_col: int, n: int) -> str` — soma `n` a toda referência de coluna `>= a_partir_col`, preservando `$`, ignorando texto entre aspas e referências qualificadas com outra aba (`'X'!A1`, `X!A1`).
  - `refs.transladar_formula(f: str, dcol: int) -> str` — move referências **relativas** de coluna em `dcol` (as com `$` na coluna ficam).

- [ ] **Step 1: Escrever testes**

```python
def test_col():           assert refs.col_num("BG")==59 and refs.col_letras(83)=="CE"
def test_deslocar():
    assert refs.deslocar_formula("=((BD37)/($BI$15/21))",56,24)=="=((CB37)/($CG$15/21))"
    assert refs.deslocar_formula("=SUM(H43,N43,BD43)",56,24)=="=SUM(H43,N43,CB43)"
    assert refs.deslocar_formula('=IF(A1="BD1";1;0)',56,24)=='=IF(A1="BD1";1;0)'
    assert refs.deslocar_formula("=SIGLAS!BD1",56,24)=="=SIGLAS!BD1"
    assert refs.deslocar_formula("=SUM(CB48:CB50)",56,24)=="=SUM(CZ48:CZ50)"
def test_transladar():
    assert refs.transladar_formula("=((AX37)/($BI$15/21))",6)=="=((BD37)/($BI$15/21))"
    assert refs.transladar_formula("=AT37",6)=="=AZ37"
def test_pacote_roundtrip(tmp_path):  # ler + gravar o original → mesmas partes e bytes
```

- [ ] **Step 2: Rodar** `cd tools && python3 -m unittest discover -s tests -v` → FAIL (módulos inexistentes)
- [ ] **Step 3: Implementar** com regex de referência `(\$?)([A-Z]{1,3})(\$?)(\d+)` aplicada apenas fora de literais de string e sem prefixo `!`; funções de nome de função (ex. `SUM(`) não casam porque exigem dígito.
- [ ] **Step 4: Rodar** → PASS
- [ ] **Step 5: Commit** `feat(tools): pacote xlsx e deslocamento de referências`

---

### Task 2: Inserir 24 colunas antes do estoque final

**Files:**
- Create: `tools/inserir.py`, `tools/tests/test_inserir.py`

**Interfaces:**
- Consumes: Task 1.
- Produces: `inserir.inserir_colunas(partes: dict, aba_xml: str, desenho_xml: str, grafico_xml: str, a_partir_col: int, n: int) -> dict` — devolve partes novas onde, na aba: `<c r>` e `<row spans>` deslocados, fórmulas via `deslocar_formula`, `<mergeCell>`, `<dimension>`, `<cols>` (as colunas inseridas herdam a largura das colunas `50…55` repetidas 4×), `<conditionalFormatting sqref>`, `<dataValidation sqref>` e `definedNames`/`Print_Area` do `workbook.xml` deslocados; no desenho: `from.col` (e `to.col`, quando houver) `>= a_partir_col-1` (0-based) recebem `+n`; no gráfico: fórmulas `c:f` deslocadas.
- Regra do fluxo superior (formas com `from.row < 30`): âncoras com `from.col >= 55` (0-based) deslocam `+24`; formas cujo `from.col` está em `40…54` também deslocam `+24` (rótulos e setas do lado do cliente); conectores horizontais cujo intervalo atravessa a coluna 55 têm `a:ext cx` (e o `xdr:ext cx` do grupo) aumentado pela soma das larguras EMU das 24 colunas inseridas.

- [ ] **Step 1: Testes** (sobre o original, `a_partir_col=56, n=24`, lendo o resultado com lxml):
  - célula `CE33` contém `EXPEDIÇÃO`; `CB37` = 65; `BD37` vazio.
  - fórmula de `CB43` == `=((CB37)/($CG$15/21))`; `CF43` (antes `BH43`) contém `CB43`.
  - mesclagem `CB37:CC37` existe; `BD37:BE37` não.
  - imagem que estava em `from.col=55` está em `79`; grupo "Distribuidores…" (col 59) está em 83.
  - `chart1.xml` continua com `A52:A59` (coluna A não desloca).
  - a planilha resultante abre no LibreOffice sem erro: `soffice --headless --convert-to pdf` retorna 0.
- [ ] **Step 2: Rodar** → FAIL
- [ ] **Step 3: Implementar** `inserir_colunas`.
- [ ] **Step 4: Rodar** → PASS
- [ ] **Step 5: Commit** `feat(tools): inserção de colunas preservando desenho e gráfico`

---

### Task 3: Replicar o bloco H em I–L e estender a tabela do gráfico

**Files:**
- Create: `tools/blocos.py`, `tools/tests/test_blocos.py`

**Interfaces:**
- Consumes: Tasks 1–2 (partes já com 24 colunas inseridas).
- Produces: `blocos.replicar_blocos(partes: dict, origem_k: int = 7, destinos: list[int] = [8,9,10,11]) -> dict`:
  - copia cada célula das colunas `50…55` (bloco k=7), linhas 32–45, para `50+6m … 55+6m` (m = destino−7), com o mesmo `s` (estilo) e fórmula transladada por `transladar_formula(f, 6m)`; copia mesclagens do bloco com deslocamento; rótulos `PROC. I`…`PROC. L` na linha 33.
  - clona as âncoras das duas imagens do bloco 7 (triângulo `from.col 49`, caixa `52`) para `49+6m` / `52+6m`, com `cNvPr id` únicos.
  - tabela `A51:C63` (linhas 52–63 = processos 1–12; A = nome, B = T/C, C = Takt) e séries do gráfico reapontadas para `A52:A63`, `B52:B63`, `C52:C63`.

- [ ] **Step 1: Testes:** nome do bloco k fica em col `11+6k` → `BG33=="PROC. I"`, `BS33=="PROC. K"`, `BY33=="PROC. L"`; T/C em col `12+6k` → `BZ37` (k=11) existe com estilo igual ao de `BB37`; 12 caixas de processo e 13 triângulos no desenho; `chart1.xml` contém `$A$52:$A$63`; abre no LibreOffice.
- [ ] **Step 2: Rodar** → FAIL
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** → PASS
- [ ] **Step 5: Commit** `feat(tools): mapa com 12 blocos de processo`

---

### Task 4: Fórmulas em minutos, nomes definidos, formas nomeadas e `mapa.json`

**Files:**
- Create: `tools/formulas.py`, `tools/construir_modelo.py`, `tools/tests/test_formulas.py`, `tests/lo_recalc.py`
- Output: `app/modelo/MFV_12P.xlsx`, `app/modelo/mapa.json`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - Nomes definidos no `workbook.xml` (aba `MFV EP`): `DEMANDA` (era `BI15`), `DIAS_MES` (era `BP52`), `DISP_FAMILIA` (era `BV52`), `HORAS_DIA` (era `CE51`), `DEMANDA_DIA` (era `BS52`), `TAKT` (era `BY52`) — endereços já deslocados.
  - Fórmulas reescritas: `DEMANDA_DIA = DEMANDA/DIAS_MES`; `TAKT = HORAS_DIA*DISP_FAMILIA*60/DEMANDA_DIA` (min/unid); Lead Time de cada estoque `=IF(est="","",est/DEMANDA_DIA)`; TAV de cada bloco `=IF(tc="","",tc)`; somas de Lead Time (13 estoques) e TAV (12 T/C) com `SUM` (ignora `""`); tabela do gráfico `=IF(nome="",NA(),…)` só para B e C, A = `=IF(nome="","",nome)`.
  - Unidades: todas as células de unidade de tempo (col `13+6k` linhas 37/38/45, `BZ52` → "min/unid") viram texto `min`; células de unidade de estoque/demanda recebem a unidade do cabeçalho (escrita pelo app).
  - `workbook.xml`: `<calcPr fullCalcOnLoad="1"/>`; `xl/calcChain.xml` removido (e sua entrada em `[Content_Types].xml` e rels).
  - Formas de texto renomeadas (`xdr:cNvPr/@name`) para: `MFV_FORNECEDOR` ("Fornecedores de Fardos de fibras"), `MFV_ENTREGA_FORNECEDOR` ("Quarta e sexta"), `MFV_PCP_SISTEMA` ("MRP+EXCEL"; o rótulo "CONTROLE DE PRODUÇÃO" permanece), `MFV_PREVISAO_FORNECEDOR` ("Previsão 4 semannas"), `MFV_PEDIDO_FORNECEDOR` ("E-mail semanal"), `MFV_CLIENTE` ("Distribuidores, Varejo e Atacado"), `MFV_PREVISAO_CLIENTE` ("Previsão 30/60 dias"), `MFV_PEDIDO_CLIENTE` ("Pedidos diários"), `MFV_ENTREGA_CLIENTE` ("1 x semana"), `MFV_PROG_PRODUCAO` ("Programação diária"), `MFV_PROG_EXPEDICAO` ("Programação semanal de entregas"). Imagens: `MFV_P{k}_CAIXA`, `MFV_P{k}_ESTOQUE` (k = 1…12), `MFV_ESTOQUE_FINAL`.
  - `mapa.json`:
    ```json
    { "aba": "xl/worksheets/sheet1.xml", "desenho": "xl/drawings/drawing1.xml",
      "processos": [ { "nome": "K33", "operadores": "L34", "tc": "L37", "tr": "L38",
                       "disp": "L39", "estoque": "H37", "unid_estoque": "I37" }, … 12 ],
      "estoque_final": "…", "unid_estoque_final": "…",
      "producao": { "demanda": "…", "unid_demanda": "…", "dias_mes": "…", "disp_familia": "…",
                    "turnos": [ { "dias": ["…6 células S T Q Q S S"], "entrada": "…", "pausa_m": "…",
                                  "refeicao": "…", "pausa_t": "…", "saida": "…" }, … 3 ] },
      "cabecalho": { "cliente": "…", "produto": "…", "data": "…", "consultor": "…" },
      "formas": { "fornecedor": "MFV_FORNECEDOR", … 11 },
      "imagens_bloco": { "caixa": "MFV_P{k}_CAIXA", "estoque": "MFV_P{k}_ESTOQUE" } }
    ```
    Cabeçalho: 4 células novas na linha 1 a partir de `K1` (rótulo em K, valor em M; K1 Cliente, K2 Produto/família, K3 Data, K4 Consultor), se livres; caso estejam ocupadas pelo desenho, usar linhas 26–29 da coluna A.
  - `tests/lo_recalc.py <xlsx> <saida.csv>`: converte com LibreOffice headless para CSV da primeira aba (recalculando) e `ler_celula(csv, "B52") -> str`.
- Os valores de exemplo das células de entrada são **apagados** no modelo final (o modelo sai em branco).

- [ ] **Step 1: Testes** (`test_formulas.py`):
  - `mapa.json` tem 12 processos e endereços consistentes com a geometria (`processos[11].nome == col_letras(11+6*11)+"33"`).
  - Todas as 11 formas `MFV_*` e 25 imagens nomeadas existem no desenho.
  - Nenhum texto do exemplo (`Fardos`, `Distribuidores`, `MRP`, `semanal`, `Quarta`) aparece no desenho do modelo.
  - Preenchendo o modelo (via `openpyxl` só para valores, em cópia temporária — teste apenas) com os dados de exemplo em minutos e recalculando com `lo_recalc`: `TAKT ≈ 1,1184` (±0,0005); Lead Time total `≈ 3,856` d (964 / 250); TAV `≈ 8,275` min; nenhuma célula do intervalo do mapa contém `#`.
  - `workbook.xml` tem `fullCalcOnLoad="1"`; `xl/calcChain.xml` ausente.
- [ ] **Step 2: Rodar** → FAIL
- [ ] **Step 3: Implementar** `formulas.py` e `construir_modelo.py` (`python3 tools/construir_modelo.py modelo/MFV_ME_EPP_original.xlsx app/modelo/`).
- [ ] **Step 4: Rodar** → PASS; gerar PNG do modelo preenchido (`soffice --convert-to pdf` + `pdftoppm`) e **inspecionar visualmente** o mapa: 12 blocos alinhados, cliente e setas do lado direito conectados, linha do tempo contínua.
- [ ] **Step 5: Commit** `feat(tools): modelo 12 processos em minutos + mapa.json`

---

### Task 5: Domínio do app — unidades, cronoanálise, cálculos

**Files:**
- Create: `package.json` (`"type":"module"`, scripts `test:unit` = `node --test tests/unit/`, devDependency `jszip@3.10.1`), `app/js/unidades.js`, `app/js/cronoanalise.js`, `app/js/calculo.js`, `tests/unit/dominio.test.mjs`, `tests/fixtures/mfv_exemplo.json`, `tests/fixtures/mfv_3proc.json`

**Interfaces:**
- Produces (modelo de dados, usado por todas as tasks seguintes):
  ```
  Leitura  { seg:number, descartada:boolean, motivo:string, confirmada:boolean, motivoConfirmacao:string }
  Tarefa   { id, nome, leituras:Leitura[] }
  TR       { modo:'cronometrado'|'informado'|'nao_aplica', leituras:Leitura[], valor:number|null, unidade:'seg'|'min'|'h' }
  Processo { id, nome, operadores, postosParalelo=1, qtdPorCiclo=1, unidadeCiclo, conversao=1,
             disponibilidade /*%*/, estoqueAntes:number|null, tarefas:Tarefa[], tr:TR }
  Turno    { dias:boolean[6] /*S T Q Q S S*/, entrada, pausaM, refeicao, pausaT, saida /*"HH:MM"*/ }
  Mfv      { id, criadoEm, atualizadoEm,
             cabecalho:{cliente, produto, data /*AAAA-MM-DD*/, consultor, unidade /*kg, peças…*/},
             producao:{demandaMensal, diasMes, dispFamilia /*0–1*/, turnos:Turno[] /*1–3*/},
             fluxos:{fornecedor, entregaFornecedor, pcpSistema, previsaoFornecedor, pedidoFornecedor,
                     cliente, previsaoCliente, pedidoCliente, entregaCliente, progProducao, progExpedicao},
             processos:Processo[] /*≤12*/, estoqueFinal:number|null }
  ```
  - `unidades.paraMin(valor: number|string, unidade: 'seg'|'min'|'h') -> number` (aceita vírgula decimal).
  - `unidades.hhmmParaMin(s: string) -> number`.
  - `cronoanalise.estatisticas(leituras) -> {validas:number, minSeg, mediaSeg, maxSeg, completa:boolean, discrepante:boolean}`; `discrepante` = `minSeg < 0,8 × mediaSeg`.
  - `calculo.tcCronometradoMin(p) -> number|null` (soma dos mínimos; null se alguma tarefa incompleta ou sem tarefas).
  - `calculo.tcEfetivoMin(p) -> number|null`.
  - `calculo.trMin(p) -> number|null` (`nao_aplica` → 0; `informado` → `paraMin`; `cronometrado` → min das válidas se completa).
  - `calculo.horasDia(turnos) -> number` (média ponderada por dias, como `CC52/3600` da planilha).
  - `calculo.taktMin(mfv) -> number|null`; `calculo.leadTimeDias(mfv)`; `calculo.tavMin(mfv)`; `calculo.gargalo(mfv) -> índice do maior T/C efetivo`.
  - `calculo.pendencias(mfv) -> string[]` (mensagens em português: tarefa com <3 leituras, processo sem T/R, campos obrigatórios vazios).
- Fixtures: `mfv_exemplo.json` reproduz a planilha original (8 processos, 1 tarefa cada com 3 leituras cujo mínimo é o T/C original em segundos; T/R em min: 0,19; 9; 19,8; 0,87; 0,5; 1; 13,8; 0,44; estoques 91…65; demanda 5000 kg, 20 dias, disp. 0,6; turnos S-T-Q-Q 07:30–17:00 com pausa 00:14 e refeição 01:30, e S 07:30–17:00 idem). `mfv_3proc.json`: 3 processos, cliente `Padaria São José & Cia "Teste" <1>`.

- [ ] **Step 1: Testes** (`dominio.test.mjs`): `paraMin("0,33","h")===19.8`; `paraMin(52,"seg")≈0.8667`; leituras `[60,62,70]` → min 60, completa; `[60,62]` → incompleta; `[40,62,70]` → discrepante (40 < 0,8×57,33); leitura descartada não conta; tarefas `[0,28 min, 0,69, 0,38]` → T/C 1,35; T/C 2,4 min, qtdPorCiclo 2, conversao 1, postos 2 → 0,6; `horasDia(exemplo)≈7,7667`; `taktMin(exemplo)≈1,1184`; `leadTimeDias(exemplo)≈3,856`; `tavMin(exemplo)≈8,275`; `pendencias` aponta tarefa com 2 leituras; 13º processo → `calculo.podeAdicionarProcesso(mfv)===false`.
- [ ] **Step 2: Rodar** `npm run test:unit` → FAIL
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** → PASS
- [ ] **Step 5: Commit** `feat(app): domínio de cronoanálise e cálculos`

---

### Task 6: Gerador do `.xlsx`

**Files:**
- Create: `app/js/xlsx.js`, `app/vendor/jszip.min.js` (copiado de `node_modules/jszip/dist/`), `tests/unit/xlsx.test.mjs`, `tests/unit/gerar_para_lo.mjs`, `tests/test_xlsx_lo.py`

**Interfaces:**
- Consumes: `mapa.json`, modelo (Task 4), domínio (Task 5).
- Produces: `xlsx.gerarPlanilha(JSZip, modeloBuf: ArrayBuffer|Uint8Array, mapa: object, mfv: Mfv) -> Promise<Uint8Array>` e `xlsx.nomeArquivo(mfv) -> string`.
  - Escreve números como `<v>` e textos como `t="inlineStr"`, mantendo o atributo `s` da célula; escapa XML.
  - Processos 1…N: nome, operadores, `tcEfetivoMin`, `trMin`, disponibilidade, estoque, unidade; processos N+1…12: células de entrada vazias e âncoras `MFV_P{k}_CAIXA` / `MFV_P{k}_ESTOQUE` (k > N) removidas do desenho (o triângulo k = N+1 também sai; o estoque final usa `MFV_ESTOQUE_FINAL`).
  - Formas `MFV_*`: substitui o texto de todos os `a:t` da forma pelo valor do campo (primeiro `a:r` recebe o texto, demais `a:r` removidos, preservando `a:rPr`); vazio → `""`.
  - Remove `<v>` de toda célula com `<f>` na aba.
  - Acrescenta a aba `CRONOANÁLISE` (nova `xl/worksheets/sheetN.xml`, entradas em `workbook.xml`, `workbook.xml.rels`, `[Content_Types].xml`) com cabeçalho: `Processo | Tarefa/T/R | L1…Ln (seg) | Descartes (motivo) | Mín (min) | Média (min) | Máx (min) | Adotado (min) | Discrepância confirmada (motivo) | Origem | Unidade original | Qtd/ciclo | Conversão | Postos paralelos | T/C cronometrado (min) | T/C efetivo (min)`.
  - `nomeArquivo` → `MFV_<cliente normalizado>_<data>.xlsx`.

- [ ] **Step 1: Testes** (`xlsx.test.mjs`, com o JSZip do npm): gerar com `mfv_exemplo` e verificar no XML: `L37` ≈ 0,8667; `K33` = nome do 1º processo; desenho sem `Fardos`/`Distribuidores` e com o fornecedor da fixture; com `mfv_3proc`: só 3 caixas + 4 triângulos (3 + final) no desenho, nome com `&`/`<`/`"` presente e XML válido (re-parse com `DOMParser` do `@xmldom/xmldom` — devDependency); nenhuma célula com `<f>` tem `<v>`; `workbook.xml` lista `CRONOANÁLISE`; `nomeArquivo(mfv_3proc)` === `MFV_Padaria_Sao_Jose_Cia_Teste_1_<data>.xlsx`.
- [ ] **Step 2: Teste de ponta a ponta** (`tests/test_xlsx_lo.py`): `node tests/unit/gerar_para_lo.mjs <fixture> out/x.xlsx`, `lo_recalc` → exemplo: TAKT ≈ 1,1184, Lead Time ≈ 3,856, TAV ≈ 8,275; 3proc: nenhuma célula com `#` na aba e TAV = soma dos 3 T/C efetivos.
- [ ] **Step 3: Rodar** → FAIL; **implementar**; **rodar** → PASS.
- [ ] **Step 4: Commit** `feat(app): gerador da planilha preenchida`

---

### Task 7: Persistência (IndexedDB) e backup

**Files:**
- Create: `app/js/db.js`, `app/js/modelo.js`, `tests/unit/modelo.test.mjs`

**Interfaces:**
- Produces:
  - `db.listar() -> Promise<Mfv[]>`, `db.obter(id)`, `db.salvar(mfv)` (atualiza `atualizadoEm`), `db.excluir(id)` — base `mfv-gemba`, store `mfvs`, keyPath `id`.
  - `modelo.novoMfv() -> Mfv` (1 turno com dias e horários vazios; todos os campos numéricos `null`; `processos` vazio), `modelo.novoProcesso(indice) -> Processo` (nome `PROC. A`…), `modelo.novaTarefa(nome)`, `modelo.exportarBackup(mfvs) -> string` (JSON com `versao:1`), `modelo.importarBackup(json) -> Mfv[]` (rejeita versão desconhecida com erro em português).
- [ ] **Step 1: Testes** (`modelo.test.mjs`): `novoProcesso(11).nome === "PROC. L"`; backup ida-e-volta igual; importar `{versao:99}` lança erro.
- [ ] **Step 2: Rodar** → FAIL; **implementar**; **rodar** → PASS. (`db.js` é coberto pelo e2e da Task 8.)
- [ ] **Step 3: Commit** `feat(app): persistência local e backup`

---

### Task 8: Telas do app

**Files:**
- Create: `app/index.html`, `app/app.css`, `app/js/app.js` (roteador por hash), `app/js/telas/lista.js`, `cabecalho.js`, `producao.js`, `fluxos.js`, `processos.js`, `processo.js`, `cronometro.js`, `resumo.js`, `gerar.js`; `tests/e2e/fluxo.spec.mjs`, `playwright.config.mjs` (`webServer`: `npx http-server app -p 4173 -c-1`, devDependency `http-server`; projeto mobile `Pixel 7`)

**Interfaces:**
- Consumes: Tasks 5–7. Rotas: `#/`, `#/mfv/:id/cabecalho`, `/producao`, `/fluxos`, `/processos`, `/processo/:pid`, `/processo/:pid/tarefa/:tid`, `/processo/:pid/tr`, `/resumo`, `/gerar`.
- Comportamento fixado pela spec:
  - Toda alteração chama `db.salvar` imediatamente (sem botão "salvar").
  - Cronômetro: botão único ≥ 72 px alterna **Iniciar/Parar**; cada parada grava uma leitura e salva; lista L1…Ln com toque longo/botão "descartar" + motivo opcional; mostra mín/média/máx e status "incompleta (x/3)"; ao parar uma leitura que torna a tarefa discrepante, abre confirmação "A menor leitura está mais de 20% abaixo da média. Confirmar?" com **Confirmar** (pede motivo opcional, marca `confirmada`) / **Descartar leitura**.
  - Entradas de tempo manual com seletor `seg | min | h` (padrão `min`); campos numéricos com `inputmode="decimal"`.
  - Processos: adicionar (bloqueado no 13º com aviso "Máximo de 12 processos. Acima disso, tratar fora do app."), remover, mover ↑/↓.
  - Produção: Takt ao vivo; Resumo: Lead Time, TAV, Takt, barras T/C efetivo × Takt com gargalo destacado e lista de pendências.
  - Gerar: busca `modelo/MFV_12P.xlsx` e `mapa.json`, chama `gerarPlanilha`; usa `navigator.share({files})` quando `navigator.canShare` aceitar, senão download por `<a download>`. Pendências mostradas com opção "Gerar mesmo assim".
- [ ] **Step 1: Teste e2e** (`fluxo.spec.mjs`): criar MFV, cliente "Teste", 1 turno, demanda 5000, 20 dias, disp 60%; processo com 1 tarefa e 3 leituras (usar `page.clock` para controlar o tempo: 60 s, 62 s, 70 s); T/R informado 0,5 h; recarregar a página no meio → leituras mantidas; tentar 13º processo → aviso; gerar → download com nome `MFV_Teste_<hoje>.xlsx` e, aberto com JSZip no teste, `L37` = 1.
- [ ] **Step 2: Rodar** `npx playwright test --trace off` → FAIL; **implementar telas**; **rodar** → PASS.
- [ ] **Step 3: Captura de tela** de cada tela no Pixel 7 em `out/telas/` para revisão do usuário.
- [ ] **Step 4: Commit** `feat(app): telas de coleta, cronômetro, resumo e geração`

---

### Task 9: PWA offline

**Files:**
- Create: `app/manifest.webmanifest` (`name` "MFV Gemba", `display` "standalone", `start_url` "./", ícones 192/512), `app/icones/*.png`, `app/sw.js` (cache `mfv-gemba-v1` com todos os arquivos de `app/`, inclusive `modelo/*` e `vendor/*`; estratégia cache-first; limpa caches antigos no `activate`), registro no `app.js`; `tests/e2e/offline.spec.mjs`
- [ ] **Step 1: Teste:** carregar, aguardar `navigator.serviceWorker.ready`, `context.setOffline(true)`, recarregar → app abre, cria MFV e gera planilha offline.
- [ ] **Step 2: Rodar** → FAIL; **implementar**; **rodar** → PASS.
- [ ] **Step 3: Commit** `feat(app): funcionamento offline e instalação`

---

### Task 10: Publicação no GitHub Pages (requer ação do usuário)

- [ ] **Step 1:** Usuário cria no GitHub um repositório vazio (sugestão: `mfv-gemba`) e informa o nome.
- [ ] **Step 2:** Anexar o repositório à sessão (`add_repo`, acesso `push`), adicionar `.github/workflows/pages.yml` que publica a pasta `app/` no Pages a cada push em `main`, e enviar.
- [ ] **Step 3:** Habilitar Pages (fonte: GitHub Actions); conferir a URL `https://<usuario>.github.io/mfv-gemba/` abrindo no Playwright e rodando o fluxo do Step 1 da Task 9 contra ela.
- [ ] **Step 4:** Entregar ao usuário: URL, instruções para "Adicionar à tela inicial" (Android/Chrome e iPhone/Safari) e um guia de 1 página de uso no Gemba.
