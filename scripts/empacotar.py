"""Gera dist/farmazap-<versão>.zip para publicar na Chrome Web Store.

Uso (na raiz do projeto):  python scripts/empacotar.py
Inclui só o que a extensão usa: manifest.json, src/ e icons/.
"""
import json
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
INCLUIR = ["manifest.json", "src", "icons"]

manifest = json.loads((RAIZ / "manifest.json").read_text(encoding="utf-8"))
versao = manifest["version"]

# Confere se todo arquivo citado no manifest existe
citados = set(manifest.get("icons", {}).values())
citados |= set(manifest.get("action", {}).get("default_icon", {}).values())
citados |= {manifest["action"]["default_popup"], manifest["options_page"], manifest["background"]["service_worker"]}
for cs in manifest.get("content_scripts", []):
    citados |= set(cs.get("js", [])) | set(cs.get("css", []))
faltando = sorted(p for p in citados if not (RAIZ / p).is_file())
if faltando:
    raise SystemExit(f"Arquivos citados no manifest que não existem: {faltando}")

arquivos = []
for item in INCLUIR:
    caminho = RAIZ / item
    arquivos += [caminho] if caminho.is_file() else sorted(p for p in caminho.rglob("*") if p.is_file())

destino = RAIZ / "dist" / f"farmazap-{versao}.zip"
destino.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(destino, "w", zipfile.ZIP_DEFLATED) as z:
    for f in arquivos:
        z.write(f, f.relative_to(RAIZ).as_posix())

print(f"{destino.relative_to(RAIZ)}  ({destino.stat().st_size / 1024:.1f} KB, {len(arquivos)} arquivos)")
for f in arquivos:
    print("  ", f.relative_to(RAIZ).as_posix())
