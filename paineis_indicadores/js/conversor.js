/* =====================================================================
   CONVERSOR: planilha (.xlsx/.csv) -> estrutura de dados do sistema
   O MESMO código roda no navegador (página "Atualizar dados") e no
   Node (ferramentas/gerar_dados.js), garantindo o mesmo resultado.
   ===================================================================== */
(function (g) {
  "use strict";

  /* Campos mensais, na ordem em que ficam gravados em cada registro. */
  var CAMPOS = ["meta", "tecMin", "tecDes", "eduMin", "eduVal", "equipe",
    "visit", "acomp", "criAcomp", "criVisit", "gestAcomp", "fixa", "variavel",
    "saldo", "teto", "bloq", "susp", "acompPct", "executado", "ajuste",
    "pago", "aAjustar", "status"];

  var STATUS = ["OK", "Pago a mais", "Pago a menos"];
  var PORTES = ["PEQUENO I", "PEQUENO II", "MÉDIO", "GRANDE", "METRÓPOLE"];

  function norm(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toUpperCase().replace(/\s+/g, " ").trim();
  }

  /* Número: aceita 1234.5, "1.234,56", "R$ 10", vazio, "." etc. */
  function num(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    var s = String(v).replace(/R\$|\s|%/g, "");
    if (!/\d/.test(s)) return null;
    if (s.indexOf(",") > -1) s = s.replace(/\./g, "").replace(",", ".");
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function simNao(v) {
    var s = norm(v);
    if (s === "SIM" || s === "S" || s === "1") return 1;
    if (s === "NAO" || s === "N" || s === "0") return 0;
    return null;
  }

  function statusCod(v) {
    var s = norm(v);
    if (s === "OK") return 0;
    if (s.indexOf("MAIS") > -1) return 1;
    if (s.indexOf("MENOS") > -1) return 2;
    return null;
  }

  function porte(v) {
    var s = norm(v);
    for (var i = 0; i < PORTES.length; i++) if (norm(PORTES[i]) === s) return PORTES[i];
    return v ? String(v).trim().toUpperCase() : "";
  }

  /* Data -> "AAAA-MM". Aceita serial do Excel, Date, "2025-01-01",
     "01/01/2025", "01/2025", "jan/2025".                              */
  var MESES_TXT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function mesRef(v, XLSX) {
    if (v == null || v === "") return null;
    if (typeof v === "number" && XLSX) {
      var d = XLSX.SSF.parse_date_code(v);
      return d ? d.y + "-" + pad(d.m) : null;
    }
    if (v instanceof Date) return v.getFullYear() + "-" + pad(v.getMonth() + 1);
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})/))) return m[1] + "-" + pad(+m[2]);
    if ((m = s.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/))) return m[2] + "-" + pad(+m[1]);
    if ((m = s.match(/^(\d{1,2})\/(\d{4})$/))) return m[2] + "-" + pad(+m[1]);
    if ((m = norm(s).match(/^([A-Z]{3})[A-Z]*[\/\- ](\d{4})$/))) {
      var i = MESES_TXT.indexOf(m[1]);
      if (i > -1) return m[2] + "-" + pad(i + 1);
    }
    return null;
  }
  function dataISO(v, XLSX) {
    if (v == null || v === "") return null;
    if (typeof v === "number" && XLSX) {
      var d = XLSX.SSF.parse_date_code(v);
      return d ? d.y + "-" + pad(d.m) + "-" + pad(d.d) : null;
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[0];
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + "-" + pad(+m[2]) + "-" + pad(+m[1]);
    return null;
  }

  /* -------------------------------------------------------------
     linhas: array de arrays (1ª linha = cabeçalho)
     retorna { dados, avisos } ou lança Error com mensagem clara
     ------------------------------------------------------------- */
  function converterLinhas(linhas, config, XLSX, nomeArquivo) {
    if (!linhas || linhas.length < 2) throw new Error("A planilha está vazia ou só tem cabeçalho.");

    // localizar a linha de cabeçalho (procura CO_IBGE nas 10 primeiras)
    var alvoIbge = norm(config.colunas.ibge), hIdx = -1;
    for (var h = 0; h < Math.min(10, linhas.length); h++) {
      if ((linhas[h] || []).some(function (c) { return norm(c) === alvoIbge; })) { hIdx = h; break; }
    }
    if (hIdx < 0) throw new Error("Não encontrei a coluna \"" + config.colunas.ibge + "\" no cabeçalho.");

    var cab = linhas[hIdx].map(norm), pos = {}, faltando = [], avisos = [];
    Object.keys(config.colunas).forEach(function (k) {
      pos[k] = cab.indexOf(norm(config.colunas[k]));
      if (pos[k] < 0) {
        if (config.obrigatorias.indexOf(k) > -1) faltando.push(config.colunas[k]);
        else avisos.push("Coluna ausente (ficará em branco): " + config.colunas[k]);
      }
    });
    if (faltando.length) throw new Error("Colunas obrigatórias ausentes: " + faltando.join(", "));

    function get(row, k) { return pos[k] < 0 ? null : row[pos[k]]; }

    var municipios = {}, regs = [], descartadas = 0, chaves = {}, duplicadas = 0;

    for (var i = hIdx + 1; i < linhas.length; i++) {
      var r = linhas[i];
      if (!r || !r.length) continue;
      var ibge = num(get(r, "ibge"));
      var mes = mesRef(get(r, "mes"), XLSX);
      if (!ibge || !mes) { if (r.some(function (c) { return c != null && c !== ""; })) descartadas++; continue; }
      ibge = Math.round(ibge);

      var chave = ibge + "|" + mes;
      if (chaves[chave] != null) { duplicadas++; }

      var m = municipios[ibge] || (municipios[ibge] = { ibge: ibge });
      // guarda os dados cadastrais do mês mais recente
      if (!m._mes || mes >= m._mes) {
        m._mes = mes;
        m.uf = String(get(r, "uf") || "").trim().toUpperCase();
        m.nome = String(get(r, "nome") || "").trim().toUpperCase();
        m.porte = porte(get(r, "porte"));
        m.adesao = dataISO(get(r, "adesao"), XLSX);
        m.etapa = String(get(r, "etapa") || "").trim();
      }

      var reg = { ibge: ibge, mes: mes };
      CAMPOS.forEach(function (k) {
        var v = get(r, k);
        if (k === "equipe" || k === "bloq" || k === "susp") reg[k] = simNao(v);
        else if (k === "status") reg[k] = statusCod(v);
        else reg[k] = num(v);
      });
      if (chaves[chave] != null) regs[chaves[chave]] = reg; // duplicada: vale a última
      else { chaves[chave] = regs.length; regs.push(reg); }
    }

    if (!regs.length) throw new Error("Nenhuma linha válida (com CO_IBGE e DT_REFERENCIA) encontrada.");
    if (descartadas) avisos.push(descartadas + " linha(s) sem código IBGE ou mês de referência foram ignoradas.");
    if (duplicadas) avisos.push(duplicadas + " linha(s) repetidas (mesmo município e mês): mantida a última.");

    return { dados: montar(municipios, regs, nomeArquivo), avisos: avisos };
  }

  /* Monta a estrutura compacta que é gravada em dados.js */
  function montar(municipiosObj, regs, fonte) {
    var meses = Array.from(new Set(regs.map(function (r) { return r.mes; }))).sort();
    var lista = Object.keys(municipiosObj).map(function (k) {
      var m = municipiosObj[k];
      return [m.ibge, m.uf, m.nome, m.porte, m.adesao, m.etapa];
    }).sort(function (a, b) { return a[1] === b[1] ? (a[2] < b[2] ? -1 : 1) : (a[1] < b[1] ? -1 : 1); });
    var idx = {}; lista.forEach(function (m, i) { idx[m[0]] = i; });
    var mIdx = {}; meses.forEach(function (m, i) { mIdx[m] = i; });

    var registros = regs.map(function (r) {
      return [idx[r.ibge], mIdx[r.mes]].concat(CAMPOS.map(function (k) {
        var v = r[k];
        return v == null ? null : (typeof v === "number" ? Math.round(v * 100) / 100 : v);
      }));
    });
    registros.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });

    return {
      versao: 1,
      geradoEm: new Date().toISOString(),
      fonte: fonte || "",
      meses: meses,
      campos: CAMPOS,
      status: STATUS,
      municipios: lista,   // [ibge, uf, nome, porte, adesao, etapa]
      registros: registros // [idxMunicipio, idxMes, ...CAMPOS]
    };
  }

  /* Expande a estrutura compacta em objetos (para mesclar) */
  function expandir(d) {
    var municipios = {}, regs = [];
    d.municipios.forEach(function (m) {
      municipios[m[0]] = { ibge: m[0], uf: m[1], nome: m[2], porte: m[3], adesao: m[4], etapa: m[5], _mes: "" };
    });
    d.registros.forEach(function (r) {
      var o = { ibge: d.municipios[r[0]][0], mes: d.meses[r[1]] };
      d.campos.forEach(function (k, i) { o[k] = r[i + 2]; });
      regs.push(o);
      var m = municipios[o.ibge]; if (o.mes > m._mes) m._mes = o.mes;
    });
    return { municipios: municipios, regs: regs };
  }

  /* Mescla: meses presentes na planilha nova substituem os antigos;
     meses que só existem na base atual são mantidos.                 */
  function mesclar(atual, nova, fonte) {
    var a = expandir(atual), n = expandir(nova);
    var mesesNovos = {}; nova.meses.forEach(function (m) { mesesNovos[m] = 1; });
    var regs = a.regs.filter(function (r) { return !mesesNovos[r.mes]; }).concat(n.regs);
    var munis = a.municipios;
    Object.keys(n.municipios).forEach(function (k) {
      if (!munis[k] || n.municipios[k]._mes >= munis[k]._mes) munis[k] = n.municipios[k];
    });
    return montar(munis, regs, fonte);
  }

  var api = { converterLinhas: converterLinhas, mesclar: mesclar, CAMPOS: CAMPOS, norm: norm };
  g.PCF_CONVERSOR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
