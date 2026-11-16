/* =====================================================================
   BASE DE DADOS EM MEMÓRIA + FORMATAÇÃO + SÍNTESES
   ===================================================================== */
(function (g) {
  "use strict";
  var CFG = g.PCF_CONFIG;
  var B = { dados: null, munis: [], porIbge: {}, porUF: {}, ufs: [], meses: [], origem: "oficial" };

  /* ---------- carga ---------- */
  B.carregar = function (dados, origem) {
    B.dados = dados; B.origem = origem || "oficial";
    B.meses = dados.meses.slice();
    B.munis = dados.municipios.map(function (m, i) {
      return { i: i, ibge: m[0], uf: m[1], nome: m[2], porte: m[3], adesao: m[4], etapa: m[5],
               busca: g.PCF_CONVERSOR.norm(m[2]), regs: new Array(dados.meses.length).fill(null) };
    });
    var campos = dados.campos;
    dados.registros.forEach(function (r) {
      var o = { mes: r[1] };
      for (var k = 0; k < campos.length; k++) o[campos[k]] = r[k + 2];
      B.munis[r[0]].regs[r[1]] = o;
    });
    B.porIbge = {}; B.porUF = {};
    B.munis.forEach(function (m) {
      B.porIbge[m.ibge] = m;
      (B.porUF[m.uf] = B.porUF[m.uf] || []).push(m);
      m.ultimo = -1;
      for (var j = m.regs.length - 1; j >= 0; j--) if (m.regs[j]) { m.ultimo = j; break; }
    });
    B.ufs = Object.keys(B.porUF).sort();
  };

  /* ---------- formatação ---------- */
  var fMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  var fMoeda0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  var fNum = new Intl.NumberFormat("pt-BR");
  var MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  B.fmt = {
    moeda: function (v) { return v == null ? "–" : fMoeda.format(v); },
    moedaCurta: function (v) {
      if (v == null) return "–";
      var a = Math.abs(v);
      if (a >= 1e9) return "R$ " + (v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " bi";
      if (a >= 1e6) return "R$ " + (v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " mi";
      if (a >= 1e4) return "R$ " + (v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
      return fMoeda0.format(v);
    },
    num: function (v) { return v == null ? "–" : fNum.format(v); },
    pct: function (v, casas) { return v == null || !isFinite(v) ? "–" : (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas == null ? 0 : casas }) + "%"; },
    mes: function (idxOuTxt) {
      var t = typeof idxOuTxt === "number" ? B.meses[idxOuTxt] : idxOuTxt;
      if (!t) return "–";
      return MES[+t.slice(5, 7) - 1] + "/" + t.slice(0, 4);
    },
    data: function (iso) { return iso ? iso.split("-").reverse().join("/") : "–"; },
    sn: function (v) { return v === 1 ? "Sim" : v === 0 ? "Não" : "–"; },
    status: function (c) { return c == null ? "–" : B.dados.status[c]; }
  };
  B.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  /* ---------- cálculos por município ---------- */
  B.reg = function (m, t) { return m.regs[t] || null; };

  // meses seguidos (terminando em t) com campo == 1
  B.seguidos = function (m, campo, t) {
    var n = 0;
    for (var j = t; j >= 0; j--) { var r = m.regs[j]; if (r && r[campo] === 1) n++; else break; }
    return n;
  };
  B.restrito = function (r) { return !!r && (r.bloq === 1 || r.susp === 1); };
  B.seguidosRestricao = function (m, t) {
    var n = 0;
    for (var j = t; j >= 0; j--) { if (B.restrito(m.regs[j])) n++; else break; }
    return n;
  };

  /* Classificação do painel (ver critérios em config.js) */
  B.classe = function (m, t) {
    var r = m.regs[t];
    if (!r) return "sem";
    if (B.restrito(r) && B.seguidosRestricao(m, t) >= CFG.criterios.mesesCriticos) return "critico";
    if (B.restrito(r) || r.equipe === 0 || (r.acompPct != null && r.acompPct < CFG.criterios.acompanhamentoBaixo)) return "atencao";
    return "regular";
  };
  B.CLASSES = { regular: "Regular", atencao: "Atenção", critico: "Crítico", sem: "Sem registro" };

  B.soma = function (arr, f) { var s = 0; for (var i = 0; i < arr.length; i++) { var v = f(arr[i]); if (v != null) s += v; } return s; };

  /* Agregado de um conjunto de municípios no mês t */
  B.agregar = function (lista, t) {
    var a = { munis: lista.length, comReg: 0, pago: 0, executado: 0, meta: 0, acomp: 0, visit: 0,
              criAcomp: 0, gestAcomp: 0, bloq: 0, susp: 0, restr: 0, equipeInc: 0,
              st: [0, 0, 0], aMais: 0, aMenos: 0, classe: { regular: 0, atencao: 0, critico: 0, sem: 0 } };
    lista.forEach(function (m) {
      var r = m.regs[t];
      a.classe[B.classe(m, t)]++;
      if (!r) return;
      a.comReg++;
      a.pago += r.pago || 0; a.executado += r.executado || 0;
      a.meta += r.meta || 0; a.acomp += r.acomp || 0; a.visit += r.visit || 0;
      a.criAcomp += r.criAcomp || 0; a.gestAcomp += r.gestAcomp || 0;
      if (r.bloq === 1) a.bloq++;
      if (r.susp === 1) a.susp++;
      if (B.restrito(r)) a.restr++;
      if (r.equipe === 0) a.equipeInc++;
      if (r.status != null) a.st[r.status]++;
      if (r.aAjustar > 0) a.aMenos += r.aAjustar;
      if (r.aAjustar < 0) a.aMais += -r.aAjustar;
    });
    a.cobertura = a.meta ? a.acomp / a.meta : null;
    return a;
  };

  /* Série mensal de um conjunto */
  B.serie = function (lista) {
    return B.meses.map(function (_, t) { return B.agregar(lista, t); });
  };

  /* ---------- SÍNTESE DO MUNICÍPIO ---------- */
  B.sinteseMunicipio = function (m, t) {
    var f = B.fmt, r = m.regs[t], out = [], cls = B.classe(m, t);
    var regs = m.regs.slice(0, t + 1).filter(Boolean);

    if (!r) {
      out.push("Não há registro de " + m.nome + " em " + f.mes(t) + "." +
        (m.ultimo >= 0 ? " Último mês com dados: " + f.mes(m.ultimo) + "." : ""));
      return { classe: cls, itens: out };
    }

    // 1. Situação do mês
    var sit = [];
    if (r.bloq === 1) {
      var mot = [];
      if (r.equipe === 0) mot.push("equipe incompleta");
      if (r.visit === 0) mot.push("nenhuma visita registrada");
      sit.push("<b>bloqueado</b>" + (mot.length ? " (no mês: " + mot.join(" e ") + ")" : "") +
        " há " + B.seguidos(m, "bloq", t) + " mês(es) seguido(s)");
    }
    if (r.susp === 1) {
      var exc = r.teto ? (r.saldo - r.teto) / r.teto : null;
      sit.push("<b>suspenso</b> há " + B.seguidos(m, "susp", t) + " mês(es) seguido(s), com saldo em conta de " +
        f.moeda(r.saldo) + " acima do teto de " + f.moeda(r.teto) + (exc != null ? " (+" + f.pct(exc) + ")" : ""));
    }
    out.push("Em <b>" + f.mes(t) + "</b>, o município " + (sit.length ? "está " + sit.join(" e ") : "<b>não tem bloqueio nem suspensão</b>") + ".");

    // 2. Equipe
    out.push("Equipe " + (r.equipe === 1 ? "<b>completa</b>" : r.equipe === 0 ? "<b>incompleta</b>" : "sem informação") +
      ": " + f.num(r.tecDes) + " de " + f.num(r.tecMin) + " técnico(s) de referência mínimo(s) e " +
      f.num(r.eduVal) + " de " + f.num(r.eduMin) + " educador(es) social(is) válidos para pagamento.");

    // 3. Atendimento + tendência
    var tend = "";
    if (regs.length >= 6) {
      var ult3 = regs.slice(-3), ant3 = regs.slice(-6, -3);
      var mu = B.soma(ult3, function (x) { return x.acomp; }) / 3, ma = B.soma(ant3, function (x) { return x.acomp; }) / 3;
      if (ma > 0) {
        var d = (mu - ma) / ma;
        tend = Math.abs(d) < 0.05 ? " Acompanhamento estável nos últimos 3 meses." :
          " Acompanhamento " + (d > 0 ? "em alta" : "em queda") + " (" + (d > 0 ? "+" : "") + f.pct(d) + ") na média dos últimos 3 meses frente aos 3 anteriores.";
      } else if (mu > 0) tend = " Retomou o acompanhamento nos últimos 3 meses.";
    }
    out.push("Atendimento: " + f.num(r.acomp) + " acompanhados para meta de " + f.num(r.meta) +
      " (<b>" + f.pct(r.acompPct) + "</b>), sendo " + f.num(r.criAcomp) + " criança(s) e " + f.num(r.gestAcomp) +
      " gestante(s); " + f.num(r.visit) + " visitados no total." + tend);

    // 4. Financeiro do mês
    var stTxt = r.status === 0 ? "sem diferença a ajustar" :
      r.status === 1 ? "<b>pago a mais</b>: " + f.moeda(Math.abs(r.aAjustar)) + " a ajustar" :
      r.status === 2 ? "<b>pago a menos</b>: " + f.moeda(Math.abs(r.aAjustar)) + " a complementar" : "status não informado";
    out.push("Financeiro do mês: valor executado " + f.moeda(r.executado) + ", ajuste " + f.moeda(r.ajuste) +
      ", <b>valor pago " + f.moeda(r.pago) + "</b> — " + stTxt + ".");

    // 5. Histórico do período
    var nB = regs.filter(function (x) { return x.bloq === 1; }).length;
    var nS = regs.filter(function (x) { return x.susp === 1; }).length;
    var nInc = regs.filter(function (x) { return x.equipe === 0; }).length;
    var totPago = B.soma(regs, function (x) { return x.pago; });
    var pri = m.regs.findIndex(Boolean);
    out.push("Período " + f.mes(pri) + " a " + f.mes(t) + " (" + regs.length + " meses com registro): total pago de <b>" +
      f.moeda(totPago) + "</b>; " + nB + " mês(es) com bloqueio, " + nS + " com suspensão e " + nInc + " com equipe incompleta.");

    if (t < B.meses.length - 1 && m.ultimo === t) out.push("Atenção: o município não aparece nos meses posteriores a " + f.mes(t) + ".");
    return { classe: cls, itens: out };
  };

  /* ---------- SÍNTESE DA UF ---------- */
  B.sinteseUF = function (uf, t) {
    var f = B.fmt, lista = B.porUF[uf] || [], a = B.agregar(lista, t), out = [];
    var ant = t > 0 ? B.agregar(lista, t - 1) : null;
    function delta(x, y) { if (y == null) return ""; var d = x - y; return d === 0 ? " (igual ao mês anterior)" : " (" + (d > 0 ? "+" : "") + d + " em relação a " + f.mes(t - 1) + ")"; }

    out.push("Em <b>" + f.mes(t) + "</b>, " + uf + " tem " + a.comReg + " município(s) com registro no PCF/EPCF (de " + a.munis + " no histórico).");
    out.push("Restrições: <b>" + a.bloq + " bloqueado(s)</b>" + delta(a.bloq, ant && ant.bloq) + " e <b>" + a.susp + " suspenso(s)</b>" +
      delta(a.susp, ant && ant.susp) + " — " + f.pct(a.comReg ? a.restr / a.comReg : null) + " dos municípios com alguma restrição; " +
      a.equipeInc + " com equipe incompleta.");
    out.push("Atendimento: " + f.num(a.acomp) + " acompanhados para meta total de " + f.num(a.meta) + " (<b>" + f.pct(a.cobertura) + "</b> de cobertura), " +
      f.num(a.criAcomp) + " crianças e " + f.num(a.gestAcomp) + " gestantes.");
    out.push("Financeiro do mês: <b>" + f.moeda(a.pago) + "</b> pagos; " + a.st[1] + " município(s) pago(s) a mais (" + f.moeda(a.aMais) +
      " a ajustar) e " + a.st[2] + " pago(s) a menos (" + f.moeda(a.aMenos) + " a complementar).");

    var crit = lista.filter(function (m) { return B.classe(m, t) === "critico"; })
      .map(function (m) { return { m: m, n: B.seguidosRestricao(m, t) }; })
      .sort(function (x, y) { return y.n - x.n; });
    if (crit.length) {
      out.push("<b>" + crit.length + " município(s) em situação crítica</b> (restrição por " + CFG.criterios.mesesCriticos +
        "+ meses seguidos). Mais longos: " + crit.slice(0, 5).map(function (c) {
          return '<a href="#/municipio/' + c.m.ibge + '">' + B.esc(c.m.nome) + "</a> (" + c.n + " meses)";
        }).join(", ") + ".");
    } else out.push("Nenhum município em situação crítica pelo critério do painel.");
    return { itens: out, agg: a };
  };

  g.PCF_BASE = B;
})(window);
