# Monitoramento de Pagamentos – PCF/EPCF (sistema estático)

Abre direto da pasta (duplo clique em `index.html`), sem servidor e sem internet.
Testado no Chrome/Edge.

## Estrutura

```
index.html              página única; as telas trocam pelo endereço (#/painel, #/uf/SP, #/municipio/1100023…)
css/estilo.css          visual + layout de impressão (relatórios)
js/config.js            nomes das colunas da planilha e critérios da classificação  ← o que você mais vai editar
js/conversor.js         lê a planilha e gera a base compacta (usado no navegador e no Node)
js/armazenamento.js     guarda no navegador a planilha enviada (IndexedDB) e gera o dados.js
js/base.js              carrega a base em memória, faz os cálculos e escreve as sínteses
js/componentes.js       tabela ordenável, KPIs, gráficos, exportação CSV, linha do tempo
js/paginas.js           cada tela: painel, estados, UF, município, busca, atualizar, ajuda
js/app.js               inicialização, rotas, mês de referência, busca rápida
dados/dados.js          A BASE OFICIAL (gerada a partir da planilha) – não editar à mão
lib/                    Chart.js (gráficos) e SheetJS (leitura de xlsx), locais
ferramentas/gerar_dados.js   alternativa por linha de comando (Node.js)
```

## Atualização mensal

1. Abra o sistema → **Atualizar dados**.
2. Escolha o modo:
   - **Acrescentar / atualizar meses**: planilha só com o mês novo (ou poucos meses).
   - **Substituir tudo**: planilha com o histórico completo.
3. Envie a planilha e confira o resumo (meses novos, meses substituídos, municípios que entraram/saíram, avisos).
4. **Aplicar neste navegador** → atualiza só a sua máquina.
5. **Baixar novo dados.js** → substitua `dados/dados.js` na pasta compartilhada (guarde o antigo como backup).
6. Usuários recarregam com Ctrl+F5.

Alternativa sem navegador (precisa de Node.js):
`node ferramentas/gerar_dados.js PLANILHA.xlsx`

## Se a planilha mudar

Coluna renomeada → ajuste em `js/config.js` → `colunas`. A comparação ignora acentos, maiúsculas e espaços.
Colunas obrigatórias: CO_IBGE, SG_UF, NO_MUNICIPIO, DT_REFERENCIA, VL_PAGAMENTO_AJUSTADO_FINAL.

## Classificação (critério do painel, editável em config.js)

- Crítico: bloqueio ou suspensão por 3+ meses seguidos
- Atenção: bloqueio/suspensão no mês, equipe incompleta ou acompanhamento < 50%
- Regular: nenhuma das anteriores
