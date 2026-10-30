"""Cifras de la entrega, calculadas desde los CSV de `datos/` y comprobadas contra los datos de referencia.

Cada cifra que aparece en la presentación sale de acá. Si un dato cambia, `verificar()` lo avisa.
"""
from __future__ import annotations

import csv
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

DATOS = Path(__file__).resolve().parent.parent / "datos"


def _leer(nombre: str) -> list[dict]:
    with (DATOS / f"{nombre}.csv").open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _fecha(texto: str) -> date:
    return date.fromisoformat(texto)


def _pct(parte: float, total: float) -> float:
    return 100 * parte / total


def calcular() -> dict:
    ventas, prov, cli = _leer("ventas"), _leer("proveedores"), _leer("clientes")
    for r in ventas:
        r["venta"], r["costo"] = float(r["venta_total"]), float(r["coste_total"])
        r["f_pedido"], r["f_envio"] = _fecha(r["fecha_pedido"]), _fecha(r["fecha_envio"])
        r["plazo"] = (r["f_envio"] - r["f_pedido"]).days

    c: dict = {}
    total, costo = sum(r["venta"] for r in ventas), sum(r["costo"] for r in ventas)
    c["ventas_total"], c["costo_total"] = total, costo
    c["margen_pct"] = _pct(total - costo, total)
    c["pedidos"] = len({r["id_pedido"] for r in ventas})
    c["unidades"] = sum(int(r["unidades"]) for r in ventas)
    c["ticket_medio"] = total / c["pedidos"]
    c["plazo_medio"] = sum(r["plazo"] for r in ventas) / len(ventas)
    c["primer_pedido"] = min(r["f_pedido"] for r in ventas)
    c["ultimo_pedido"] = max(r["f_pedido"] for r in ventas)

    # por mes (costo y margen)
    mes = defaultdict(lambda: [0.0, 0.0])
    for r in ventas:
        k = r["f_pedido"].strftime("%Y-%m")
        mes[k][0] += r["costo"]
        mes[k][1] += r["venta"] - r["costo"]
    c["por_mes"] = [(k, v[0], v[1]) for k, v in sorted(mes.items())]

    # por producto
    prod = defaultdict(lambda: [0.0, 0.0])
    for r in ventas:
        prod[r["producto"]][0] += r["venta"]
        prod[r["producto"]][1] += r["costo"]
    c["por_producto"] = sorted(
        [(p, v[0], _pct(v[0] - v[1], v[0])) for p, v in prod.items()], key=lambda x: -x[1]
    )

    # por zona, país, canal
    zona = Counter()
    for r in ventas:
        zona[r["zona"]] += r["venta"]
    c["por_zona"] = [(z, v, _pct(v, total)) for z, v in zona.most_common()]
    pais = Counter()
    for r in ventas:
        pais[r["pais"]] += r["venta"]
    c["paises"] = len(pais)
    c["top10_paises_pct"] = _pct(sum(v for _, v in pais.most_common(10)), total)
    zona_ped = Counter(r["zona"] for r in ventas)
    c["zona_pedidos"] = dict(zona_ped)
    canal = defaultdict(lambda: [0, 0.0, 0.0])
    for r in ventas:
        canal[r["canal"]][0] += 1
        canal[r["canal"]][1] += r["venta"]
        canal[r["canal"]][2] += r["costo"]
    c["por_canal"] = {k: (v[0], _pct(v[0], len(ventas)), _pct(v[1], total), _pct(v[1] - v[2], v[1])) for k, v in canal.items()}

    # plazo por prioridad
    pri = defaultdict(list)
    for r in ventas:
        pri[r["prioridad"]].append(r["plazo"])
    c["plazo_por_prioridad"] = {k: sum(v) / len(v) for k, v in pri.items()}

    # años: completos y enero-octubre
    anio = defaultdict(lambda: [0.0, set()])
    anio_eo = defaultdict(lambda: [0.0, set()])
    for r in ventas:
        a = r["f_pedido"].year
        anio[a][0] += r["venta"]
        anio[a][1].add(r["id_pedido"])
        if r["f_pedido"].month <= 10:
            anio_eo[a][0] += r["venta"]
            anio_eo[a][1].add(r["id_pedido"])
    c["por_anio"] = {a: (v[0], len(v[1])) for a, v in sorted(anio.items())}
    c["ene_oct"] = {a: (v[0], len(v[1])) for a, v in sorted(anio_eo.items())}
    c["var_ene_oct_2022"] = _pct(c["ene_oct"][2022][0] - c["ene_oct"][2021][0], c["ene_oct"][2021][0])

    # clientes con compras (ventas)
    por_cliente = Counter(r["id_cliente"] for r in ventas)
    c["clientes_con_compras"] = len(por_cliente)
    c["clientes_recurrentes"] = sum(1 for n in por_cliente.values() if n > 1)
    c["recurrentes_pct"] = _pct(c["clientes_recurrentes"], len(por_cliente))
    c["max_pedidos_cliente"] = max(por_cliente.values())
    c["distribucion_pedidos"] = dict(sorted(Counter(por_cliente.values()).items()))
    ids_maestro = {r["id"] for r in cli}
    c["ids_ventas_en_maestro"] = len(set(por_cliente) & ids_maestro)

    # proveedores
    saldo = [float(r["saldo_pendiente"]) for r in prov]
    ref = max(_fecha(r["fecha_ultima_compra"]) for r in prov)
    c["prov_fecha_ref"] = ref
    c["prov_n"], c["prov_saldo"] = len(prov), sum(saldo)
    tramos = {"0 a 12 meses": [0, 0.0], "13 a 36 meses": [0, 0.0], "Más de 36 meses": [0, 0.0]}
    for r, s in zip(prov, saldo):
        meses = (ref - _fecha(r["fecha_ultima_compra"])).days / 30.44
        k = "0 a 12 meses" if meses <= 12 else "13 a 36 meses" if meses <= 36 else "Más de 36 meses"
        tramos[k][0] += 1
        tramos[k][1] += s
    c["prov_tramos"] = {k: tuple(v) for k, v in tramos.items()}
    sin12 = tramos["13 a 36 meses"][0] + tramos["Más de 36 meses"][0]
    sin12_saldo = tramos["13 a 36 meses"][1] + tramos["Más de 36 meses"][1]
    c["prov_sin12"], c["prov_sin12_pct"] = sin12, _pct(sin12, len(prov))
    c["prov_sin12_saldo"], c["prov_sin12_saldo_pct"] = sin12_saldo, _pct(sin12_saldo, sum(saldo))
    c["prov_top10_pct"] = _pct(sum(sorted(saldo, reverse=True)[:10]), sum(saldo))
    c["prov_saldo_medio"], c["prov_saldo_max"] = sum(saldo) / len(saldo), max(saldo)

    # clientes (maestro)
    c["cli_n"] = len(cli)
    c["cli_grupos"] = dict(sorted(Counter(r["grupo"] for r in cli).items()))
    c["cli_paises"] = dict(Counter(r["pais"] for r in cli))
    edades = [int(r["edad"]) for r in cli]
    c["cli_edad_media"] = sum(edades) / len(edades)
    por_grupo = defaultdict(list)
    for r in cli:
        por_grupo[r["grupo"]].append(int(r["edad"]))
    c["cli_edad_por_grupo"] = {g: sum(v) / len(v) for g, v in sorted(por_grupo.items())}
    return c


# ---------------------------------------------------------------- formato en español
def num(x: float, dec: int = 0) -> str:
    """1289.1 -> «1.289,1»"""
    s = f"{x:,.{dec}f}"
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def millones(x: float, dec: int = 1) -> str:
    return num(x / 1e6, dec)


def pct(x: float, dec: int = 1) -> str:
    return num(x, dec) + " %"  # espacio fino: el % no se separa del número


# ---------------------------------------------------------------- control contra los datos de referencia
def verificar(c: dict) -> list[str]:
    """Devuelve los desvíos respecto de los datos de referencia (lista vacía = todo coincide)."""
    esperados = [
        ("ventas totales (M €)", round(c["ventas_total"] / 1e6, 1), 1289.1),
        ("costo total (M €)", round(c["costo_total"] / 1e6, 1), 907.1),
        ("margen bruto %", round(c["margen_pct"], 2), 29.64),
        ("pedidos", c["pedidos"], 1000),
        ("unidades", c["unidades"], 5024481),
        ("ticket medio (M €)", round(c["ticket_medio"] / 1e6, 2), 1.29),
        ("plazo medio (días)", round(c["plazo_medio"], 1), 24.0),
        ("ventas 2020 (M €)", round(c["por_anio"][2020][0] / 1e6, 1), 437.3),
        ("ventas 2021 (M €)", round(c["por_anio"][2021][0] / 1e6, 1), 483.2),
        ("ventas 2022 (M €)", round(c["por_anio"][2022][0] / 1e6, 1), 368.6),
        ("ene-oct 2021 (M €)", round(c["ene_oct"][2021][0] / 1e6, 1), 420.0),
        ("ene-oct 2022 (M €)", round(c["ene_oct"][2022][0] / 1e6, 1), 360.1),
        ("pedidos ene-oct 2022", c["ene_oct"][2022][1], 301),
        ("variación ene-oct 2022 %", round(c["var_ene_oct_2022"], 1), -14.3),
        ("países", c["paises"], 184),
        ("top10 países %", round(c["top10_paises_pct"], 1), 13.3),
        ("clientes con compras", c["clientes_con_compras"], 951),
        ("clientes recurrentes", c["clientes_recurrentes"], 48),
        ("máx. pedidos por cliente", c["max_pedidos_cliente"], 3),
        ("IDs de ventas que están en el maestro", c["ids_ventas_en_maestro"], 0),
        ("proveedores", c["prov_n"], 999),
        ("saldo total ($)", round(c["prov_saldo"]), 4265977),
        ("proveedores sin compra 12m", c["prov_sin12"], 901),
        ("saldo sin compra 12m ($)", round(c["prov_sin12_saldo"]), 3862352),
        ("proveedores >36 meses", c["prov_tramos"]["Más de 36 meses"][0], 716),
        ("saldo >36 meses ($)", round(c["prov_tramos"]["Más de 36 meses"][1]), 3003639),
        ("top10 saldos %", round(c["prov_top10_pct"], 1), 2.2),
        ("clientes (maestro)", c["cli_n"], 999),
        ("edad media", round(c["cli_edad_media"], 1), 40.9),
    ]
    dp = dict((p, (round(v / 1e6, 1), round(m, 1))) for p, v, m in c["por_producto"])
    esperados += [
        ("Cárnicos margen %", dp["Cárnicos"][1], 13.6), ("Ropa margen %", dp["Ropa"][1], 67.2),
        ("Doméstico ventas (M €)", dp["Doméstico"][0], 268.8), ("Ropa ventas (M €)", dp["Ropa"][0], 41.2),
    ]
    zonas = {z: round(p, 1) for z, _, p in c["por_zona"]}
    esperados += [("África % ventas", zonas["África"], 38.7), ("Norteamérica % ventas", zonas["Norteamérica"], 2.2)]
    for k, v in c["plazo_por_prioridad"].items():
        esperados.append((f"plazo {k}", round(v, 1), {"Crítica": 24.9, "Alta": 23.2, "Media": 24.2, "Baja": 23.9}[k]))
    esperados += [(f"grupo {g}", n, e) for (g, n), e in zip(c["cli_grupos"].items(), (208, 190, 190, 203, 208))]
    return [f"{n}: {a} (esperado {e})" for n, a, e in esperados if a != e]


if __name__ == "__main__":
    import sys

    sys.stdout.reconfigure(encoding="utf-8")
    datos = calcular()
    desvios = verificar(datos)
    print("Todas las cifras coinciden con los datos de referencia." if not desvios else "\n".join(desvios))
