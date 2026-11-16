/* =====================================================================
   CONFIGURAÇÃO DO SISTEMA
   Edite aqui: nomes de colunas aceitos, critérios da síntese e textos.
   ===================================================================== */
(function (g) {
  g.PCF_CONFIG = {
    titulo: "Monitoramento de Pagamentos – PCF/EPCF",
    subtitulo: "Consulta por estado e município",

    /* Nome da aba da planilha. Se não existir, usa a primeira aba. */
    aba: "MONITORAMENTO",

    /* Mapeamento: chave interna -> nome da coluna na planilha.
       A comparação ignora acentos, maiúsculas e espaços extras.
       Se a planilha mudar o nome de uma coluna, ajuste aqui.          */
    colunas: {
      ibge:      "CO_IBGE",
      uf:        "SG_UF",
      nome:      "NO_MUNICIPIO",
      meta:      "QT_META_ACEITA",
      etapa:     "DS_ETAPA_DE_EXECUCAO",
      mes:       "DT_REFERENCIA",
      porte:     "DS_PORTE_CIDADE",
      adesao:    "DT_ADESAO",
      tecMin:    "TÉCNICOS DE REFERÊNCIA MÍNIMO",
      tecDes:    "TÉCNICOS DE REFERÊNCIA DESIGNADO",
      eduMin:    "EDUCADORES SOCIAIS MÍNIMO",
      eduVal:    "EDUCADORES SOCIAIS VÁLIDOS PARA PAGAMENTO",
      equipe:    "EQUIPE COMPLETA",
      visit:     "VISITADOS TOTAL",
      acomp:     "ACOMPANHADOS TOTAL",
      criAcomp:  "CRIANÇAS ACOMPANHADAS",
      criVisit:  "CRIANÇAS VISITADAS",
      gestAcomp: "GESTANTES ACOMPANHADAS",
      fixa:      "VL_PARCELA_FIXA",
      variavel:  "VL_PARCELA_VARIAVEL",
      saldo:     "VL_SALDO_EM_CONTA",
      teto:      "TETO DE SALDO",
      bloq:      "ST_BLOQUEIO",
      susp:      "ST_SUSPENSAO",
      acompPct:  "ACOMPANHAMENTO %",
      executado: "VL_EXECULTADO",
      ajuste:    "AJUSTE",
      pago:      "VL_PAGAMENTO_AJUSTADO_FINAL",
      aAjustar:  "VALOR_A_SER_AJUSTADO",
      status:    "STATUS_FINAL"
    },

    /* Colunas sem as quais a importação é recusada. */
    obrigatorias: ["ibge", "uf", "nome", "mes", "pago"],

    /* Critérios da classificação da síntese (critério do painel,
       não é norma oficial — ajuste conforme a regra da equipe).       */
    criterios: {
      mesesCriticos: 3,        // bloqueio/suspensão por N meses seguidos = Crítico
      acompanhamentoBaixo: 0.5 // acompanhamento abaixo de 50% da meta = Atenção
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
