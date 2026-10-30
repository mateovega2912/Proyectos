"""Junta `index.html`, el CSS y todos los scripts en un solo archivo: `tablero/Tablero-Air-Transport.html`.

Ese archivo funciona en cualquier visor (también donde no se cargan los archivos vecinos, como el panel de archivos de la app)
y se puede mandar por mail. Hay que volver a correrlo cuando cambie algo del tablero.

Uso:  python tablero/empaquetar.py
"""
import re
from pathlib import Path

CARPETA = Path(__file__).resolve().parent
SALIDA = CARPETA / "Tablero-Air-Transport.html"


def _seguro(codigo: str) -> str:
    """Evita que el contenido de un script cierre la etiqueta o abra un comentario HTML."""
    return codigo.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def construir() -> str:
    html = (CARPETA / "index.html").read_text(encoding="utf-8")
    css = (CARPETA / "estilos.css").read_text(encoding="utf-8")
    html, n = re.subn(r'<link rel="stylesheet" href="estilos\.css">', lambda _: "<style>\n" + css + "</style>", html)
    assert n == 1, "no encontré el enlace al CSS"

    def script(m):
        return "<script>\n" + _seguro((CARPETA / m.group(1)).read_text(encoding="utf-8")) + "\n</script>"

    html, n = re.subn(r'<script src="([^"]+)"></script>', script, html)
    assert n >= 6, "no encontré los scripts del tablero"
    assert "<script src=" not in html and "<link " not in html, "quedó una referencia a un archivo externo"
    return html


if __name__ == "__main__":
    SALIDA.write_text(construir(), encoding="utf-8", newline="\n")
    print(f"{SALIDA.relative_to(CARPETA.parent)}: {SALIDA.stat().st_size // 1024} KB")
