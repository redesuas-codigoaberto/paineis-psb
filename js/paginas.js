/* =====================================================================
   PÁGINAS DO SISTEMA (cada função desenha uma tela em #conteudo)
   ===================================================================== */
(function (g) {
  "use strict";
  var B = g.PCF_BASE, C = g.PCF_COMP, f = B.fmt, esc = B.esc, P = {};
  function $(id) { return document.getElementById(id); }
  function rotulosMeses() { return B.meses.map(function (m) { return f.mes(m); }); }

  function cabecalho(titulo, sub, botoes) {
    return '<section class="cab-pagina"><div><h1>' + titulo + "</h1>" + (sub ? '<p class="sub">' + sub + "</p>" : "") +
      '</div><div class="acoes nao-imprimir">' + (botoes || "") + "</div></section>";
  }
  var BT_IMPRIMIR = '<button class="bt" onclick="window.print()">🖨 Relatório (imprimir / PDF)</button>';

  /* ================= PAINEL NACIONAL ================= */
  P.painel = function (t) {
    var todos = B.munis, a = B.agregar(todos, t), serie = B.serie(todos);
    var ant = t > 0 ? B.agregar(todos, t - 1) : null;
    var acum = B.soma(serie.slice(0, t + 1), function (x) { return x.pago; });
    function var_(x, y) { if (!y) return ""; var d = (x - y) / y; return (d >= 0 ? "▲ " : "▼ ") + f.pct(Math.abs(d), 1) + " vs mês anterior"; }

    var h = cabecalho("Panorama nacional", "Situação em <b>" + f.mes(t) + "</b> · " + B.ufs.length + " UFs · " + f.num(a.comReg) + " municípios com registro", BT_IMPRIMIR + '<button class="bt sec" id="btCsvUF">⬇ CSV por UF</button>');
    h += '<div class="kpis">' +
      C.kpi("Valor pago no mês", f.moedaCurta(a.pago), ant ? var_(a.pago, ant.pago) : "") +
      C.kpi("Pago acumulado", f.moedaCurta(acum), f.mes(0) + " a " + f.mes(t)) +
      C.kpi("Cobertura da meta", f.pct(a.cobertura, 1), f.num(a.acomp) + " acompanhados / " + f.num(a.meta)) +
      C.kpi("Bloqueados", f.num(a.bloq), f.pct(a.bloq / a.comReg, 1) + " dos municípios", "k-vermelho") +
      C.kpi("Suspensos", f.num(a.susp), f.pct(a.susp / a.comReg, 1) + " dos municípios", "k-laranja") +
      C.kpi("Equipe incompleta", f.num(a.equipeInc), f.pct(a.equipeInc / a.comReg, 1) + " dos municípios", "k-laranja") +
      C.kpi("Pago a mais", f.num(a.st[1]), f.moedaCurta(a.aMais) + " a ajustar") +
      C.kpi("Pago a menos", f.num(a.st[2]), f.moedaCurta(a.aMenos) + " a complementar") +
      "</div>";

    h += '<section class="cartao sintese"><h2>Síntese nacional</h2><ul>' +
      "<li>" + f.num(a.classe.regular) + " municípios em situação <b>regular</b>, " + f.num(a.classe.atencao) + " em <b>atenção</b> e " +
      f.num(a.classe.critico) + " em situação <b>crítica</b> (restrição por " + PCF_CONFIG.criterios.mesesCriticos + "+ meses seguidos).</li>" +
      "<li>" + f.pct(a.restr / a.comReg, 1) + " dos municípios têm bloqueio ou suspensão em " + f.mes(t) +
      (ant ? " (eram " + f.pct(ant.restr / ant.comReg, 1) + " em " + f.mes(t - 1) + ")" : "") + ".</li>" +
      "<li>UFs com maior proporção de municípios com restrição: " + rankingUF(t).slice(0, 5).map(function (u) {
        return '<a href="#/uf/' + u.uf + '">' + u.uf + "</a> (" + f.pct(u.p) + ")"; }).join(", ") + ".</li>" +
      "</ul></section>";

    h += '<div class="grade-graficos">' +
      '<section class="cartao"><h3>Valor pago por mês</h3><div class="area-graf"><canvas id="g1"></canvas></div></section>' +
      '<section class="cartao"><h3>Municípios com bloqueio e suspensão</h3><div class="area-graf"><canvas id="g2"></canvas></div></section>' +
      '<section class="cartao"><h3>Classificação em ' + f.mes(t) + '</h3><div class="area-graf"><canvas id="g3"></canvas></div></section>' +
      '<section class="cartao"><h3>% de municípios com restrição por UF (' + f.mes(t) + ')</h3><div class="area-graf alta"><canvas id="g4"></canvas></div></section>' +
      "</div>";
    h += '<section class="cartao"><h2>Situação por UF em ' + f.mes(t) + '</h2><p class="dica nao-imprimir">Clique em uma linha para abrir o estado. Clique no título da coluna para ordenar.</p><div id="tabUF"></div></section>';
    $("conteudo").innerHTML = h;

    graficoPago("g1", serie, t);
    graficoRestricoes("g2", serie);
    graficoClasses("g3", a);
    var rk = rankingUF(t);
    C.grafico("g4", { type: "bar", data: { labels: rk.map(function (u) { return u.uf; }),
      datasets: [{ label: "Bloqueio", data: rk.map(function (u) { return u.a.bloq / u.a.comReg * 100; }), backgroundColor: C.COR.vermelho },
                 { label: "Suspensão", data: rk.map(function (u) { return u.a.susp / u.a.comReg * 100; }), backgroundColor: C.COR.laranja }] },
      options: { indexAxis: "y", scales: { x: { ticks: { callback: function (v) { return v + "%"; } } } },
        plugins: { tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + c.parsed.x.toFixed(1).replace(".", ",") + "%"; } } } } } });

    var cols = colunasUF();
    var linhas = B.ufs.map(function (uf) { return { uf: uf, a: B.agregar(B.porUF[uf], t) }; });
    C.tabela("tabUF", cols, linhas, { ord: "uf", link: function (r) { return "#/uf/" + r.uf; }, tam: 30 });
    $("btCsvUF").onclick = function () { C.baixarCSV("situacao_por_uf_" + B.meses[t] + ".csv", cols, linhas); };
  };

  function rankingUF(t) {
    return B.ufs.map(function (uf) { var a = B.agregar(B.porUF[uf], t); return { uf: uf, a: a, p: a.comReg ? a.restr / a.comReg : 0 }; })
      .sort(function (x, y) { return y.p - x.p; });
  }
  function colunasUF() {
    return [
      { k: "uf", titulo: "UF", valor: function (r) { return r.uf; }, html: function (r) { return '<a href="#/uf/' + r.uf + '"><b>' + r.uf + "</b></a>"; } },
      { k: "mun", titulo: "Municípios", num: 1, valor: function (r) { return r.a.comReg; }, html: function (r) { return f.num(r.a.comReg); } },
      { k: "pago", titulo: "Valor pago", num: 1, valor: function (r) { return r.a.pago; }, html: function (r) { return f.moeda(r.a.pago); } },
      { k: "cob", titulo: "Cobertura", num: 1, valor: function (r) { return r.a.cobertura; }, html: function (r) { return f.pct(r.a.cobertura, 1); } },
      { k: "bloq", titulo: "Bloqueados", num: 1, valor: function (r) { return r.a.bloq; }, html: function (r) { return f.num(r.a.bloq); } },
      { k: "susp", titulo: "Suspensos", num: 1, valor: function (r) { return r.a.susp; }, html: function (r) { return f.num(r.a.susp); } },
      { k: "pr", titulo: "% c/ restrição", num: 1, valor: function (r) { return r.a.comReg ? r.a.restr / r.a.comReg : null; }, html: function (r) { return f.pct(r.a.restr / r.a.comReg, 1); } },
      { k: "inc", titulo: "Equipe incompleta", num: 1, valor: function (r) { return r.a.equipeInc; }, html: function (r) { return f.num(r.a.equipeInc); } },
      { k: "crit", titulo: "Críticos", num: 1, valor: function (r) { return r.a.classe.critico; }, html: function (r) { return r.a.classe.critico ? '<b class="txt-critico">' + r.a.classe.critico + "</b>" : "0"; } }
    ];
  }

  function graficoPago(id, serie, t) {
    C.grafico(id, { type: "bar", data: { labels: rotulosMeses(), datasets: [
      { type: "bar", label: "Valor pago", data: serie.map(function (x) { return x.pago; }),
        backgroundColor: serie.map(function (_, i) { return i === t ? C.COR.azul : C.COR.azulClaro; }) },
      { type: "line", label: "Valor executado", data: serie.map(function (x) { return x.executado; }), borderColor: C.COR.laranja, pointRadius: 2, borderWidth: 2 }] },
      options: { scales: { y: C.eixoMoeda }, plugins: { tooltip: C.tooltipMoeda } } });
  }
  function graficoRestricoes(id, serie) {
    C.grafico(id, { type: "line", data: { labels: rotulosMeses(), datasets: [
      { label: "Bloqueados", data: serie.map(function (x) { return x.bloq; }), borderColor: C.COR.vermelho, backgroundColor: C.COR.vermelho, tension: .2 },
      { label: "Suspensos", data: serie.map(function (x) { return x.susp; }), borderColor: C.COR.laranja, backgroundColor: C.COR.laranja, tension: .2 },
      { label: "Equipe incompleta", data: serie.map(function (x) { return x.equipeInc; }), borderColor: C.COR.roxo, backgroundColor: C.COR.roxo, borderDash: [4, 3], tension: .2 }] },
      options: { scales: { y: { beginAtZero: true } } } });
  }
  function graficoClasses(id, a) {
    var ks = ["regular", "atencao", "critico", "sem"];
    C.grafico(id, { type: "doughnut", data: { labels: ks.map(function (k) { return B.CLASSES[k]; }),
      datasets: [{ data: ks.map(function (k) { return a.classe[k]; }), backgroundColor: ks.map(function (k) { return C.COR_CLASSE[k]; }) }] },
      options: { plugins: { legend: { position: "right" } } } });
  }

  /* ================= LISTA DE UFs ================= */
  P.ufs = function (t) {
    var h = cabecalho("Estados", "Escolha uma UF para ver a síntese, gráficos e a lista de municípios.");
    h += '<div class="grade-ufs">' + B.ufs.map(function (uf) {
      var a = B.agregar(B.porUF[uf], t);
      return '<a class="cartao-uf" href="#/uf/' + uf + '"><b>' + uf + "</b><span>" + a.comReg + " municípios</span><span>" +
        f.moedaCurta(a.pago) + "</span><span class=\"" + (a.classe.critico ? "txt-critico" : "") + "\">" + a.classe.critico + " crítico(s)</span></a>";
    }).join("") + "</div>";
    $("conteudo").innerHTML = h;
  };

  /* ================= PÁGINA DA UF ================= */
  P.uf = function (t, uf) {
    var lista = B.porUF[uf];
    if (!lista) { $("conteudo").innerHTML = cabecalho("UF não encontrada", '<a href="#/uf">Voltar</a>'); return; }
    var s = B.sinteseUF(uf, t), a = s.agg, serie = B.serie(lista);
    var acum = B.soma(serie.slice(0, t + 1), function (x) { return x.pago; });

    var h = '<nav class="trilha nao-imprimir"><a href="#/painel">Painel</a> › <a href="#/uf">Estados</a> › ' + uf + "</nav>";
    h += cabecalho("Estado: " + uf, "Situação em <b>" + f.mes(t) + "</b>", BT_IMPRIMIR + '<button class="bt sec" id="btCsv">⬇ CSV dos municípios</button>');
    h += '<div class="kpis">' +
      C.kpi("Municípios com registro", f.num(a.comReg)) +
      C.kpi("Valor pago no mês", f.moedaCurta(a.pago)) +
      C.kpi("Pago acumulado", f.moedaCurta(acum), f.mes(0) + " a " + f.mes(t)) +
      C.kpi("Cobertura da meta", f.pct(a.cobertura, 1)) +
      C.kpi("Bloqueados", f.num(a.bloq), "", "k-vermelho") +
      C.kpi("Suspensos", f.num(a.susp), "", "k-laranja") +
      C.kpi("Críticos", f.num(a.classe.critico), "", "k-vermelho") +
      C.kpi("Pago a mais / a menos", a.st[1] + " / " + a.st[2]) + "</div>";
    h += '<section class="cartao sintese"><h2>Síntese da situação</h2><ul>' + s.itens.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul></section>";
    h += '<div class="grade-graficos">' +
      '<section class="cartao"><h3>Valor pago por mês</h3><div class="area-graf"><canvas id="g1"></canvas></div></section>' +
      '<section class="cartao"><h3>Bloqueio, suspensão e equipe incompleta</h3><div class="area-graf"><canvas id="g2"></canvas></div></section>' +
      '<section class="cartao"><h3>Classificação em ' + f.mes(t) + '</h3><div class="area-graf"><canvas id="g3"></canvas></div></section>' +
      '<section class="cartao"><h3>Cobertura da meta por mês</h3><div class="area-graf"><canvas id="g4"></canvas></div></section></div>';
    h += '<section class="cartao"><h2>Municípios de ' + uf + " em " + f.mes(t) + '</h2>' +
      '<div class="filtros nao-imprimir"><input id="fTxt" type="search" placeholder="Filtrar por nome…">' +
      '<select id="fCls"><option value="">Todas as classificações</option><option value="critico">Crítico</option><option value="atencao">Atenção</option><option value="regular">Regular</option><option value="sem">Sem registro</option></select></div>' +
      '<div id="tabMun"></div></section>';
    $("conteudo").innerHTML = h;

    graficoPago("g1", serie, t);
    graficoRestricoes("g2", serie);
    graficoClasses("g3", a);
    C.grafico("g4", { type: "line", data: { labels: rotulosMeses(), datasets: [{ label: "Cobertura", data: serie.map(function (x) { return x.cobertura != null ? x.cobertura * 100 : null; }),
      borderColor: C.COR.verde, backgroundColor: "rgba(46,125,50,.12)", fill: true, tension: .2 }] },
      options: { scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return v + "%"; } } } }, plugins: { legend: { display: false } } } });

    var cols = colunasMunicipio(t, false);
    var tab = C.tabela("tabMun", cols, lista, { ord: "nome", link: function (m) { return "#/municipio/" + m.ibge; } });
    function filtrar() {
      var q = PCF_CONVERSOR.norm($("fTxt").value), c = $("fCls").value;
      tab.atualizar(lista.filter(function (m) { return (!q || m.busca.indexOf(q) > -1) && (!c || B.classe(m, t) === c); }));
    }
    $("fTxt").oninput = filtrar; $("fCls").onchange = filtrar;
    $("btCsv").onclick = function () { C.baixarCSV("municipios_" + uf + "_" + B.meses[t] + ".csv", cols, tab.linhas()); };
  };

  /* Colunas de município (usadas na UF e na busca) */
  function colunasMunicipio(t, comUF) {
    function r(m) { return m.regs[t] || {}; }
    var c = [
      { k: "nome", titulo: "Município", valor: function (m) { return m.nome; }, html: function (m) { return '<a href="#/municipio/' + m.ibge + '">' + esc(m.nome) + "</a>"; } }
    ];
    if (comUF) c.push({ k: "uf", titulo: "UF", valor: function (m) { return m.uf; } });
    return c.concat([
      { k: "ibge", titulo: "IBGE", valor: function (m) { return m.ibge; } },
      { k: "porte", titulo: "Porte", valor: function (m) { return m.porte; } },
      { k: "meta", titulo: "Meta", num: 1, valor: function (m) { return r(m).meta; }, html: function (m) { return f.num(r(m).meta); } },
      { k: "acomp", titulo: "Acompanhados", num: 1, valor: function (m) { return r(m).acomp; }, html: function (m) { return f.num(r(m).acomp); } },
      { k: "pct", titulo: "Acomp. %", num: 1, valor: function (m) { return r(m).acompPct; }, html: function (m) { return f.pct(r(m).acompPct); } },
      { k: "equipe", titulo: "Equipe completa", valor: function (m) { return f.sn(r(m).equipe); }, html: function (m) { return C.sn(r(m).equipe, 0); } },
      { k: "bloq", titulo: "Bloqueio", valor: function (m) { return f.sn(r(m).bloq); }, html: function (m) { return C.sn(r(m).bloq, 1); } },
      { k: "susp", titulo: "Suspensão", valor: function (m) { return f.sn(r(m).susp); }, html: function (m) { return C.sn(r(m).susp, 1); } },
      { k: "seg", titulo: "Meses seguidos c/ restrição", num: 1, valor: function (m) { return B.seguidosRestricao(m, t); } },
      { k: "pago", titulo: "Valor pago", num: 1, valor: function (m) { return r(m).pago; }, html: function (m) { return f.moeda(r(m).pago); } },
      { k: "ajus", titulo: "Valor a ajustar", num: 1, valor: function (m) { return r(m).aAjustar; }, html: function (m) { return f.moeda(r(m).aAjustar); } },
      { k: "status", titulo: "Status final", valor: function (m) { return f.status(r(m).status); }, html: function (m) { return C.statusFinal(r(m).status); } },
      { k: "classe", titulo: "Classificação", valor: function (m) { return B.CLASSES[B.classe(m, t)]; }, html: function (m) { return C.selo(B.classe(m, t)); } }
    ]);
  }

  /* ================= PÁGINA DO MUNICÍPIO ================= */
  P.municipio = function (t, ibge) {
    var m = B.porIbge[ibge];
    if (!m) { $("conteudo").innerHTML = cabecalho("Município não encontrado", "Código IBGE " + esc(ibge) + ' não está na base. <a href="#/busca">Ir para a busca</a>'); return; }
    var s = B.sinteseMunicipio(m, t), r = m.regs[t];
    var regs = m.regs.slice(0, t + 1).filter(Boolean);

    var h = '<nav class="trilha nao-imprimir"><a href="#/painel">Painel</a> › <a href="#/uf/' + m.uf + '">' + m.uf + "</a> › " + esc(m.nome) + "</nav>";
    h += cabecalho(esc(m.nome) + " / " + m.uf + " " + C.selo(s.classe),
      "IBGE " + m.ibge + " · Porte " + esc(m.porte || "–") + " · Adesão em " + f.data(m.adesao) + " · " + esc(m.etapa || "") + " · Referência <b>" + f.mes(t) + "</b>",
      BT_IMPRIMIR + '<button class="bt sec" id="btCsv">⬇ CSV do histórico</button>');
    if (r) {
      h += '<div class="kpis">' +
        C.kpi("Valor pago no mês", f.moeda(r.pago), "Executado " + f.moeda(r.executado)) +
        C.kpi("Pago no período", f.moedaCurta(B.soma(regs, function (x) { return x.pago; })), regs.length + " meses") +
        C.kpi("Acompanhamento", f.pct(r.acompPct), f.num(r.acomp) + " de " + f.num(r.meta)) +
        C.kpi("Saldo em conta", f.moedaCurta(r.saldo), "Teto " + f.moedaCurta(r.teto), r.saldo > r.teto ? "k-laranja" : "") +
        C.kpi("Bloqueio", f.sn(r.bloq), r.bloq === 1 ? B.seguidos(m, "bloq", t) + " mês(es) seguido(s)" : "", r.bloq === 1 ? "k-vermelho" : "") +
        C.kpi("Suspensão", f.sn(r.susp), r.susp === 1 ? B.seguidos(m, "susp", t) + " mês(es) seguido(s)" : "", r.susp === 1 ? "k-laranja" : "") +
        C.kpi("Status final", f.status(r.status), r.aAjustar ? f.moeda(r.aAjustar) + " a ajustar" : "") + "</div>";
    }
    h += '<section class="cartao sintese"><h2>Síntese da situação</h2><ul>' + s.itens.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul></section>";
    h += '<section class="cartao"><h3>Linha do tempo de restrições</h3>' + C.linhaTempo(m) + "</section>";
    h += '<div class="grade-graficos">' +
      '<section class="cartao"><h3>Valor pago × executado</h3><div class="area-graf"><canvas id="g1"></canvas></div></section>' +
      '<section class="cartao"><h3>Acompanhados × meta</h3><div class="area-graf"><canvas id="g2"></canvas></div></section>' +
      '<section class="cartao"><h3>Saldo em conta × teto</h3><div class="area-graf"><canvas id="g3"></canvas></div></section>' +
      '<section class="cartao"><h3>Equipe: designados × mínimo</h3><div class="area-graf"><canvas id="g4"></canvas></div></section></div>';
    h += '<section class="cartao"><h2>Histórico mês a mês</h2><div id="tabHist"></div></section>';
    $("conteudo").innerHTML = h;

    function sr(campo) { return m.regs.map(function (x) { return x ? x[campo] : null; }); }
    var lb = rotulosMeses();
    C.grafico("g1", { type: "bar", data: { labels: lb, datasets: [
      { type: "bar", label: "Valor pago", data: sr("pago"), backgroundColor: m.regs.map(function (x, i) { return i === t ? C.COR.azul : C.COR.azulClaro; }) },
      { type: "line", label: "Valor executado", data: sr("executado"), borderColor: C.COR.laranja, pointRadius: 2 }] },
      options: { scales: { y: C.eixoMoeda }, plugins: { tooltip: C.tooltipMoeda } } });
    C.grafico("g2", { type: "line", data: { labels: lb, datasets: [
      { label: "Acompanhados", data: sr("acomp"), borderColor: C.COR.verde, backgroundColor: "rgba(46,125,50,.12)", fill: true, tension: .2 },
      { label: "Visitados", data: sr("visit"), borderColor: C.COR.azulClaro, tension: .2 },
      { label: "Meta", data: sr("meta"), borderColor: C.COR.cinza, borderDash: [5, 4], pointRadius: 0 }] },
      options: { scales: { y: { beginAtZero: true } } } });
    C.grafico("g3", { type: "line", data: { labels: lb, datasets: [
      { label: "Saldo em conta", data: sr("saldo"), borderColor: C.COR.azul, tension: .2 },
      { label: "Teto de saldo", data: sr("teto"), borderColor: C.COR.vermelho, borderDash: [5, 4], pointRadius: 0 }] },
      options: { scales: { y: C.eixoMoeda }, plugins: { tooltip: C.tooltipMoeda } } });
    C.grafico("g4", { type: "bar", data: { labels: lb, datasets: [
      { label: "Técnicos designados", data: sr("tecDes"), backgroundColor: C.COR.azul },
      { label: "Educadores válidos", data: sr("eduVal"), backgroundColor: C.COR.azulClaro },
      { type: "line", label: "Técnicos mínimo", data: sr("tecMin"), borderColor: C.COR.vermelho, borderDash: [4, 3], pointRadius: 0 },
      { type: "line", label: "Educadores mínimo", data: sr("eduMin"), borderColor: C.COR.laranja, borderDash: [4, 3], pointRadius: 0 }] },
      options: { scales: { y: { beginAtZero: true } } } });

    var hist = m.regs.map(function (x, i) { return x ? Object.assign({ i: i }, x) : null; }).filter(Boolean).reverse();
    var cols = [
      { k: "mes", titulo: "Mês", valor: function (x) { return B.meses[x.i]; }, html: function (x) { return (x.i === t ? "<b>" : "") + f.mes(x.i) + (x.i === t ? "</b>" : ""); }, csv: function (x) { return f.mes(x.i); } },
      { k: "meta", titulo: "Meta", num: 1, valor: function (x) { return x.meta; } },
      { k: "visit", titulo: "Visitados", num: 1, valor: function (x) { return x.visit; } },
      { k: "acomp", titulo: "Acompanhados", num: 1, valor: function (x) { return x.acomp; } },
      { k: "cri", titulo: "Crianças acomp.", num: 1, valor: function (x) { return x.criAcomp; } },
      { k: "gest", titulo: "Gestantes acomp.", num: 1, valor: function (x) { return x.gestAcomp; } },
      { k: "pct", titulo: "Acomp. %", num: 1, valor: function (x) { return x.acompPct; }, html: function (x) { return f.pct(x.acompPct); } },
      { k: "eq", titulo: "Equipe completa", valor: function (x) { return f.sn(x.equipe); }, html: function (x) { return C.sn(x.equipe, 0); } },
      { k: "saldo", titulo: "Saldo em conta", num: 1, valor: function (x) { return x.saldo; }, html: function (x) { return f.moeda(x.saldo); } },
      { k: "teto", titulo: "Teto", num: 1, valor: function (x) { return x.teto; }, html: function (x) { return f.moeda(x.teto); } },
      { k: "bloq", titulo: "Bloqueio", valor: function (x) { return f.sn(x.bloq); }, html: function (x) { return C.sn(x.bloq, 1); } },
      { k: "susp", titulo: "Suspensão", valor: function (x) { return f.sn(x.susp); }, html: function (x) { return C.sn(x.susp, 1); } },
      { k: "fixa", titulo: "Parcela fixa", num: 1, valor: function (x) { return x.fixa; }, html: function (x) { return f.moeda(x.fixa); } },
      { k: "var", titulo: "Parcela variável", num: 1, valor: function (x) { return x.variavel; }, html: function (x) { return f.moeda(x.variavel); } },
      { k: "exec", titulo: "Executado", num: 1, valor: function (x) { return x.executado; }, html: function (x) { return f.moeda(x.executado); } },
      { k: "ajuste", titulo: "Ajuste", num: 1, valor: function (x) { return x.ajuste; }, html: function (x) { return f.moeda(x.ajuste); } },
      { k: "pago", titulo: "Valor pago", num: 1, valor: function (x) { return x.pago; }, html: function (x) { return "<b>" + f.moeda(x.pago) + "</b>"; } },
      { k: "aaj", titulo: "Valor a ajustar", num: 1, valor: function (x) { return x.aAjustar; }, html: function (x) { return f.moeda(x.aAjustar); } },
      { k: "st", titulo: "Status final", valor: function (x) { return f.status(x.status); }, html: function (x) { return C.statusFinal(x.status); } }
    ];
    C.tabela("tabHist", cols, hist, { tam: 100 });
    $("btCsv").onclick = function () { C.baixarCSV("historico_" + m.ibge + "_" + m.nome.replace(/\W+/g, "_") + ".csv", cols, hist.slice().reverse()); };
  };

  /* ================= BUSCA AVANÇADA ================= */
  var filtrosBusca = { q: "", uf: "", porte: "", sit: "", st: "", cls: "" };
  P.busca = function (t, params) {
    Object.keys(params || {}).forEach(function (k) { if (k in filtrosBusca) filtrosBusca[k] = params[k]; });
    var portes = Array.from(new Set(B.munis.map(function (m) { return m.porte; }))).filter(Boolean).sort();
    function opt(v, txt, atual) { return '<option value="' + v + '"' + (v === atual ? " selected" : "") + ">" + txt + "</option>"; }
    var F = filtrosBusca;
    var h = cabecalho("Busca avançada", "Combine filtros para localizar municípios. Valores referentes a <b>" + f.mes(t) + "</b>.",
      BT_IMPRIMIR + '<button class="bt sec" id="btCsv">⬇ CSV do resultado</button>');
    h += '<section class="cartao filtros-busca nao-imprimir">' +
      '<label>Município ou IBGE<input id="bQ" type="search" value="' + esc(F.q) + '" placeholder="ex.: são josé, 3550308"></label>' +
      '<label>UF<select id="bUF">' + opt("", "Todas", F.uf) + B.ufs.map(function (u) { return opt(u, u, F.uf); }).join("") + "</select></label>" +
      '<label>Porte<select id="bPorte">' + opt("", "Todos", F.porte) + portes.map(function (p) { return opt(p, p, F.porte); }).join("") + "</select></label>" +
      '<label>Situação no mês<select id="bSit">' + opt("", "Todas", F.sit) + opt("bloq", "Bloqueado", F.sit) + opt("susp", "Suspenso", F.sit) +
        opt("restr", "Bloqueado ou suspenso", F.sit) + opt("ambos", "Bloqueado e suspenso", F.sit) + opt("semRestr", "Sem restrição", F.sit) +
        opt("eqInc", "Equipe incompleta", F.sit) + opt("semVisita", "Nenhuma visita no mês", F.sit) + opt("acima", "Saldo acima do teto", F.sit) + opt("semReg", "Sem registro no mês", F.sit) + "</select></label>" +
      '<label>Status final<select id="bSt">' + opt("", "Todos", F.st) + B.dados.status.map(function (s, i) { return opt(String(i), s, F.st); }).join("") + "</select></label>" +
      '<label>Classificação<select id="bCls">' + opt("", "Todas", F.cls) + ["critico", "atencao", "regular", "sem"].map(function (k) { return opt(k, B.CLASSES[k], F.cls); }).join("") + "</select></label>" +
      '<button class="bt sec" id="bLimpar">Limpar filtros</button></section>';
    h += '<section class="cartao"><div id="resumoBusca" class="resumo-busca"></div><div id="tabBusca"></div></section>';
    $("conteudo").innerHTML = h;

    var cols = colunasMunicipio(t, true), tab = null;
    function testar(m) {
      var r = m.regs[t], q = PCF_CONVERSOR.norm(F.q);
      if (q && !(m.busca.indexOf(q) > -1 || String(m.ibge).indexOf(q) === 0)) return false;
      if (F.uf && m.uf !== F.uf) return false;
      if (F.porte && m.porte !== F.porte) return false;
      if (F.cls && B.classe(m, t) !== F.cls) return false;
      if (F.st !== "" && (!r || r.status !== +F.st)) return false;
      switch (F.sit) {
        case "bloq": return !!r && r.bloq === 1;
        case "susp": return !!r && r.susp === 1;
        case "restr": return B.restrito(r);
        case "ambos": return !!r && r.bloq === 1 && r.susp === 1;
        case "semRestr": return !!r && !B.restrito(r);
        case "eqInc": return !!r && r.equipe === 0;
        case "semVisita": return !!r && r.visit === 0;
        case "acima": return !!r && r.saldo > r.teto;
        case "semReg": return !r;
      }
      return true;
    }
    function aplicar() {
      var res = B.munis.filter(testar), a = B.agregar(res, t);
      $("resumoBusca").innerHTML = "<b>" + f.num(res.length) + "</b> município(s) encontrado(s) · valor pago no mês " + f.moeda(a.pago) +
        " · " + a.bloq + " bloqueado(s) · " + a.susp + " suspenso(s) · cobertura " + f.pct(a.cobertura, 1);
      if (!tab) tab = C.tabela("tabBusca", cols, res, { ord: "nome", link: function (m) { return "#/municipio/" + m.ibge; } });
      else tab.atualizar(res);
    }
    var ids = { bQ: "q", bUF: "uf", bPorte: "porte", bSit: "sit", bSt: "st", bCls: "cls" };
    Object.keys(ids).forEach(function (id) {
      $(id)[id === "bQ" ? "oninput" : "onchange"] = function () { F[ids[id]] = $(id).value; aplicar(); };
    });
    $("bLimpar").onclick = function () { Object.keys(F).forEach(function (k) { F[k] = ""; }); P.busca(t); };
    $("btCsv").onclick = function () { C.baixarCSV("busca_" + B.meses[t] + ".csv", cols, tab.linhas()); };
    aplicar();
  };

  /* ================= ATUALIZAR DADOS ================= */
  var pendente = null;
  P.atualizar = function () {
    var d = B.dados;
    var h = cabecalho("Atualizar dados", "Envie a planilha nova (.xlsx, .xls ou .csv) no mesmo formato da planilha de monitoramento.");
    h += '<section class="cartao"><h2>Base em uso</h2><p>' + (B.origem === "local" ? '<span class="selo selo-atencao">Carregada neste navegador</span> ' : '<span class="selo selo-regular">Oficial (arquivo dados/dados.js)</span> ') +
      "Fonte: <b>" + esc(d.fonte || "–") + "</b> · gerada em " + new Date(d.geradoEm).toLocaleString("pt-BR") + " · " +
      f.num(d.municipios.length) + " municípios · " + f.num(d.registros.length) + " registros · " + f.mes(0) + " a " + f.mes(B.meses.length - 1) + "</p>" +
      '<div class="acoes"><button class="bt sec" id="btBaixarAtual">⬇ Baixar dados.js da base em uso</button>' +
      (B.origem === "local" ? '<button class="bt perigo" id="btVoltar">Descartar base local e voltar à oficial</button>' : "") + "</div></section>";

    h += '<section class="cartao"><h2>1. Escolha a planilha</h2>' +
      '<div class="modo"><label><input type="radio" name="modo" value="mesclar" checked> <b>Acrescentar / atualizar meses</b> — os meses presentes na planilha nova substituem os mesmos meses da base; os demais meses são mantidos. Use quando a planilha trouxer só o mês novo.</label>' +
      '<label><input type="radio" name="modo" value="substituir"> <b>Substituir tudo</b> — a base passa a ser exatamente a planilha nova. Use quando a planilha trouxer o histórico completo.</label></div>' +
      '<label class="zona-upload" id="zona"><input type="file" id="arquivo" accept=".xlsx,.xls,.xlsm,.csv"><span>📄 Clique para escolher ou arraste a planilha aqui</span></label>' +
      '<div id="progresso" class="progresso" hidden></div></section>';
    h += '<section class="cartao" id="secResultado" hidden><h2>2. Confira antes de aplicar</h2><div id="resultado"></div>' +
      '<div class="acoes"><button class="bt" id="btAplicar">✔ Aplicar neste navegador</button><button class="bt sec" id="btBaixarNovo">⬇ Baixar novo dados.js (para publicar)</button><button class="bt sec" id="btCancelar">Cancelar</button></div></section>';
    h += '<section class="cartao ajuda-pub"><h2>3. Como publicar para todos</h2><ol>' +
      "<li><b>Aplicar neste navegador</b> atualiza só a sua máquina (fica salvo no navegador).</li>" +
      "<li>Para que todos vejam, clique em <b>Baixar novo dados.js</b>.</li>" +
      "<li>Na pasta compartilhada do sistema, substitua o arquivo <code>dados/dados.js</code> pelo arquivo baixado (guarde o antigo como backup, ex.: <code>dados_2026-08.js</code>).</li>" +
      "<li>Peça para os usuários recarregarem a página (Ctrl+F5).</li></ol></section>";
    $("conteudo").innerHTML = h;

    $("btBaixarAtual").onclick = function () { PCF_ARMAZEM.baixarDadosJs(B.dados); };
    if ($("btVoltar")) $("btVoltar").onclick = function () {
      if (!confirm("Descartar a base carregada neste navegador e voltar à base oficial?")) return;
      PCF_ARMAZEM.limpar().then(function () { location.reload(); });
    };
    var zona = $("zona");
    ["dragover", "dragenter"].forEach(function (e) { zona.addEventListener(e, function (ev) { ev.preventDefault(); zona.classList.add("arrastando"); }); });
    ["dragleave", "drop"].forEach(function (e) { zona.addEventListener(e, function () { zona.classList.remove("arrastando"); }); });
    zona.addEventListener("drop", function (ev) { ev.preventDefault(); if (ev.dataTransfer.files[0]) processar(ev.dataTransfer.files[0]); });
    $("arquivo").onchange = function () { if (this.files[0]) processar(this.files[0]); };
    $("btCancelar").onclick = function () { pendente = null; $("secResultado").hidden = true; $("arquivo").value = ""; };
    $("btBaixarNovo").onclick = function () { if (pendente) PCF_ARMAZEM.baixarDadosJs(pendente); };
    $("btAplicar").onclick = function () {
      if (!pendente) return;
      var bt = this; bt.disabled = true; bt.textContent = "Salvando…";
      PCF_ARMAZEM.salvar(pendente).then(function () {
        g.PCF_APP.usarBase(pendente, "local"); pendente = null; location.hash = "#/painel";
      }).catch(function (e) {
        alert("Não foi possível salvar no navegador (" + e.message + "). A base foi aplicada só até fechar a página. Use 'Baixar novo dados.js' para publicar.");
        g.PCF_APP.usarBase(pendente, "local"); location.hash = "#/painel";
      });
    };
  };

  function processar(arq) {
    var prog = $("progresso"); prog.hidden = false; prog.className = "progresso";
    prog.innerHTML = '<span class="giro"></span> Lendo <b>' + esc(arq.name) + "</b> (" + (arq.size / 1e6).toFixed(1) + " MB)… planilhas grandes podem levar alguns segundos.";
    $("secResultado").hidden = true;
    var leitor = new FileReader();
    leitor.onload = function (e) {
      setTimeout(function () {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: "array", cellDates: false });
          var aba = wb.SheetNames.indexOf(PCF_CONFIG.aba) > -1 ? PCF_CONFIG.aba : wb.SheetNames[0];
          var linhas = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, raw: true, defval: null });
          var r = PCF_CONVERSOR.converterLinhas(linhas, PCF_CONFIG, XLSX, arq.name);
          var modo = document.querySelector('input[name="modo"]:checked').value;
          var nova = modo === "mesclar" ? PCF_CONVERSOR.mesclar(B.dados, r.dados, arq.name) : r.dados;
          pendente = nova;
          prog.innerHTML = "✔ Planilha lida (aba <b>" + esc(aba) + "</b>).";
          mostrarComparacao(r.dados, nova, r.avisos, modo);
        } catch (err) {
          prog.className = "progresso erro";
          prog.innerHTML = "✖ Não foi possível importar: <b>" + esc(err.message) + "</b><br>Confira se é a planilha de monitoramento e se o cabeçalho tem as colunas configuradas em <code>js/config.js</code>.";
        }
      }, 30);
    };
    leitor.readAsArrayBuffer(arq);
  }

  function mostrarComparacao(arquivo, nova, avisos, modo) {
    var atual = B.dados;
    var mAt = {}; atual.meses.forEach(function (m) { mAt[m] = 1; });
    var novos = arquivo.meses.filter(function (m) { return !mAt[m]; });
    var subst = arquivo.meses.filter(function (m) { return mAt[m]; });
    var ibAt = {}; atual.municipios.forEach(function (m) { ibAt[m[0]] = 1; });
    var ibNv = {}; nova.municipios.forEach(function (m) { ibNv[m[0]] = 1; });
    var entraram = nova.municipios.filter(function (m) { return !ibAt[m[0]]; });
    var sairam = atual.municipios.filter(function (m) { return !ibNv[m[0]]; });
    var ultimo = arquivo.meses.length - 1, mi = arquivo.campos.indexOf("pago") + 2;
    var pagoUlt = 0, qUlt = 0;
    arquivo.registros.forEach(function (r) { if (r[1] === ultimo) { pagoUlt += r[mi] || 0; qUlt++; } });

    var h = '<div class="kpis">' +
      C.kpi("Linhas lidas na planilha", f.num(arquivo.registros.length)) +
      C.kpi("Meses na planilha", arquivo.meses.length, f.mes(arquivo.meses[0]) + " a " + f.mes(arquivo.meses[ultimo])) +
      C.kpi("Pago em " + f.mes(arquivo.meses[ultimo]), f.moedaCurta(pagoUlt), qUlt + " municípios") +
      C.kpi("Base resultante", f.num(nova.registros.length) + " registros", nova.meses.length + " meses · " + f.num(nova.municipios.length) + " municípios") + "</div><ul>";
    h += "<li>Modo: <b>" + (modo === "mesclar" ? "acrescentar / atualizar meses" : "substituir tudo") + "</b>.</li>";
    h += "<li>Meses novos: " + (novos.length ? novos.map(f.mes).join(", ") : "nenhum") + ".</li>";
    if (subst.length) h += "<li>Meses que serão <b>substituídos</b> pela planilha nova: " + subst.map(f.mes).join(", ") + ".</li>";
    if (modo === "substituir") {
      var perd = atual.meses.filter(function (m) { return arquivo.meses.indexOf(m) < 0; });
      if (perd.length) h += '<li class="txt-critico">Atenção: estes meses da base atual <b>deixarão de existir</b>: ' + perd.map(f.mes).join(", ") + ".</li>";
    }
    if (entraram.length) h += "<li>" + entraram.length + " município(s) novo(s): " + entraram.slice(0, 10).map(function (m) { return esc(m[2]) + "/" + m[1]; }).join(", ") + (entraram.length > 10 ? "…" : "") + ".</li>";
    if (sairam.length) h += "<li>" + sairam.length + " município(s) deixam de existir na base.</li>";
    avisos.forEach(function (a) { h += '<li class="txt-atencao">' + esc(a) + "</li>"; });
    h += "</ul>";
    $("resultado").innerHTML = h;
    $("secResultado").hidden = false;
    $("secResultado").scrollIntoView({ behavior: "smooth" });
  }

  /* ================= AJUDA ================= */
  P.ajuda = function () {
    var c = PCF_CONFIG.criterios;
    $("conteudo").innerHTML = cabecalho("Como usar") + '<section class="cartao texto">' +
      "<h2>Navegação</h2><ul>" +
      "<li><b>Mês de referência</b> (topo): define o mês usado em todas as telas — KPIs, sínteses, tabelas e filtros.</li>" +
      "<li><b>Busca rápida</b> (topo): digite parte do nome ou o código IBGE e escolha o município.</li>" +
      "<li><b>Painel nacional</b>: totais do Brasil, gráficos mensais e tabela por UF.</li>" +
      "<li><b>Estados</b>: síntese da UF, gráficos e lista de municípios com filtro.</li>" +
      "<li><b>Busca avançada</b>: combine UF, porte, situação, status final e classificação; exporte o resultado em CSV.</li>" +
      "<li><b>Relatório</b>: em qualquer tela, o botão “Relatório (imprimir / PDF)” gera a versão para impressão — no diálogo, escolha “Salvar como PDF”.</li></ul>" +
      "<h2>Classificação do painel</h2><p>Critério de apoio à gestão, definido em <code>js/config.js</code> (não é norma oficial):</p><ul>" +
      "<li>" + C.selo("critico") + " bloqueio ou suspensão por " + c.mesesCriticos + " ou mais meses seguidos;</li>" +
      "<li>" + C.selo("atencao") + " bloqueio ou suspensão no mês, equipe incompleta ou acompanhamento abaixo de " + f.pct(c.acompanhamentoBaixo) + " da meta;</li>" +
      "<li>" + C.selo("regular") + " nenhuma das situações acima;</li>" +
      "<li>" + C.selo("sem") + " município sem linha na planilha para o mês.</li></ul>" +
      "<h2>De onde vêm os números</h2><ul>" +
      "<li><b>Valor pago</b> = coluna VL_PAGAMENTO_AJUSTADO_FINAL.</li>" +
      "<li><b>Cobertura da meta</b> (UF/Brasil) = soma de ACOMPANHADOS TOTAL ÷ soma de QT_META_ACEITA.</li>" +
      "<li><b>Valor a ajustar</b> = VALOR_A_SER_AJUSTADO (negativo: pago a mais; positivo: pago a menos).</li>" +
      "<li>As sínteses são textos automáticos montados a partir dessas colunas; não substituem a análise técnica.</li></ul></section>";
  };

  g.PCF_PAGINAS = P;
})(window);
