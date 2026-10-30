"""Convierte los CSV de `datos/` en `tablero/datos.js` (una sola vez; el tablero no lee nada más).

Uso:  python tablero/generar_datos.py
"""
import csv
import json
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TRAMOS_EDAD = [(30, "26 a 30"), (35, "31 a 35"), (40, "36 a 40"), (45, "41 a 45"), (50, "46 a 50")]


def leer(nombre):
    with (RAIZ / "datos" / f"{nombre}.csv").open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def dias(a, b):
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def tramo_edad(edad):
    return next((t for tope, t in TRAMOS_EDAD if edad <= tope), "51 a 56")


def construir():
    ventas = []
    for r in leer("ventas"):
        plazo = dias(r["fecha_pedido"], r["fecha_envio"])
        f = date.fromisoformat(r["fecha_pedido"])
        doy = f.timetuple().tm_yday  # día del año (1 a 366); las semanas son bloques de 7 días desde el 1 de enero
        sem, trim, semestre = (doy - 1) // 7 + 1, (f.month - 1) // 3 + 1, 1 if f.month <= 6 else 2
        ventas.append({
            "id": r["id_pedido"], "cli": r["id_cliente"], "zona": r["zona"], "pais": r["pais"], "producto": r["producto"],
            "canal": r["canal"], "prioridad": r["prioridad"], "fecha": r["fecha_pedido"],
            "anio": int(r["fecha_pedido"][:4]), "mes": r["fecha_pedido"][:7], "mesN": int(r["fecha_pedido"][5:7]),
            "unidades": int(r["unidades"]), "venta": float(r["venta_total"]), "costo": float(r["coste_total"]),
            "plazo": plazo, "tramoPlazo": plazo // 5 * 5,
            "diaN": doy, "semanaN": sem, "sem": f"{f.year}-W{sem:02d}", "trimN": trim, "trim": f"{f.year}-T{trim}",
            "semestreN": semestre, "semestre": f"{f.year}-S{semestre}",
        })
    prov = leer("proveedores")
    ref = max(r["fecha_ultima_compra"] for r in prov)
    proveedores = []
    for r in prov:
        meses = dias(r["fecha_ultima_compra"], ref) / 30.44
        saldo = float(r["saldo_pendiente"])
        proveedores.append({
            "id": r["id"], "nombre": r["proveedor"], "saldo": saldo, "fecha": r["fecha_ultima_compra"],
            "anioUlt": int(r["fecha_ultima_compra"][:4]), "meses": round(meses, 4),
            "tramo": "0 a 12 meses" if meses <= 12 else "13 a 36 meses" if meses <= 36 else "Más de 36 meses",
            "tramoSaldo": int(saldo // 2000 * 2000),
        })
    clientes = [{
        "id": r["id"], "grupo": r["grupo"], "pais": r["pais"], "estado": r["estado"] or "(sin estado)",
        "edad": int(r["edad"]), "alta": int(r["fecha_alta"][:4]), "tramoEdad": tramo_edad(int(r["edad"])),
    } for r in leer("clientes")]
    meta = {
        "ventasDesde": min(v["fecha"] for v in ventas), "ventasHasta": max(v["fecha"] for v in ventas),
        "provRef": ref, "provDesde": min(p["fecha"] for p in proveedores),
        "altaDesde": min(c["alta"] for c in clientes), "altaHasta": max(c["alta"] for c in clientes),
    }
    return {"ventas": ventas, "proveedores": proveedores, "clientes": clientes, "meta": meta}


if __name__ == "__main__":
    datos = construir()
    destino = RAIZ / "tablero" / "datos.js"
    destino.write_text("window.DATOS = " + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{destino.relative_to(RAIZ)}: {destino.stat().st_size // 1024} KB")
