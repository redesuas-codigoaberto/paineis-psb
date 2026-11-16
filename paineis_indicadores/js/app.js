/* =====================================================================
   APLICAÇÃO: inicialização, rotas (#/...), mês de referência e busca rápida
   ===================================================================== */
(function (g) {
  "use strict";
  var B = g.PCF_BASE, C = g.PCF_COMP, P = g.PCF_PAGINAS, A = {}, mesSel = 0;
  function $(id) { return document.getElementById(id); }

  A.usarBase = function (dados, origem) {
    B.carregar(dados, origem);
    var sel = $("selMes");
    sel.innerHTML = B.meses.map(function (m, i) { return '<option value="' + i + '">' + B.fmt.mes(m) + "</option>"; }).reverse().join("");
    mesSel = B.meses.length - 1; sel.value = mesSel;
    var av = $("avisoBase");
    if (origem === "local") {
      av.hidden = false;
      av.innerHTML = "⚠ Você está vendo dados carregados <b>apenas neste navegador</b> (" + B.esc(dados.fonte) + ", " +
        new Date(dados.geradoEm).toLocaleString("pt-BR") + "). Os demais usuários veem a base oficial até que o <code>dados.js</code> seja substituído na pasta. " +
        '<a href="#/atualizar">Gerenciar</a>';
    } else av.hidden = true;
    $("infoBase").textContent = "Fonte: " + (dados.fonte || "–") + " · atualizada em " + new Date(dados.geradoEm).toLocaleString("pt-BR") +
      " · " + B.fmt.mes(0) + " a " + B.fmt.mes(B.meses.length - 1);
    rotear();
  };

  function rotear() {
    if (!B.dados) return;
    C.limparGraficos();
    var hash = location.hash.replace(/^#\/?/, ""), partes = hash.split("?"), cam = partes[0].split("/"), params = {};
    (partes[1] || "").split("&").forEach(function (kv) { if (kv) { var p = kv.split("="); params[p[0]] = decodeURIComponent(p[1] || ""); } });
    var rota = cam[0] || "painel";
    document.querySelectorAll("#menu a").forEach(function (a) {
      a.classList.toggle("ativo", a.getAttribute("data-rota") === (rota === "municipio" ? "busca" : rota));
    });
    $("rodapeImpressao").textContent = "Gerado em " + new Date().toLocaleString("pt-BR") + " · Mês de referência: " + B.fmt.mes(mesSel) + " · Fonte: " + (B.dados.fonte || "");
    try {
      if (rota === "painel") P.painel(mesSel);
      else if (rota === "uf" && cam[1]) P.uf(mesSel, cam[1].toUpperCase());
      else if (rota === "uf") P.ufs(mesSel);
      else if (rota === "municipio") P.municipio(mesSel, +cam[1]);
      else if (rota === "busca") P.busca(mesSel, params);
      else if (rota === "atualizar") P.atualizar();
      else if (rota === "ajuda") P.ajuda();
      else P.painel(mesSel);
    } catch (e) {
      console.error(e);
      $("conteudo").innerHTML = '<p class="progresso erro">Erro ao montar a página: ' + B.esc(e.message) + "</p>";
    }
    window.scrollTo(0, 0);
  }

  /* ---------- busca rápida com sugestões ---------- */
  function buscaRapida() {
    var inp = $("buscaRapida"), ul = $("sugestoes"), atual = -1, itens = [];
    function fechar() { ul.hidden = true; atual = -1; }
    function ir(m) { inp.value = ""; fechar(); location.hash = "#/municipio/" + m.ibge; }
    inp.addEventListener("input", function () {
      var q = PCF_CONVERSOR.norm(inp.value);
      if (q.length < 2) return fechar();
      var ini = [], meio = [];
      B.munis.forEach(function (m) {
        if (String(m.ibge).indexOf(q) === 0 || m.busca.indexOf(q) === 0) ini.push(m);
        else if (m.busca.indexOf(q) > 0) meio.push(m);
      });
      itens = ini.concat(meio).slice(0, 12);
      if (!itens.length) { ul.innerHTML = '<li class="nada">Nenhum município encontrado</li>'; ul.hidden = false; return; }
      ul.innerHTML = itens.map(function (m, i) {
        return '<li data-i="' + i + '"><b>' + B.esc(m.nome) + "</b> / " + m.uf + " <small>" + m.ibge + "</small> " + C.selo(B.classe(m, mesSel)) + "</li>";
      }).join("") + '<li class="ver-todos" data-todos="1">Ver todos os resultados na busca avançada ›</li>';
      ul.hidden = false; atual = -1;
    });
    ul.addEventListener("mousedown", function (ev) {
      var li = ev.target.closest("li"); if (!li) return;
      if (li.getAttribute("data-todos")) { var q = inp.value; fechar(); inp.value = ""; location.hash = "#/busca?q=" + encodeURIComponent(q); return; }
      if (li.hasAttribute("data-i")) ir(itens[+li.getAttribute("data-i")]);
    });
    inp.addEventListener("keydown", function (ev) {
      var lis = ul.querySelectorAll("li[data-i]");
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault(); if (!lis.length) return;
        atual = (atual + (ev.key === "ArrowDown" ? 1 : -1) + lis.length) % lis.length;
        lis.forEach(function (l, i) { l.classList.toggle("sel", i === atual); });
      } else if (ev.key === "Enter") {
        if (atual >= 0) ir(itens[atual]);
        else if (itens.length === 1) ir(itens[0]);
        else if (inp.value.trim()) { var q = inp.value; fechar(); inp.value = ""; location.hash = "#/busca?q=" + encodeURIComponent(q); }
      } else if (ev.key === "Escape") fechar();
    });
    inp.addEventListener("blur", function () { setTimeout(fechar, 150); });
  }

  /* ---------- início ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    $("tituloSistema").textContent = PCF_CONFIG.titulo;
    $("subtituloSistema").textContent = PCF_CONFIG.subtitulo;
    if (g.Chart) { Chart.defaults.font.family = getComputedStyle(document.body).fontFamily; Chart.defaults.color = "#334"; }
    $("selMes").onchange = function () { mesSel = +this.value; rotear(); };
    window.addEventListener("hashchange", rotear);
    buscaRapida();

    var oficial = g.PCF_DADOS || null;
    PCF_ARMAZEM.ler().then(function (local) {
      // usa a base local só se for mais nova que a oficial publicada
      if (local && (!oficial || local.geradoEm > oficial.geradoEm)) A.usarBase(local, "local");
      else if (oficial) A.usarBase(oficial, "oficial");
      else {
        $("conteudo").innerHTML = '<section class="cartao"><h2>Nenhuma base encontrada</h2><p>O arquivo <code>dados/dados.js</code> não foi encontrado. Use “Atualizar dados” para carregar a planilha.</p></section>';
        B.dados = { meses: [], municipios: [], registros: [], campos: PCF_CONVERSOR.CAMPOS, status: ["OK", "Pago a mais", "Pago a menos"], geradoEm: "", fonte: "" };
        B.carregar(B.dados); P.atualizar();
      }
    });
  });

  g.PCF_APP = A;
})(window);
