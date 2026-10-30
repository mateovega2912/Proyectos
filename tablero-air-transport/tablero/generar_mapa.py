"""Arma `tablero/mapa.js` desde `tablero/vendor/world.json` (mapa del mundo de ECharts 4.9.0, licencia Apache 2.0).

Reduce las coordenadas a 2 decimales y agrega la equivalencia entre los nombres de los datos y los del mapa.
Los países de los datos que el mapa no dibuja (por tamaño) no se ocultan: el tablero los declara en el gráfico.

Uso:  python tablero/generar_mapa.py
"""
import csv
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# nombre en los datos -> nombre en el mapa (solo donde es el mismo país escrito distinto)
EQUIVALENCIAS = {
    "Antigua and Barbuda": "Antigua and Barb.", "Bosnia and Herzegovina": "Bosnia and Herz.", "Central African Republic": "Central African Rep.",
    "Cote d'Ivoire": "Côte d'Ivoire", "Czech Republic": "Czech Rep.", "Democratic Republic of the Congo": "Dem. Rep. Congo",
    "Dominican Republic": "Dominican Rep.", "East Timor": "Timor-Leste", "Equatorial Guinea": "Eq. Guinea", "Federated States of Micronesia": "Micronesia",
    "Laos": "Lao PDR", "North Korea": "Dem. Rep. Korea", "Republic of the Congo": "Congo", "Saint Vincent and the Grenadines": "St. Vin. and Gren.",
    "Sao Tome and Principe": "São Tomé and Principe", "Solomon Islands": "Solomon Is.", "South Korea": "Korea", "South Sudan": "S. Sudan",
    "The Bahamas": "Bahamas", "The Gambia": "Gambia", "United States of America": "United States",
    "Estados Unidos": "United States", "Reino Unido": "United Kingdom",  # clientes.csv usa los nombres en español
}


def redondear(c):
    return round(c, 2) if isinstance(c, (int, float)) else [redondear(x) for x in c]


def paises_de_datos():
    nombres = set()
    for archivo, col in (("ventas", "pais"), ("clientes", "pais")):
        with (RAIZ / "datos" / f"{archivo}.csv").open(encoding="utf-8", newline="") as f:
            nombres |= {r[col].strip() for r in csv.DictReader(f)}
    return nombres


def construir():
    geo = json.loads((RAIZ / "tablero" / "vendor" / "world.json").read_text(encoding="utf-8"))
    regiones = [{"type": "Feature", "properties": {"name": f["properties"]["name"]},
                 "geometry": {"type": f["geometry"]["type"], "coordinates": redondear(f["geometry"]["coordinates"])}}
                for f in geo["features"] if f["properties"]["name"]]
    nombres_mapa = {r["properties"]["name"] for r in regiones}
    sin_poligono = sorted(p for p in paises_de_datos() if EQUIVALENCIAS.get(p, p) not in nombres_mapa)
    return {"type": "FeatureCollection", "features": regiones}, EQUIVALENCIAS, sin_poligono


if __name__ == "__main__":
    mapa, nombres, sin = construir()
    destino = RAIZ / "tablero" / "mapa.js"
    destino.write_text("window.MAPA = " + json.dumps(mapa, ensure_ascii=False, separators=(",", ":")) + ";\nwindow.MAPA_NOMBRES = "
                       + json.dumps(nombres, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{destino.relative_to(RAIZ)}: {destino.stat().st_size // 1024} KB, {len(mapa['features'])} regiones")
    print("países de los datos que el mapa no dibuja:", ", ".join(sin))
