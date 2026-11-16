/* =====================================================================
   ARMAZENAMENTO LOCAL (IndexedDB) – guarda a base enviada por upload
   apenas NESTE navegador. Para todos verem, publique o dados.js.
   ===================================================================== */
(function (g) {
  "use strict";
  var NOME = "pcf_monitoramento", STORE = "base", CHAVE = "atual";

  function abrir() {
    return new Promise(function (ok, erro) {
      if (!g.indexedDB) return erro(new Error("IndexedDB indisponível"));
      var req = g.indexedDB.open(NOME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { ok(req.result); };
      req.onerror = function () { erro(req.error); };
    });
  }
  function op(modo, fn) {
    return abrir().then(function (db) {
      return new Promise(function (ok, erro) {
        var tx = db.transaction(STORE, modo), st = tx.objectStore(STORE), req = fn(st);
        tx.oncomplete = function () { ok(req && req.result); db.close(); };
        tx.onerror = function () { erro(tx.error); db.close(); };
      });
    });
  }

  g.PCF_ARMAZEM = {
    ler: function () { return op("readonly", function (s) { return s.get(CHAVE); }).catch(function () { return null; }); },
    salvar: function (dados) { return op("readwrite", function (s) { return s.put(dados, CHAVE); }); },
    limpar: function () { return op("readwrite", function (s) { return s.delete(CHAVE); }); },

    /* Gera o arquivo dados.js para substituir na pasta compartilhada */
    baixarDadosJs: function (dados) {
      var txt = "/* Gerado pelo sistema em " + dados.geradoEm + " – não edite à mão */\nwindow.PCF_DADOS=" + JSON.stringify(dados) + ";\n";
      var url = URL.createObjectURL(new Blob([txt], { type: "application/javascript;charset=utf-8" }));
      var a = document.createElement("a"); a.href = url; a.download = "dados.js";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }
  };
})(window);
