"""
Lê a planilha do Serviço de PSB no Domicílio (Gestantes e Crianças) e agrega
os dados por UF no mesmo formato consumido pelo front-end (data.json).

Localiza as colunas pelo NOME do cabeçalho (não pela posição), para tolerar
pequenas variações de layout entre as planilhas enviadas.
"""
from __future__ import annotations

import unicodedata
from collections import defaultdict
from datetime import datetime, timezone

import openpyxl

REQUIRED_COLUMNS = ["UF", "Ente", "Meta Física", "Resposta à Oferta"]
OPTIONAL_COLUMNS = ["Meta Física Aceita"]


class PlanilhaInvalidaError(Exception):
    """Levantado quando a planilha não tem as colunas mínimas esperadas."""


def _norm(s: str) -> str:
    s = str(s or "").strip().lower()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s


def _find_header_row(ws, max_scan_rows: int = 5):
    """Procura a linha de cabeçalho nas primeiras `max_scan_rows` linhas."""
    wanted = {_norm(c) for c in REQUIRED_COLUMNS}
    for row_idx in range(1, max_scan_rows + 1):
        row_vals = [cell.value for cell in ws[row_idx]]
        norm_vals = {_norm(v) for v in row_vals if v}
        if wanted.issubset(norm_vals):
            return row_idx, row_vals
    raise PlanilhaInvalidaError(
        "Não encontrei as colunas esperadas (UF, Ente, Meta Física, Resposta à Oferta) "
        "nas primeiras linhas da planilha. Verifique se a aba e o cabeçalho não mudaram."
    )


def parse_workbook(path: str) -> dict:
    wb = openpyxl.load_workbook(path, data_only=True)

    # usa a primeira aba que tiver o cabeçalho esperado
    ws = None
    header_row_idx = None
    header_vals = None
    errors = []
    for sheet in wb.worksheets:
        try:
            header_row_idx, header_vals = _find_header_row(sheet)
            ws = sheet
            break
        except PlanilhaInvalidaError as e:
            errors.append(f"{sheet.title}: {e}")
    if ws is None:
        raise PlanilhaInvalidaError(" | ".join(errors) or "Nenhuma aba com cabeçalho reconhecível.")

    col_index = {}
    for idx, val in enumerate(header_vals):
        norm = _norm(val)
        for wanted in REQUIRED_COLUMNS + OPTIONAL_COLUMNS:
            if _norm(wanted) == norm:
                col_index[wanted] = idx

    missing = [c for c in REQUIRED_COLUMNS if c not in col_index]
    if missing:
        raise PlanilhaInvalidaError(f"Colunas obrigatórias ausentes: {', '.join(missing)}")

    ufs = defaultdict(lambda: {"total": 0, "aderiram": 0, "meta_fisica_aceita": 0.0, "municipios": []})
    linhas_lidas = 0
    linhas_ignoradas = 0

    for row in ws.iter_rows(min_row=header_row_idx + 1, values_only=True):
        if col_index["UF"] >= len(row):
            continue
        uf = row[col_index["UF"]]
        ente = row[col_index["Ente"]] if col_index["Ente"] < len(row) else None
        resposta = row[col_index["Resposta à Oferta"]] if col_index["Resposta à Oferta"] < len(row) else None
        meta_fisica = row[col_index["Meta Física"]] if col_index["Meta Física"] < len(row) else None
        meta_fisica_aceita = None
        if "Meta Física Aceita" in col_index and col_index["Meta Física Aceita"] < len(row):
            meta_fisica_aceita = row[col_index["Meta Física Aceita"]]

        if not uf:
            linhas_ignoradas += 1
            continue
        uf = str(uf).strip().upper()

        linhas_lidas += 1
        ufs[uf]["total"] += 1

        if resposta and "aceit" in _norm(str(resposta)):
            ufs[uf]["aderiram"] += 1
            try:
                mfa = float(meta_fisica_aceita) if meta_fisica_aceita not in (None, "") else float(meta_fisica or 0)
            except (TypeError, ValueError):
                mfa = 0.0
            ufs[uf]["meta_fisica_aceita"] += mfa
            ufs[uf]["municipios"].append({"nome": str(ente or "").strip(), "meta": mfa})

    if linhas_lidas == 0:
        raise PlanilhaInvalidaError("Nenhuma linha de dados foi lida — verifique se a aba correta foi enviada.")

    out = {}
    for uf, d in sorted(ufs.items()):
        out[uf] = {
            "total": d["total"],
            "aderiram": d["aderiram"],
            "pct": round(100 * d["aderiram"] / d["total"], 1) if d["total"] else 0,
            "meta_fisica_aceita": int(d["meta_fisica_aceita"]),
            "municipios": sorted(d["municipios"], key=lambda m: -m["meta"]),
        }

    return {
        "states": out,
        "meta": {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "linhas_lidas": linhas_lidas,
            "linhas_ignoradas": linhas_ignoradas,
            "ufs_encontradas": len(out),
        },
    }
