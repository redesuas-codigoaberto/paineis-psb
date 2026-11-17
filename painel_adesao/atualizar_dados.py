"""
Atualiza os dados do mapa a partir de uma planilha nova.

Uso:
    python atualizar_dados.py caminho/para/planilha.xlsx
    python atualizar_dados.py caminho/para/planilha.xlsx --sem-paginas-uf

O que faz:
  1. Lê e valida a planilha (mesmas colunas de sempre: UF, Ente, Meta Física,
     Resposta à Oferta, opcionalmente Meta Física Aceita).
  2. Reescreve site/index.html, substituindo só o bloco de dados embutido
     (entre os marcadores /*__DATA_JSON_START__*/ e /*__DATA_JSON_END__*/)
     pelos dados novos. O resto do arquivo (mapa, estilos, layout) não muda.
  3. Gera (ou atualiza) uma página por UF em site_por_uf/<UF>.html, cada uma
     contendo só os dados daquele estado — para distribuir individualmente
     sem que um estado precise ver o painel com todos os outros. Use
     --sem-paginas-uf para pular esta etapa.
  4. Guarda uma cópia da planilha e do JSON gerado em historico/, com
     timestamp, para auditoria / rollback.

Os dados ficam embutidos direto no HTML — não precisa de servidor, de fetch,
nem de abrir porta nenhuma. Depois de rodar isto, é só abrir
site/index.html (painel nacional) ou site_por_uf/<UF>.html (painel do
estado) com duplo clique.
"""
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
import openpyxl


from parser import parse_workbook, PlanilhaInvalidaError
from state_pages import gerar_paginas_uf

BASE_DIR = Path(__file__).resolve().parent
SITE_DIR = BASE_DIR / "site"
INDEX_FILE = SITE_DIR / "index.html"
UF_OUT_DIR = BASE_DIR / "site_por_uf"
HISTORY_DIR = BASE_DIR / "historico"

MARKER_START = "/*__DATA_JSON_START__*/"
MARKER_END = "/*__DATA_JSON_END__*/"
INJECT_PATTERN = re.compile(
    re.escape(MARKER_START) + r".*?" + re.escape(MARKER_END), re.DOTALL
)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    gerar_uf = "--sem-paginas-uf" not in flags

    if len(args) != 1:
        print("Uso: python atualizar_dados.py caminho/para/planilha.xlsx [--sem-paginas-uf]")
        sys.exit(1)

    xlsx_path = Path(args[0])
    if not xlsx_path.exists():
        print(f"Arquivo não encontrado: {xlsx_path}")
        sys.exit(1)
    if xlsx_path.suffix.lower() != ".xlsx":
        print("O arquivo precisa ser .xlsx")
        sys.exit(1)

    print(f"Lendo {xlsx_path.name}...")
    try:
        result = parse_workbook(str(xlsx_path))
    except PlanilhaInvalidaError as e:
        print(f"\nPlanilha rejeitada: {e}")
        sys.exit(1)
    except Exception as e:  # noqa: BLE001
        print(f"\nErro ao ler a planilha: {e}")
        sys.exit(1)

    meta = result["meta"]
    print(f"OK: {meta['linhas_lidas']} municípios lidos, {meta['ufs_encontradas']} UFs.")
    if meta["linhas_ignoradas"]:
        print(f"Aviso: {meta['linhas_ignoradas']} linhas sem UF foram ignoradas.")

    if not INDEX_FILE.exists():
        print(f"\nNão encontrei {INDEX_FILE}. A pasta site/ precisa ter o index.html original.")
        sys.exit(1)

    html = INDEX_FILE.read_text(encoding="utf-8")
    payload_json = json.dumps(result, ensure_ascii=False)
    new_block = f"{MARKER_START}{payload_json}{MARKER_END}"
    new_html, n_subs = INJECT_PATTERN.subn(new_block, html)
    if n_subs != 1:
        print(
            f"\nNão encontrei o marcador de dados esperado em {INDEX_FILE} "
            f"(esperava 1 ocorrência, achei {n_subs}). O arquivo pode ter sido editado à mão — "
            "restaure o index.html original antes de rodar de novo."
        )
        sys.exit(1)
    INDEX_FILE.write_text(new_html, encoding="utf-8")
    print(f"Atualizado: {INDEX_FILE}")

    if gerar_uf:
        gerados = gerar_paginas_uf(result, UF_OUT_DIR)
        print(f"Geradas {len(gerados)} páginas por UF em {UF_OUT_DIR}/")

    HISTORY_DIR.mkdir(exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M%S")
    shutil.copy(xlsx_path, HISTORY_DIR / f"{ts}.xlsx")
    (HISTORY_DIR / f"{ts}.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Cópia salva em historico/{ts}.xlsx")


if __name__ == "__main__":
    main()
