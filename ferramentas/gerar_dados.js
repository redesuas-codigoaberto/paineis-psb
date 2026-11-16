/* Gera dados/dados.js a partir de uma planilha, pela linha de comando.
   Uso (na pasta do sistema):
     node ferramentas/gerar_dados.js caminho/da/planilha.xlsx
   Requer Node.js. Usa as mesmas bibliotecas da pasta lib/.            */
const fs = require("fs");
const path = require("path");
const raiz = path.join(__dirname, "..");
const XLSX = require(path.join(raiz, "lib", "xlsx.full.min.js"));
require(path.join(raiz, "js", "config.js"));
const conv = require(path.join(raiz, "js", "conversor.js"));
const cfg = globalThis.PCF_CONFIG;

const arq = process.argv[2];
if (!arq) { console.error("Informe a planilha: node ferramentas/gerar_dados.js planilha.xlsx"); process.exit(1); }

const wb = XLSX.read(fs.readFileSync(arq), { type: "buffer", cellDates: false });
const aba = wb.SheetNames.includes(cfg.aba) ? cfg.aba : wb.SheetNames[0];
const linhas = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, raw: true, defval: null });
const r = conv.converterLinhas(linhas, cfg, XLSX, path.basename(arq));
r.avisos.forEach(a => console.warn("Aviso:", a));
const saida = path.join(raiz, "dados", "dados.js");
fs.writeFileSync(saida, "/* Gerado automaticamente em " + r.dados.geradoEm + " – não edite à mão */\nwindow.PCF_DADOS=" + JSON.stringify(r.dados) + ";\n");
console.log(`OK: ${r.dados.municipios.length} municípios, ${r.dados.registros.length} registros, meses ${r.dados.meses[0]} a ${r.dados.meses.at(-1)}`);
console.log("Arquivo gerado:", saida, (fs.statSync(saida).size / 1e6).toFixed(1) + " MB");
