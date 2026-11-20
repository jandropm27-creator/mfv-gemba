# App MFV Gemba — Documento de Design

**Data:** 20/11/2026 · **Autor do pedido:** Jandro Medeiros (consultor Brasil Mais Produtivo / SENAI-FIEC)
**Planilha de referência:** `modelo/MFV_ME_EPP_original.xlsx` (aba `MFV EP`)

---

## 1. Intenção e porquê

O consultor elabora o Mapeamento do Fluxo de Valor (MFV, estado atual) no chão de fábrica de micro e pequenas indústrias atendidas pelo Programa Brasil Mais Produtivo. Hoje ele coleta no Gemba (cronômetro + papel) e depois redigita tudo na planilha padrão `MFV EP`, que calcula Takt, Lead Time e TAV e desenha o mapa.

Queremos um **app no celular** usado durante a visita que:
1. conduza a coleta (cronometragem de tarefas, dados de processo, estoques, dados de produção);
2. gere, ao final, **a planilha padrão já preenchida**, pronta para abrir no Excel do notebook.

Ganho esperado: eliminar a redigitação, reduzir erros de transcrição e de unidade, e manter evidência da cronoanálise.

## 2. Objetivos, não-objetivos, anti-objetivos

**Objetivos**
- Coleta 100% funcional **sem internet** (o sinal no cliente existe "na maioria das vezes", não sempre).
- Cronômetro por tarefa com **mínimo de 3 leituras** (exigência do B+P).
- Geração do `.xlsx` no próprio celular, preservando formatação, fórmulas e ícones da planilha modelo.
- Até **12 processos** por mapa.
- Unidade de tempo padronizada (**minutos**) em toda a planilha.

**Não-objetivos (fora desta versão)**
- Mapa de estado futuro.
- Mais de 12 processos (o app bloqueia; caso tratado de outra forma pelo consultor).
- Sincronização automática com Google Sheets (pode virar extra futuro).
- Abas ocultas `SIGLAS`, `MATRIZ DE PRIORIZAÇÃO`, `LEAN X ISHIKAWA`: preservadas como estão, não alimentadas pelo app.
- Login, multiusuário, servidor.

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Perder dados coletados por falta de sinal, fechamento do navegador ou bateria baixa no meio da visita.
- Planilha gerada com ícones/formatação quebrados ou fórmulas sobrescritas.
- Somar tempos em unidades diferentes sem o usuário perceber (problema atual).
- Interface que exija duas mãos ou muita digitação enquanto se observa a operação.

## 3. Restrições

- Usuário único (o consultor), celular Android/iOS com navegador moderno.
- Custo zero ou quase zero de operação.
- O arquivo final precisa abrir corretamente no **Microsoft Excel** do notebook.
- Planilha padrão do consultor deve continuar reconhecível (mesma lógica e visual do MFV EP).

## 4. Abordagens consideradas

| | Abordagem | Trade-off | Decisão |
|---|---|---|---|
| **A** | **App web instalável (PWA) offline**, modelo `.xlsx` embutido; gera o arquivo preenchido no celular e compartilha (WhatsApp/e-mail/Drive) | Funciona sem sinal; arquivo idêntico ao padrão; sem custo. Exige um toque manual para enviar o arquivo. | **Escolhida pelo usuário** |
| B | App gravando direto em Google Sheets | Dados na nuvem automaticamente, mas depende de sinal, e o Sheets converte mal ícones/formatação do mapa; integração com conta Google mais complexa. | Descartada |
| C | AppSheet sobre Google Sheets | Rápido de montar, mas cronômetro multi-leitura fica ruim, limites do plano gratuito, mesmo problema de conversão do mapa. | Descartada |

## 5. Decisões já tomadas com o usuário

### 5.1 Dias trabalhados no mês — flexível
- Uma única célula de entrada (atual `BP52`, "Média dias/mês") recebe 20, 21, 22… informado no app a cada MFV.
- **Takt e Lead Time passam a usar essa mesma célula.** Hoje o Lead Time usa `21` fixo em `H43`, `N43`, `T43`… (`=estoque/($BI$15/21)`), enquanto o Takt usa `BP52` = 20. Corrigir para referenciar a célula única.

### 5.2 Unidade padrão de tempo: minutos
- Toda célula de tempo da planilha (T/C, T/R, TAV, Takt) passa a estar em **minutos**.
- No app, cada entrada manual de tempo tem seletor **seg / min / h** (padrão = min); o app converte para minutos antes de gravar. Processos longos podem ser informados em horas.
- Leituras do cronômetro são capturadas em segundos internamente e convertidas para minutos (2 casas decimais na exibição; valor completo na célula).
- Takt passa de seg/unid para **min/unid**.
- As células de unidade que hoje herdam por fórmula (`=M37`, `=AK38` etc.) passam a ser texto fixo "min".
- Onde o dado foi originalmente informado em outra unidade, registrar a unidade original na aba `CRONOANÁLISE` (ver 5.5).

### 5.3 Até 12 processos
- A aba `MFV EP` será reestruturada para **12 blocos de processo (PROC. A … L) + EXPEDIÇÃO**.
- Mapa com menos processos: blocos excedentes ficam vazios e **não entram nas somas** (Lead Time, TAV) nem geram erro (#DIV/0!, etc.).
- Ao tentar cadastrar o 13º processo, o app avisa e bloqueia.

### 5.4 Cronometragem
- Cada processo tem **N tarefas** cadastradas no Gemba pelo nome.
- Cada tarefa: cronômetro iniciar/parar com botão grande (uso com uma mão); cada parada = 1 leitura.
- **Mínimo 3 leituras válidas** por tarefa; abaixo disso a tarefa fica "incompleta" e o processo não pode ser finalizado.
- **Valor adotado = menor leitura válida** (critério do B+P).
- **T/C do processo = soma dos menores tempos de cada tarefa.**
- Tela mostra mín / média / máx por tarefa.
- Leitura pode ser descartada com um toque, com motivo opcional.
- **Alerta de discrepância (aprovado):** se a menor leitura for >20% abaixo da média das leituras válidas, o app pede confirmação (não bloqueia). O usuário confirma ou descarta; a confirmação e o motivo (opcional) ficam registrados na aba `CRONOANÁLISE`.
- **Tarefas são sempre executadas em sequência pela mesma pessoa** (confirmado) — por isso T/C = soma das tarefas.

### 5.4.1 Quantidade por ciclo e postos em paralelo (aprovado)
- Cada processo tem **"quantidade por ciclo"** (padrão = 1) e a unidade dessa quantidade (peça, lote, kg…).
- Quando a unidade do ciclo difere da unidade da demanda (ex.: ciclo em peças, demanda em kg), o processo pede o **fator de conversão** (ex.: kg por peça).
- Cada processo tem **nº de postos/operadores em paralelo** executando a mesma operação (padrão = 1). Operadores em paralelo dividem o T/C efetivo.
- **T/C efetivo (por unidade da demanda) = T/C cronometrado ÷ (quantidade por ciclo × conversão) ÷ postos em paralelo.**
- É o T/C efetivo que vai para o mapa, para a comparação com o Takt, para o destaque do gargalo e para o gráfico de balanceamento. O T/C cronometrado bruto, a quantidade por ciclo, a conversão e os postos ficam registrados na aba `CRONOANÁLISE`.
- Decisão do assistente: o campo "nº de operadores" do mapa (linha 34) continua sendo o total de pessoas no processo; "postos em paralelo" é um campo separado, pois nem sempre coincidem (ex.: 1 operador abastecendo 2 máquinas).

### 5.5 T/R (tempo de troca/setup)
- Mesmo critério (≥3 leituras, menor tempo) quando cronometrado.
- **Aprovado:** o T/R pode ser **informado pelo cliente** (valor + unidade), marcado como "informado" na aba `CRONOANÁLISE`. Um processo pode ser finalizado com T/R informado. Processo sem setup: T/R = 0 ("não se aplica").

### 5.5.1 Fluxo de informação e de material no desenho do mapa (aprovado: opção "a")
O desenho da aba `MFV EP` (`xl/drawings/drawing1.xml`) tem ~55 formas com textos do exemplo. O app **coleta e grava** esses textos, sem deixar nenhum resíduo do exemplo:
- Fornecedor(es) e matéria-prima principal (ex.: "Fardos de fibras");
- Cliente(s) / canal (ex.: "Distribuidores, Varejo e Atacado");
- Controle de produção: sistema de PCP (ex.: "MRP+EXCEL");
- Fluxo de informação cliente → PCP: tipo e frequência (ex.: "Previsão 30/60 dias", "Pedidos diários");
- Fluxo de informação PCP → fornecedor: tipo e frequência (ex.: "E-mail semanal");
- Frequência de entrega do fornecedor e para o cliente (ex.: "1 x semana", "Quarta e sexta");
- Programação para a produção (ex.: "Programação diária/semanal").
Campo deixado em branco no app = texto da forma fica vazio (nunca o texto do exemplo). O construtor faz o inventário exato das formas e as mapeia a esses campos; formas cujo texto é rótulo fixo do método (ex.: "CONTROLE DE PRODUÇÃO") permanecem.

### 5.6 Saída
- Botão "Gerar planilha": escreve os valores nas células do modelo embutido e oferece o arquivo via compartilhamento nativo do celular (Web Share API) ou download.
- Nova aba **`CRONOANÁLISE`** no arquivo gerado: processo, tarefa, cada leitura (L1…Ln), descartes e motivo, menor/média/máx, valor adotado, origem (cronometrado/informado), unidade original.
- Nome do arquivo: `MFV_<cliente>_<AAAA-MM-DD>.xlsx`.

## 6. Dados coletados (mapeamento para a planilha atual)

Referência à estrutura **atual** (8 processos; colunas de bloco a cada 6: K, Q, W, AC, AI, AO, AU, BA; expedição em BG). A versão de 12 processos segue o mesmo padrão de bloco.

| Dado | Onde é coletado no app | Célula atual (PROC. A) |
|---|---|---|
| Nome do processo | Cadastro do processo | `K33` |
| Nº de operadores | Cadastro do processo | `L34` |
| T/C | Cronometragem (soma de tarefas) | `L37` |
| T/R | Cronometragem ou informado | `L38` |
| Disponibilidade (%) | Informado | `L39` |
| Estoque antes do processo (qtde) | Informado / contado no Gemba | `H37` (unid. em `I37`) |
| Estoque antes da expedição | Informado | `BD37` |
| Demanda mensal | Dados de produção | `BI15` (unid. `BJ15`) |
| Dias da semana trabalhados por turno | Dados de produção | `BO48:BT50` |
| Entrada, pausas, refeição, saída por turno | Dados de produção | `BV48:BZ50` |
| Dias trabalhados no mês | Dados de produção | `BP52` |
| Disponibilidade da família | Dados de produção | `BV52` |
| Cliente, produto/família, data, consultor | Cabeçalho do MFV | (novo — ver Seção 8) |
| Quantidade por ciclo, unidade, conversão, postos em paralelo | Cadastro do processo | (novo — usados no T/C efetivo; ver 5.4.1) |
| Fornecedor, cliente, PCP, fluxos e frequências | Tela "Fluxos" | formas do desenho (ver 5.5.1) |

## 7. Comportamento do app

**Telas (fluxo):**
1. **Lista de MFVs** — criar novo, retomar em andamento, excluir.
2. **Cabeçalho** — cliente, produto/família, data, unidade da demanda/estoque.
3. **Dados de produção** — demanda, turnos, dias/mês, disponibilidade da família. Mostra Takt calculado ao vivo.
3b. **Fluxos** — fornecedor, cliente, PCP, fluxos de informação e frequências (5.5.1).
4. **Processos** — lista ordenada (máx. 12), reordenar, adicionar/remover.
5. **Processo** — operadores, disponibilidade, estoque antes, tarefas + cronômetro, T/R.
6. **Resumo** — Lead Time, TAV, Takt, T/C × Takt por processo (gargalo destacado), pendências (tarefas com <3 leituras).
7. **Gerar planilha**.

**Persistência:** cada ação salva imediatamente no armazenamento local do celular (IndexedDB). Fechar o app, perder sinal ou reiniciar o celular não perde dados. Botão de exportar/importar backup (JSON) para segurança.

## 8. O que fica a cargo do construtor

- Stack do PWA (recomendação: HTML/JS sem framework pesado, service worker para offline) e a biblioteca de escrita do `.xlsx`. **Requisito duro:** preservar imagens, estilos, mesclagens e fórmulas do modelo — editar o XML da planilha diretamente (ex.: JSZip) em vez de reconstruir o arquivo com uma biblioteca que perca estilos/imagens.
- Layout exato da nova aba `MFV EP` com 12 processos (posição das colunas, reposicionamento dos 17+ ícones, deslocamento do bloco "Dados de Produção"), mantendo a identidade visual atual.
- Onde colocar o cabeçalho (cliente/produto/data) na planilha.
- Fórmulas robustas a blocos vazios (ex.: `SE(célula="";"";…)`).
- Tabela A51:C60 (OP × T/C × TKT, base do gráfico de balanceamento): estender para 12 linhas e reapontar as séries do gráfico (`xl/charts/chart1.xml`, hoje `A52:A59`, `B52:B59`, `C52:C60`).
- Inventário das formas do desenho e mapeamento para os campos da 5.5.1.
- Visual do app, ícones, textos de interface.
- Testes: abrir o arquivo gerado no Excel e conferir valores/fórmulas com um caso de teste conhecido (os dados atuais da planilha servem de caso de teste).
