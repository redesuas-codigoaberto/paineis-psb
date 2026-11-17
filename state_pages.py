"""
Gera uma página HTML por UF, cada uma contendo SÓ os dados daquele estado
(mais um contexto nacional agregado, sem detalhamento por outro estado).

Não é controle de acesso — é conveniência: cada arquivo gerado pode ser
enviado (e-mail, pasta compartilhada, etc.) só para o estado correspondente,
sem que ele precise navegar por um painel com todos os outros. Quem abrir o
arquivo e olhar o código-fonte não encontra dado de outro estado, porque ele
simplesmente não está ali — mas isso não substitui controle de acesso de
verdade caso isso vire um requisito de segurança no futuro.

Uso (chamado por atualizar_dados.py, ou direto):
    from state_pages import gerar_paginas_uf
    gerar_paginas_uf(result, saida_dir)
"""
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
GEO_FILE = BASE_DIR / "geo_brasil.json"

NAMES = {
    "AC": "Acre", "AL": "Alagoas", "AM": "Amazonas", "AP": "Amapá", "BA": "Bahia",
    "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás",
    "MA": "Maranhão", "MG": "Minas Gerais", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso",
    "PA": "Pará", "PB": "Paraíba", "PE": "Pernambuco", "PI": "Piauí", "PR": "Paraná",
    "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RO": "Rondônia", "RR": "Roraima",
    "RS": "Rio Grande do Sul", "SC": "Santa Catarina", "SE": "Sergipe", "SP": "São Paulo",
    "TO": "Tocantins",
}


def _page_html(uf: str, uf_name: str, state: dict, national: dict, updated_at: str, geo: dict) -> str:
    geo_json = json.dumps(geo, ensure_ascii=False)
    state_json = json.dumps(state, ensure_ascii=False)
    national_json = json.dumps(national, ensure_ascii=False)
    names_json = json.dumps(NAMES, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PSB no Domicílio — {uf_name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
:root {{
  --paper: #f4ede1; --paper-deep: #e9dcc6; --ink: #241c14; --ink-soft: #5c5142;
  --terracotta: #c1502e; --terracotta-deep: #973a1f; --gold: #c9a227;
  --line: rgba(36,28,20,0.16); --card: #fffaf1;
}}
* {{ box-sizing: border-box; }}
html, body {{ margin:0; padding:0; }}
body {{
  background: var(--paper);
  background-image:
    radial-gradient(circle at 15% 8%, rgba(193,80,46,0.08), transparent 40%),
    radial-gradient(circle at 85% 92%, rgba(76,100,68,0.10), transparent 45%);
  color: var(--ink); font-family: 'Space Mono', monospace; min-height: 100vh;
}}
.wrap {{ max-width: 980px; margin: 0 auto; padding: 0 24px 80px; }}
header {{ padding: 46px 0 26px; border-bottom: 1px solid var(--line); margin-bottom: 34px; }}
.eyebrow {{ font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--terracotta-deep); font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:10px; }}
.eyebrow::before {{ content:''; width:26px; height:1px; background: var(--terracotta-deep); display:inline-block; }}
h1 {{ font-family: 'Fraunces', serif; font-weight: 600; font-size: clamp(30px, 5vw, 46px); line-height:1.05; margin: 0 0 10px; }}
h1 em {{ font-style: italic; font-weight:500; color: var(--terracotta); }}
.subhead {{ font-size: 13px; color: var(--ink-soft); }}

.kpis {{ display:grid; grid-template-columns: repeat(3, 1fr); gap:1px; background: var(--line); border:1px solid var(--line); margin-bottom:36px; }}
.kpi {{ background: var(--card); padding: 24px 20px; }}
.kpi .num {{ font-family:'Fraunces', serif; font-size: 36px; font-weight:600; line-height:1; color: var(--ink); }}
.kpi.accent .num {{ color: var(--terracotta); }}
.kpi .lbl {{ font-size: 10.5px; text-transform:uppercase; letter-spacing:.08em; color: var(--ink-soft); margin-top:8px; }}

.panel {{ background: var(--card); border:1px solid var(--line); margin-bottom: 30px; }}
.panel-head {{ padding: 16px 22px; border-bottom:1px solid var(--line); }}
.panel-head h2 {{ font-family:'Fraunces', serif; font-size:18px; font-weight:600; margin:0; }}

.map-box {{ padding: 8px 8px 2px; }}
#map-svg {{ width:100%; max-width: 420px; display:block; margin: 0 auto; }}
.uf-other {{ fill: #e3d5bb; stroke: var(--paper); stroke-width:1.2; }}
.uf-mine {{ stroke: var(--ink); stroke-width:1.8; }}

.mun-list {{ padding: 8px 22px 20px; }}
.mun-row {{ display:flex; justify-content:space-between; padding: 8px 0; font-size:12.5px; border-bottom: 1px dotted var(--line); }}
.mun-row span:last-child {{ color: var(--ink-soft); }}
.empty {{ font-size:13px; color: var(--ink-soft); font-style:italic; padding: 14px 0; }}

.context {{ font-size: 11.5px; color: var(--ink-soft); padding: 16px 22px; line-height:1.7; }}
.context b {{ color: var(--ink); }}

footer {{ margin-top: 40px; padding-top: 18px; border-top:1px solid var(--line); font-size:11px; color: var(--ink-soft); }}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">SUAS · Proteção Social Básica</div>
    <h1>PSB no Domicílio — <em>{uf_name}</em></h1>
    <div class="subhead">Adesão do estado ao Serviço de PSB no Domicílio (Gestantes e Crianças). Atualizado em <span id="dt"></span>.</div>
  </header>

  <section class="kpis" id="kpis"></section>

  <div class="panel">
    <div class="panel-head"><h2>Localização no mapa</h2></div>
    <div class="map-box">
      <svg id="map-svg" viewBox="{geo['viewbox']}" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
  </div>

  <div class="panel">
    <div class="panel-head"><h2>Municípios que aderiram em {uf_name}</h2></div>
    <div class="mun-list" id="mun-list"></div>
  </div>

  <div class="panel">
    <div class="panel-head"><h2>Contexto nacional</h2></div>
    <div class="context" id="national-context"></div>
  </div>

  <footer>Serviço de PSB no Domicílio — Gestantes e Crianças · Página individual de {uf_name}</footer>
</div>

<script>
const UF = "{uf}";
const UF_NAME = "{uf_name}";
const GEO = {geo_json};
const STATE = {state_json};
const NATIONAL = {national_json};
const NAMES = {names_json};

document.getElementById('dt').textContent = new Date("{updated_at}").toLocaleString('pt-BR', {{dateStyle:'long', timeStyle:'short'}});

document.getElementById('kpis').innerHTML = `
  <div class="kpi accent"><div class="num">${{STATE.aderiram}}</div><div class="lbl">municípios que aderiram</div></div>
  <div class="kpi"><div class="num">${{STATE.pct}}%</div><div class="lbl">de ${{STATE.total}} municípios ofertados</div></div>
  <div class="kpi"><div class="num">${{STATE.meta_fisica_aceita.toLocaleString('pt-BR')}}</div><div class="lbl">meta física aceita (vagas)</div></div>
`;

const svg = document.getElementById('map-svg');
Object.entries(GEO.paths).forEach(([code, d]) => {{
  const path = document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d', d);
  path.setAttribute('class', code === UF ? 'uf-mine' : 'uf-other');
  path.setAttribute('fill', code === UF ? '#973a1f' : '#e3d5bb');
  svg.appendChild(path);
}});

const munList = document.getElementById('mun-list');
munList.innerHTML = STATE.municipios.length
  ? STATE.municipios.map(m => `<div class="mun-row"><span>${{m.nome}}</span><span>${{Math.round(m.meta)}} vagas</span></div>`).join('')
  : `<div class="empty">Nenhum município aderiu em ${{UF_NAME}} até o momento.</div>`;

const pctNacional = NATIONAL.total ? (100*NATIONAL.aderiram/NATIONAL.total).toFixed(1) : '0.0';
document.getElementById('national-context').innerHTML = `
  Em todo o Brasil, <b>${{NATIONAL.aderiram.toLocaleString('pt-BR')}}</b> de <b>${{NATIONAL.total.toLocaleString('pt-BR')}}</b>
  municípios ofertados aderiram ao serviço (<b>${{pctNacional}}%</b>). Esta página mostra apenas os dados de ${{UF_NAME}} —
  para o panorama completo de outros estados, consulte o painel nacional.
`;
</script>
</body>
</html>
"""


def gerar_paginas_uf(result: dict, saida_dir: Path) -> list:
    """Gera um arquivo <UF>.html por estado dentro de saida_dir.
    Retorna a lista de arquivos gerados."""
    geo = json.loads(GEO_FILE.read_text(encoding="utf-8"))
    states = result["states"]
    meta = result["meta"]
    updated_at = meta.get("updated_at") or ""

    national = {
        "total": sum(s["total"] for s in states.values()),
        "aderiram": sum(s["aderiram"] for s in states.values()),
    }

    saida_dir.mkdir(parents=True, exist_ok=True)
    gerados = []
    for uf, state in states.items():
        uf_name = NAMES.get(uf, uf)
        html = _page_html(uf, uf_name, state, national, updated_at, geo)
        out_path = saida_dir / f"{uf}.html"
        out_path.write_text(html, encoding="utf-8")
        gerados.append(out_path)
    return gerados
