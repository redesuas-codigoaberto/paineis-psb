/* =====================================================================
   COMPONENTES REUTILIZÁVEIS: tabela ordenável, KPI, gráficos, CSV
   ===================================================================== */
(function (g) {
  "use strict";
  var B = g.PCF_BASE, C = {};
  C.graficos = [];

  C.COR = { azul: "#1f4e79", azulClaro: "#7aa6d6", verde: "#2e7d32", laranja: "#d9822b",
            vermelho: "#b3261e", roxo: "#6a4c93", cinza: "#9aa5b1" };
  C.COR_CLASSE = { regular: "#2e7d32", atencao: "#d9822b", critico: "#b3261e", sem: "#9aa5b1" };

  C.limparGraficos = function () { C.graficos.forEach(function (c) { c.destroy(); }); C.graficos = []; };

  C.grafico = function (canvasId, cfg) {
    var el = document.getElementById(canvasId);
    if (!el || !g.Chart) return null;
    cfg.options = cfg.options || {};
    cfg.options.responsive = true;
    cfg.options.maintainAspectRatio = false;
    cfg.options.animation = false;
    var c = new g.Chart(el, cfg); C.graficos.push(c); return c;
  };

  C.eixoMoeda = { ticks: { callback: function (v) { return B.fmt.moedaCurta(v); } } };
  C.tooltipMoeda = { callbacks: { label: function (c) { return c.dataset.label + ": " + B.fmt.moeda(c.parsed.y != null ? c.parsed.y : c.parsed.x); } } };

  C.kpi = function (rotulo, valor, detalhe, tipo) {
    return '<div class="kpi ' + (tipo || "") + '"><span class="kpi-rot">' + rotulo + '</span><b class="kpi-val">' + valor +
      '</b>' + (detalhe ? '<span class="kpi-det">' + detalhe + "</span>" : "") + "</div>";
  };

  C.selo = function (classe) {
    return '<span class="selo selo-' + classe + '">' + B.CLASSES[classe] + "</span>";
  };
  C.sn = function (v, ruim) { // ruim = valor que indica problema
    if (v == null) return "–";
    return '<span class="sn ' + (v === ruim ? "sn-ruim" : "sn-ok") + '">' + (v === 1 ? "Sim" : "Não") + "</span>";
  };
  C.statusFinal = function (c) {
    if (c == null) return "–";
    return '<span class="st st' + c + '">' + B.dados.status[c] + "</span>";
  };

  /* -------------------------------------------------------------
     Tabela ordenável e paginada.
     colunas: [{ k, titulo, valor(row)->ordenação/CSV, html(row), num }]
     ------------------------------------------------------------- */
  C.tabela = function (alvo, colunas, linhas, opts) {
    opts = opts || {};
    var estado = { ord: opts.ord || null, dir: opts.dir || 1, pag: 0, tam: opts.tam || 50 };
    var el = typeof alvo === "string" ? document.getElementById(alvo) : alvo;

    function ordenar() {
      if (!estado.ord) return linhas;
      var col = colunas.find(function (c) { return c.k === estado.ord; });
      return linhas.slice().sort(function (a, b) {
        var x = col.valor(a), y = col.valor(b);
        if (x == null) return 1; if (y == null) return -1;
        return (x < y ? -1 : x > y ? 1 : 0) * estado.dir;
      });
    }
    function desenhar() {
      var ls = ordenar(), tot = ls.length, pags = Math.max(1, Math.ceil(tot / estado.tam));
      if (estado.pag >= pags) estado.pag = pags - 1;
      var ini = estado.pag * estado.tam, fatia = ls.slice(ini, ini + estado.tam);
      var h = '<div class="tabela-rolagem"><table class="tabela"><thead><tr>' + colunas.map(function (c) {
        var seta = estado.ord === c.k ? (estado.dir > 0 ? " ▲" : " ▼") : "";
        return '<th data-k="' + c.k + '" class="' + (c.num ? "num" : "") + '" title="Ordenar">' + c.titulo + seta + "</th>";
      }).join("") + "</tr></thead><tbody>";
      if (!fatia.length) h += '<tr><td colspan="' + colunas.length + '" class="vazio">Nenhum resultado.</td></tr>';
      fatia.forEach(function (r) {
        h += "<tr" + (opts.link ? ' class="clicavel" data-link="' + opts.link(r) + '"' : "") + ">" + colunas.map(function (c) {
          return '<td class="' + (c.num ? "num" : "") + '">' + (c.html ? c.html(r) : B.esc(c.valor(r))) + "</td>";
        }).join("") + "</tr>";
      });
      h += "</tbody></table></div>";
      if (tot > estado.tam) {
        h += '<div class="paginacao nao-imprimir"><button data-p="-1"' + (estado.pag === 0 ? " disabled" : "") + '>‹ Anterior</button>' +
          "<span>" + (ini + 1) + "–" + Math.min(ini + estado.tam, tot) + " de " + B.fmt.num(tot) + "</span>" +
          '<button data-p="1"' + (estado.pag >= pags - 1 ? " disabled" : "") + ">Próxima ›</button>" +
          '<button data-p="todos">Mostrar todos</button></div>';
      }
      el.innerHTML = h;
      el.querySelectorAll("th").forEach(function (th) {
        th.onclick = function () {
          var k = th.getAttribute("data-k");
          if (estado.ord === k) estado.dir *= -1; else { estado.ord = k; estado.dir = 1; }
          estado.pag = 0; desenhar();
        };
      });
      el.querySelectorAll(".paginacao button").forEach(function (b) {
        b.onclick = function () {
          var p = b.getAttribute("data-p");
          if (p === "todos") { estado.tam = 100000; estado.pag = 0; } else estado.pag += +p;
          desenhar();
        };
      });
      el.querySelectorAll("tr.clicavel").forEach(function (tr) {
        tr.onclick = function (ev) { if (ev.target.tagName !== "A") location.hash = tr.getAttribute("data-link"); };
      });
    }
    desenhar();
    return { atualizar: function (novas) { linhas = novas; estado.pag = 0; desenhar(); }, linhas: function () { return ordenar(); } };
  };

  /* CSV no padrão do Excel brasileiro (; e vírgula decimal, com BOM) */
  C.baixarCSV = function (nome, colunas, linhas) {
    function cel(v) {
      if (v == null) return "";
      if (typeof v === "number") return String(v).replace(".", ",");
      var s = String(v).replace(/<[^>]+>/g, "");
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    var txt = "﻿" + colunas.map(function (c) { return cel(c.titulo); }).join(";") + "\n" +
      linhas.map(function (r) { return colunas.map(function (c) { return cel(c.csv ? c.csv(r) : c.valor(r)); }).join(";"); }).join("\n");
    var url = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a"); a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  };

  /* Linha do tempo: um quadradinho por mês */
  C.linhaTempo = function (m) {
    return '<div class="linha-tempo">' + B.meses.map(function (_, t) {
      var r = m.regs[t], c = !r ? "lt-sem" : r.bloq === 1 && r.susp === 1 ? "lt-ambos" : r.bloq === 1 ? "lt-bloq" : r.susp === 1 ? "lt-susp" : "lt-ok";
      var tip = B.fmt.mes(t) + ": " + (!r ? "sem registro" : c === "lt-ok" ? "sem restrição" : [r.bloq === 1 ? "bloqueio" : "", r.susp === 1 ? "suspensão" : ""].filter(Boolean).join(" + "));
      return '<span class="lt ' + c + '" title="' + tip + '"><i>' + B.fmt.mes(t).replace("/20", "/") + "</i></span>";
    }).join("") + '</div><div class="legenda-lt"><span class="lt lt-ok"></span> sem restrição <span class="lt lt-bloq"></span> bloqueio <span class="lt lt-susp"></span> suspensão <span class="lt lt-ambos"></span> ambos <span class="lt lt-sem"></span> sem registro</div>';
  };

  g.PCF_COMP = C;
})(window);
