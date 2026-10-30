"""Sirve la carpeta tablero/ en http://localhost:PUERTO (solo para ver el tablero con la vista previa; también abre con doble clic en index.html)."""
import functools
import http.server
import os
import sys
from pathlib import Path


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # cada recarga ve los archivos al día
        super().end_headers()


puerto = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8765))
manejador = functools.partial(SinCache, directory=str(Path(__file__).resolve().parent))
print(f"Tablero en http://localhost:{puerto}", flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", puerto), manejador).serve_forever()
