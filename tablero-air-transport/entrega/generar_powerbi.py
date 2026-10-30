"""Genera el proyecto de Power BI (.pbip) del tablero de Air Transport.

Uso:  python entrega/generar_powerbi.py
Crea `entrega/powerbi/` con:
  AirTransport.pbip              el archivo que se abre con doble clic en Power BI Desktop
  AirTransport.SemanticModel/    el modelo (TMDL): tres tablas, calendario, columnas y medidas de la guía
  AirTransport.Report/           el informe (PBIR): cuatro páginas, tooltip, filtros sincronizados y navegador

El diseño sigue `referencia/guia-presentacion-y-power-bi.md`. Los datos no van dentro del proyecto: se leen
de la carpeta `datos/` con el parámetro `RutaDatos` (se cambia en Transformar datos > Administrar parámetros).
"""
from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = Path(__file__).resolve().parent / "powerbi"
NOMBRE = "AirTransport"
TEMA_ORIGEN = RAIZ / "referencia" / "AirTransport-tema.json"
TEMA_ARCHIVO = "AirTransport-3f9c2a71.json"

# Versiones de los esquemas JSON (las mismas que entiende cualquier Power BI Desktop reciente)
S = "https://developer.microsoft.com/json-schemas/fabric/"
ESQ = {
    "pbip": S + "pbip/pbipProperties/1.0.0/schema.json",
    "pbir": S + "item/report/definitionProperties/2.0.0/schema.json",
    "pbism": S + "item/semanticModel/definitionProperties/1.0.0/schema.json",
    "version": S + "item/report/definition/versionMetadata/1.0.0/schema.json",
    "report": S + "item/report/definition/report/3.0.0/schema.json",
    "pages": S + "item/report/definition/pagesMetadata/1.0.0/schema.json",
    "page": S + "item/report/definition/page/2.0.0/schema.json",
    "visual": S + "item/report/definition/visualContainer/2.0.0/schema.json",
}
VERSIONES = {"visual": "2.0.0", "page": "2.0.0", "report": "3.0.0"}


def _id(*partes: str) -> str:
    return hashlib.md5(":".join(partes).encode()).hexdigest()[:20]


def _guid(*partes: str) -> str:
    h = hashlib.md5(":".join(partes).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}"


def escribir(ruta: Path, contenido: str) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(contenido, encoding="utf-8", newline="\n")


def escribir_json(ruta: Path, datos: dict) -> None:
    escribir(ruta, json.dumps(datos, ensure_ascii=False, indent=2) + "\n")


# ==========================================================================
# MODELO SEMÁNTICO (TMDL)
# ==========================================================================
def q(nombre: str) -> str:
    """Nombre de objeto TMDL: entre comillas simples si trae algo más que letras, números o guion bajo."""
    return nombre if nombre.replace("_", "").isalnum() else "'" + nombre.replace("'", "''") + "'"


def columna(nombre, tipo, *, formato=None, resumen="none", oculta=False, ordenar_por=None, clave=False):
    L = [f"\tcolumn {q(nombre)}", f"\t\tdataType: {tipo}"]
    if formato:
        L.append(f"\t\tformatString: {formato}")
    if clave:
        L.append("\t\tisKey")
    if oculta:
        L.append("\t\tisHidden")
    L.append(f"\t\tsummarizeBy: {resumen}")
    L.append(f"\t\tsourceColumn: {nombre}")
    if ordenar_por:
        L.append(f"\t\tsortByColumn: {q(ordenar_por)}")
    return "\n".join(L) + "\n"


def columna_calculada(nombre, dax, tipo, *, formato=None, resumen="none", oculta=False, ordenar_por=None):
    L = [f"\tcolumn {q(nombre)} = {dax}", f"\t\tdataType: {tipo}"]
    if formato:
        L.append(f"\t\tformatString: {formato}")
    if oculta:
        L.append("\t\tisHidden")
    L.append(f"\t\tsummarizeBy: {resumen}")
    if ordenar_por:
        L.append(f"\t\tsortByColumn: {q(ordenar_por)}")
    return "\n".join(L) + "\n"


def medida(nombre, dax, formato=None):
    L = [f"\tmeasure {q(nombre)} = {dax}"]
    if formato:
        L.append(f"\t\tformatString: {formato}")
    return "\n".join(L) + "\n"


def particion_csv(tabla, archivo, tipos):
    """Consulta de Power Query de la guía: lee el CSV con punto decimal y fija los tipos."""
    lista = ", ".join(f'{{"{c}", {t}}}' for c, t in tipos)
    return (
        f"\tpartition {q(tabla)} = m\n\t\tmode: import\n\t\tsource =\n"
        "\t\t\t\tlet\n"
        f"\t\t\t\t  Origen = Csv.Document(File.Contents(RutaDatos & \"{archivo}\"), [Delimiter=\",\", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),\n"
        "\t\t\t\t  Enc = Table.PromoteHeaders(Origen, [PromoteAllScalars=true]),\n"
        f"\t\t\t\t  Tipos = Table.TransformColumnTypes(Enc, {{{lista}}}, \"en-US\")\n"
        "\t\t\t\tin\n"
        "\t\t\t\t  Tipos\n"
    )


def tabla_ventas():
    t = "table Ventas\n\n"
    t += columna("id_pedido", "string") + columna("id_cliente", "string") + columna("zona", "string")
    t += columna("pais", "string") + columna("producto", "string") + columna("canal", "string")
    t += columna("prioridad", "string", oculta=True)
    t += columna("fecha_pedido", "dateTime", formato="Short Date") + columna("fecha_envio", "dateTime", formato="Short Date")
    t += columna("unidades", "int64", formato="#,0", resumen="sum")
    t += columna("precio_unit", "double", formato="#,0.00", resumen="none") + columna("coste_unit", "double", formato="#,0.00", resumen="none")
    t += columna("venta_total", "double", formato="#,0.00", resumen="sum") + columna("coste_total", "double", formato="#,0.00", resumen="sum")
    t += columna_calculada("Plazo envío (días)", "DATEDIFF(Ventas[fecha_pedido], Ventas[fecha_envio], DAY)", "int64", formato="0")
    t += columna_calculada("Plazo envío (tramo de 5 días)", "FLOOR(Ventas[Plazo envío (días)], 5)", "int64", formato="0")
    t += columna_calculada("Prioridad del pedido", "Ventas[prioridad]", "string", ordenar_por="Prioridad orden")
    t += columna_calculada(
        "Prioridad orden",
        'SWITCH(Ventas[prioridad], "Crítica", 1, "Alta", 2, "Media", 3, "Baja", 4, 5)', "int64", formato="0", oculta=True,
    )
    tipos = [("id_pedido", "type text"), ("id_cliente", "type text"), ("zona", "type text"), ("pais", "type text"),
             ("producto", "type text"), ("canal", "type text"), ("prioridad", "type text"), ("fecha_pedido", "type date"),
             ("fecha_envio", "type date"), ("unidades", "Int64.Type"), ("precio_unit", "type number"),
             ("coste_unit", "type number"), ("venta_total", "type number"), ("coste_total", "type number")]
    return t + "\n" + particion_csv("Ventas", "ventas.csv", tipos)


def tabla_proveedores():
    t = "table Proveedores\n\n"
    t += columna("id", "string") + columna("proveedor", "string")
    t += columna("saldo_pendiente", "double", formato="$ #,0", resumen="sum")
    t += columna("fecha_ultima_compra", "dateTime", formato="Short Date")
    t += columna_calculada(
        "Meses sin compra",
        "DIVIDE(DATEDIFF(Proveedores[fecha_ultima_compra], CALCULATE(MAX(Proveedores[fecha_ultima_compra]), ALL(Proveedores)), DAY), 30.44)",
        "double", formato="0.0",
    )
    t += columna_calculada(
        "Tramo proveedor",
        'SWITCH(TRUE(), Proveedores[Meses sin compra] <= 12, "0 a 12 meses", Proveedores[Meses sin compra] <= 36, "13 a 36 meses", "Más de 36 meses")',
        "string", ordenar_por="Tramo proveedor orden",
    )
    t += columna_calculada(
        "Tramo proveedor orden",
        "SWITCH(TRUE(), Proveedores[Meses sin compra] <= 12, 1, Proveedores[Meses sin compra] <= 36, 2, 3)", "int64", formato="0", oculta=True,
    )
    t += columna_calculada("Año última compra", "YEAR(Proveedores[fecha_ultima_compra])", "int64", formato="0")
    t += columna_calculada("Saldo (tramo de 2.000)", "FLOOR(Proveedores[saldo_pendiente], 2000)", "int64", formato="#,0")
    tipos = [("id", "type text"), ("proveedor", "type text"), ("saldo_pendiente", "type number"), ("fecha_ultima_compra", "type date")]
    return t + "\n" + particion_csv("Proveedores", "proveedores.csv", tipos)


def tabla_clientes():
    t = "table Clientes\n\n"
    t += columna("id", "string") + columna("grupo", "string") + columna("pais", "string") + columna("estado", "string")
    t += columna("edad", "int64", formato="0", resumen="none") + columna("fecha_alta", "dateTime", formato="Short Date")
    t += columna_calculada(
        "Tramo edad",
        'SWITCH(TRUE(), Clientes[edad] <= 30, "26 a 30", Clientes[edad] <= 35, "31 a 35", Clientes[edad] <= 40, "36 a 40", '
        'Clientes[edad] <= 45, "41 a 45", Clientes[edad] <= 50, "46 a 50", "51 a 56")', "string",
    )
    t += columna_calculada("Año de alta", "YEAR(Clientes[fecha_alta])", "int64", formato="0")
    tipos = [("id", "type text"), ("grupo", "type text"), ("pais", "type text"), ("estado", "type text"),
             ("edad", "Int64.Type"), ("fecha_alta", "type date")]
    return t + "\n" + particion_csv("Clientes", "clientes.csv", tipos)


def tabla_calendario():
    dax = ('ADDCOLUMNS(CALENDAR(DATE(2020,1,1), DATE(2022,12,31)), "Año", YEAR([Date]), "MesNum", MONTH([Date]), '
           '"Mes", FORMAT([Date], "mmm"), "AñoMes", FORMAT([Date], "yyyy-mm"))')

    def col(nombre, tipo, formato=None, extra=None):
        L = [f"\tcolumn {q(nombre)}", f"\t\tdataType: {tipo}"]
        if formato:
            L.append(f"\t\tformatString: {formato}")
        L += extra or []
        L += ["\t\tisNameInferred", f"\t\tsourceColumn: [{nombre}]"]
        return "\n".join(L) + "\n"

    t = "table Calendario\n\tdataCategory: Time\n\n"
    t += col("Date", "dateTime", "Short Date", ["\t\tisKey", "\t\tsummarizeBy: none"])
    t += col("Año", "int64", "0", ["\t\tsummarizeBy: none"])
    t += col("MesNum", "int64", "0", ["\t\tsummarizeBy: none"])
    t += col("Mes", "string", None, ["\t\tsummarizeBy: none", "\t\tsortByColumn: MesNum"])
    t += col("AñoMes", "string", None, ["\t\tsummarizeBy: none"])
    t += f"\n\tpartition Calendario = calculated\n\t\tmode: import\n\t\tsource = {dax}\n"
    return t


def tabla_fuentes():
    dax = ('DATATABLE("Fuente", STRING, "Filas", INTEGER, "Período", STRING, {'
           '{"Ventas", 1000, "enero 2020 a 7 de noviembre de 2022"}, '
           '{"Proveedores", 999, "última compra hasta el 4/5/2022"}, '
           '{"Clientes", 999, "altas de 2005 a 2021"}})')

    def col(nombre, tipo):
        return (f"\tcolumn {q(nombre)}\n\t\tdataType: {tipo}\n\t\tisNameInferred\n\t\tsummarizeBy: none\n"
                f"\t\tsourceColumn: [{nombre}]\n")

    return ("table Fuentes\n\n" + col("Fuente", "string") + col("Filas", "int64") + col("Período", "string")
            + f"\n\tpartition Fuentes = calculated\n\t\tmode: import\n\t\tsource = {dax}\n")


MEDIDAS = [
    ("Ventas", "SUM(Ventas[venta_total])", "€ #,0"),
    ("Costo", "SUM(Ventas[coste_total])", "€ #,0"),
    ("Margen bruto", "[Ventas] - [Costo]", "€ #,0"),
    ("Margen %", "DIVIDE([Margen bruto], [Ventas])", "0.0%"),
    ("Pedidos", "DISTINCTCOUNT(Ventas[id_pedido])", "#,0"),
    ("Unidades", "SUM(Ventas[unidades])", "#,0"),
    ("Ticket medio", "DIVIDE([Ventas], [Pedidos])", "€ #,0"),
    ("Plazo medio (días)", "AVERAGE(Ventas[Plazo envío (días)])", "0.0"),
    ("Ventas ene-oct", "CALCULATE([Ventas], KEEPFILTERS(Calendario[MesNum] <= 10))", "€ #,0"),
    ("Ventas ene-oct año anterior", "CALCULATE([Ventas ene-oct], SAMEPERIODLASTYEAR(Calendario[Date]))", "€ #,0"),
    ("Variación interanual ene-oct",
     "DIVIDE([Ventas ene-oct] - [Ventas ene-oct año anterior], [Ventas ene-oct año anterior])", "0.0%"),
    ("Saldo pendiente", "SUM(Proveedores[saldo_pendiente])", "$ #,0"),
    ("Proveedores", "COUNTROWS(Proveedores)", "#,0"),
    ("Proveedores sin compra 12m", "CALCULATE([Proveedores], Proveedores[Meses sin compra] > 12)", "#,0"),
    ("% saldo sin compra 12m",
     "DIVIDE(CALCULATE([Saldo pendiente], Proveedores[Meses sin compra] > 12), CALCULATE([Saldo pendiente], ALL(Proveedores)))", "0.0%"),
    ("Clientes", "COUNTROWS(Clientes)", "#,0"),
    ("Edad promedio", "AVERAGE(Clientes[edad])", "0.0"),
    ("Clientes con más de 1 pedido", "COUNTROWS(FILTER(VALUES(Ventas[id_cliente]), [Pedidos] > 1))", "#,0"),
    ("% clientes recurrentes", "DIVIDE([Clientes con más de 1 pedido], DISTINCTCOUNT(Ventas[id_cliente]))", "0.0%"),
]


def tabla_medidas():
    t = "table _Medidas\n\n\tcolumn Columna\n\t\tdataType: string\n\t\tisHidden\n\t\tsummarizeBy: none\n\t\tsourceColumn: Columna\n\n"
    t += "".join(medida(*m) + "\n" for m in MEDIDAS)
    t += "\tpartition _Medidas = m\n\t\tmode: import\n\t\tsource = #table(type table [Columna = text], {})\n"
    return t


def modelo(ruta_datos: str) -> dict[str, str]:
    tablas = ["Ventas", "Proveedores", "Clientes", "Calendario", "Fuentes", "_Medidas"]
    return {
        "database.tmdl": f"database {NOMBRE}\n\tcompatibilityLevel: 1600\n",
        "model.tmdl": (
            "model Model\n\tculture: en-US\n\tdefaultPowerBIDataSourceVersion: powerBI_V3\n\tsourceQueryCulture: en-US\n\n"
            + "".join(f"ref table {q(t)}\n" for t in tablas)
        ),
        "expressions.tmdl": (
            f'expression RutaDatos = "{ruta_datos}" meta [IsParameterQuery=true, Type="Text", IsParameterQueryRequired=true]\n'
        ),
        # Una sola relación: el calendario filtra las ventas. Ventas no se relaciona con Clientes ni con Proveedores
        # (los ID no coinciden y las ventas no traen proveedor).
        "relationships.tmdl": (
            f"relationship {_guid('rel', 'ventas-calendario')}\n\tfromColumn: Ventas.fecha_pedido\n\ttoColumn: Calendario.Date\n"
        ),
        "tables/Ventas.tmdl": tabla_ventas(),
        "tables/Proveedores.tmdl": tabla_proveedores(),
        "tables/Clientes.tmdl": tabla_clientes(),
        "tables/Calendario.tmdl": tabla_calendario(),
        "tables/Fuentes.tmdl": tabla_fuentes(),
        "tables/_Medidas.tmdl": tabla_medidas(),
    }


# ==========================================================================
# INFORME (PBIR)
# ==========================================================================
def lit(valor) -> dict:
    """Valor literal de una propiedad de formato: texto entre comillas simples, números con sufijo D o L."""
    if isinstance(valor, bool):
        v = "true" if valor else "false"
    elif isinstance(valor, int):
        v = f"{valor}L"
    elif isinstance(valor, float):
        v = f"{valor}D"
    else:
        v = "'" + str(valor).replace("'", "''") + "'"
    return {"expr": {"Literal": {"Value": v}}}


def dbl(n) -> dict:
    texto_ = str(int(n)) if float(n).is_integer() else repr(float(n))  # sin notación científica
    return {"expr": {"Literal": {"Value": f"{texto_}D"}}}


def lng(n: int) -> dict:
    return {"expr": {"Literal": {"Value": f"{n}L"}}}


def color(hex_: str) -> dict:
    return {"solid": {"color": lit(hex_)}}


def col_ref(tabla, campo, activo=None):
    d = {"field": {"Column": {"Expression": {"SourceRef": {"Entity": tabla}}, "Property": campo}},
         "queryRef": f"{tabla}.{campo}", "nativeQueryRef": campo}
    if activo is not None:
        d["active"] = activo
    return d


def med_ref(nombre):
    return {"field": {"Measure": {"Expression": {"SourceRef": {"Entity": "_Medidas"}}, "Property": nombre}},
            "queryRef": f"_Medidas.{nombre}", "nativeQueryRef": nombre}


def orden(proyeccion, direccion="Ascending"):
    return {"sortDefinition": {"sort": [{"field": proyeccion["field"], "direction": direccion}], "isDefaultSort": False}}


class Pagina:
    def __init__(self, clave, titulo, ancho=1280, alto=720, tipo=None):
        self.clave, self.titulo, self.ancho, self.alto, self.tipo = clave, titulo, ancho, alto, tipo
        self.nombre = _id("pagina", clave)
        self.visuales: list[dict] = []

    def agregar(self, clave, x, y, w, h, visual, titulo=None, tamano_titulo=None):
        objetos = visual.setdefault("visualContainerObjects", {})
        if titulo:
            propiedades = {"show": lit(True), "text": lit(titulo)}
            if tamano_titulo:
                propiedades["fontSize"] = dbl(tamano_titulo)
            objetos["title"] = [{"properties": propiedades}]
        self.visuales.append({
            "$schema": ESQ["visual"],
            "name": _id("visual", self.clave, clave),
            "position": {"x": x, "y": y, "z": len(self.visuales), "height": h, "width": w, "tabOrder": len(self.visuales)},
            "visual": visual,
        })


def consulta(**roles):
    return {"queryState": {rol: {"projections": proy} for rol, proy in roles.items()}}


def _ejes(valor=False, etiquetas=True, tamano=10, importe=False):
    """Sin títulos de ejes (el título del gráfico ya dice qué se mira) y, si se quiere, con etiquetas de datos."""
    o = {
        "categoryAxis": [{"properties": {"showAxisTitle": lit(False), "fontSize": dbl(tamano)}}],
        "valueAxis": [{"properties": {"showAxisTitle": lit(False), "show": lit(valor), "gridlineShow": lit(valor),
                                      "fontSize": dbl(tamano)}}],
    }
    if etiquetas:
        etiqueta = {"show": lit(True), "fontSize": dbl(tamano)}
        if importe:  # importes en millones, con un decimal
            etiqueta.update({"labelDisplayUnits": dbl(1000000), "labelPrecision": lng(1)})
        o["labels"] = [{"properties": etiqueta}]
    else:
        o["labels"] = [{"properties": {"show": lit(False)}}]
    return o


OBJETOS_POR_TIPO = {
    "clusteredBarChart": _ejes(valor=False, etiquetas=True, tamano=9),
    "clusteredColumnChart": _ejes(valor=False, etiquetas=True),
    "columnChart": _ejes(valor=False, etiquetas=True),
    "lineChart": {**_ejes(valor=True, etiquetas=False, tamano=9),
                  "legend": [{"properties": {"show": lit(True), "position": lit("Top"), "fontSize": dbl(9)}}]},
    "donutChart": {"legend": [{"properties": {"show": lit(True), "position": lit("Bottom"), "fontSize": dbl(10)}}],
                   "labels": [{"properties": {"show": lit(True), "labelStyle": lit("Percent of total"), "fontSize": dbl(10)}}]},
}


def grafico(tipo, sort=None, objetos=None, **roles):
    q_ = consulta(**roles)
    if sort:
        q_.update(sort)
    v = {"visualType": tipo, "query": q_, "drillFilterOtherVisuals": True}
    base = {**OBJETOS_POR_TIPO.get(tipo, {}), **(objetos or {})}
    if base:
        v["objects"] = base
    return v


# (unidades de visualización, decimales): importes grandes en millones; el resto, tal cual
TARJETAS = {"Ventas": (1000000, 1), "Costo": (1000000, 1), "Margen bruto": (1000000, 1), "Ticket medio": (1000000, 2)}


def tarjeta(medida_):
    unidades, decimales = TARJETAS.get(medida_, (1, None))
    valor = {"fontSize": dbl(20), "labelDisplayUnits": dbl(unidades)}
    if decimales is not None:
        valor["labelPrecision"] = lng(decimales)
    return {
        "visualType": "cardVisual",
        "query": consulta(Data=[med_ref(medida_)]),
        "objects": {"label": [{"properties": {"show": lit(False)}, "selector": {"id": "default"}}],
                    "value": [{"properties": valor, "selector": {"id": "default"}}]},
        "drillFilterOtherVisuals": True,
    }


def segmentador(tabla, campo, grupo):
    v = {
        "visualType": "slicer",
        "query": consulta(Values=[col_ref(tabla, campo)]),
        "objects": {"data": [{"properties": {"mode": lit("Dropdown")}}],
                    "header": [{"properties": {"show": lit(True), "text": lit(grupo)}}]},
        "syncGroup": {"groupName": grupo, "fieldChanges": True, "filterChanges": True},
        "drillFilterOtherVisuals": True,
    }
    return v


def texto(parrafos):
    return {
        "visualType": "textbox",
        "objects": {"general": [{"properties": {"paragraphs": parrafos}}]},
    }


def parrafo(valor, tamano="12pt", negrita=False, color_="#1F2933"):
    estilo = {"fontSize": tamano, "color": color_}
    if negrita:
        estilo["fontWeight"] = "bold"
    return {"textRuns": [{"value": valor, "textStyle": estilo}]}


def boton_limpiar():
    return {
        "visualType": "actionButton",
        "objects": {
            "text": [{"properties": {"show": lit(True)}},
                     {"properties": {"text": lit("Limpiar filtros"), "fontColor": color("#FFFFFF"), "fontSize": dbl(12), "bold": lit(True)},
                      "selector": {"id": "default"}}],
            "icon": [{"properties": {"show": lit(False)}}, {"properties": {"shapeType": lit("blank")}, "selector": {"id": "default"}}],
            "fill": [{"properties": {"show": lit(True)}}, {"properties": {"fillColor": color("#E84818"), "transparency": dbl(0)}, "selector": {"id": "default"}}],
            "outline": [{"properties": {"show": lit(False)}}],
        },
        "visualContainerObjects": {
            "visualLink": [{"properties": {
                "show": lit(True), "type": lit("ClearAllSlicers"), "tooltip": lit("Quita todos los filtros"),
            }}],
        },
        "drillFilterOtherVisuals": True,
    }


def boton_volver():
    return {
        "visualType": "actionButton",
        "objects": {
            "text": [{"properties": {"show": lit(True)}},
                     {"properties": {"text": lit("Volver"), "fontColor": color("#FFFFFF"), "fontSize": dbl(12), "bold": lit(True)},
                      "selector": {"id": "default"}}],
            "icon": [{"properties": {"show": lit(False)}}, {"properties": {"shapeType": lit("blank")}, "selector": {"id": "default"}}],
            "fill": [{"properties": {"show": lit(True)}},
                     {"properties": {"fillColor": color("#185890"), "transparency": dbl(0)}, "selector": {"id": "default"}}],
            "outline": [{"properties": {"show": lit(False)}}],
        },
        "visualContainerObjects": {
            "visualLink": [{"properties": {"show": lit(True), "type": lit("Back"), "tooltip": lit("Volver a la página anterior")}}],
        },
        "drillFilterOtherVisuals": True,
    }


def barra_superior(p: Pagina, subtitulo: str):
    p.agregar("marca", 20, 10, 380, 50, texto([parrafo("Air Transport", "18pt", True, "#185890")]))
    p.agregar("navegador", 410, 10, 850, 50, {"visualType": "pageNavigator", "drillFilterOtherVisuals": True})


def fila_segmentadores(p: Pagina, y=70):
    campos = [("Calendario", "Año", "Año"), ("Ventas", "zona", "Zona"), ("Ventas", "canal", "Canal"),
              ("Ventas", "Prioridad del pedido", "Prioridad"), ("Ventas", "producto", "Producto")]
    for i, (tabla, campo, grupo) in enumerate(campos):
        p.agregar(f"seg_{grupo}", 20 + i * 200, y, 190, 76, segmentador(tabla, campo, grupo))
    p.agregar("limpiar", 1070, y + 13, 190, 50, boton_limpiar())


def pagina_operativo(tooltip: Pagina) -> Pagina:
    p = Pagina("operativo", "Operativo")
    barra_superior(p, "Operativo")
    fila_segmentadores(p)
    for i, m in enumerate(["Ventas", "Margen %", "Costo", "Ticket medio", "Unidades", "Plazo medio (días)"]):
        p.agregar(f"kpi_{m}", 20 + i * 208, 152, 200, 78, tarjeta(m), titulo=m, tamano_titulo=11)
    mes = col_ref("Calendario", "AñoMes")
    p.agregar("mensual", 20, 238, 520, 212,
              grafico("columnChart", sort=orden(mes), Category=[mes], Y=[med_ref("Costo"), med_ref("Margen bruto")], objetos=_ejes(True, False)),
              "Ventas, costo y margen por mes")
    barras = grafico("clusteredBarChart", sort=orden(med_ref("Ventas"), "Descending"), objetos=_ejes(False, True, 9, True),
                     Category=[col_ref("Ventas", "producto")], Y=[med_ref("Ventas")], Tooltips=[med_ref("Margen %")])
    barras["visualContainerObjects"] = {"visualTooltip": [{"properties": {
        "show": lit(True), "type": lit("Canvas"), "section": lit(tooltip.nombre)}}]}
    p.agregar("producto", 550, 238, 420, 212, barras, "Ventas por producto (clic derecho: detalle)")
    p.agregar("canal", 980, 238, 280, 212,
              grafico("donutChart", Category=[col_ref("Ventas", "canal")], Y=[med_ref("Ventas")]), "Ventas por canal")
    p.agregar("prioridad", 20, 458, 330, 247,
              grafico("clusteredBarChart", Category=[col_ref("Ventas", "Prioridad del pedido")], Y=[med_ref("Plazo medio (días)")]),
              "Plazo de envío según prioridad")
    p.agregar("histograma", 360, 458, 330, 247,
              grafico("clusteredColumnChart", Category=[col_ref("Ventas", "Plazo envío (tramo de 5 días)")], Y=[med_ref("Pedidos")], objetos=_ejes(True, False)),
              "Distribución del plazo de envío")
    plazo = col_ref("Ventas", "Plazo envío (días)")
    p.agregar("pedidos", 700, 458, 560, 247,
              {"visualType": "tableEx", "query": {**consulta(Values=[
                  col_ref("Ventas", "id_pedido"), col_ref("Ventas", "fecha_pedido"), plazo, col_ref("Ventas", "pais"),
                  col_ref("Ventas", "producto"), col_ref("Ventas", "Prioridad del pedido"), col_ref("Ventas", "venta_total")]),
                  **orden(plazo, "Descending")}, "drillFilterOtherVisuals": True},
              "Seguimiento de pedidos (ordenado por plazo de envío)")
    return p


def pagina_tactico() -> Pagina:
    p = Pagina("tactico", "Táctico")
    barra_superior(p, "Táctico")
    for i, m in enumerate(["Proveedores", "Saldo pendiente", "Proveedores sin compra 12m", "% saldo sin compra 12m"]):
        p.agregar(f"kpi_{m}", 20 + i * 208, 70, 200, 94, tarjeta(m), titulo=m, tamano_titulo=11)
    for i, m in enumerate(["Clientes con más de 1 pedido", "% clientes recurrentes"]):
        p.agregar(f"kpi_{m}", 860 + i * 205, 70, 195, 94, tarjeta(m), titulo=m, tamano_titulo=11)
    p.agregar("tramo", 20, 172, 410, 230,
              grafico("clusteredBarChart", Category=[col_ref("Proveedores", "Tramo proveedor")], Y=[med_ref("Proveedores")]),
              "Proveedores según su última compra")
    anio = col_ref("Proveedores", "Año última compra")
    p.agregar("saldo_anio", 440, 172, 410, 230,
              grafico("clusteredColumnChart", sort=orden(anio), Category=[anio], Y=[med_ref("Saldo pendiente")], objetos=_ejes(True, False)),
              "Saldo pendiente por año de última compra")
    p.agregar("hist_saldo", 860, 172, 400, 230,
              grafico("clusteredColumnChart", Category=[col_ref("Proveedores", "Saldo (tramo de 2.000)")], Y=[med_ref("Proveedores")], objetos=_ejes(True, False)),
              "Distribución de saldos")
    saldo = col_ref("Proveedores", "saldo_pendiente")
    p.agregar("tabla_prov", 20, 410, 760, 295,
              {"visualType": "tableEx", "query": {**consulta(Values=[
                  col_ref("Proveedores", "id"), col_ref("Proveedores", "proveedor"), saldo,
                  col_ref("Proveedores", "fecha_ultima_compra"), col_ref("Proveedores", "Meses sin compra")]),
                  **orden(saldo, "Descending")}, "drillFilterOtherVisuals": True},
              "Proveedores con mayor saldo (de mayor a menor)")
    pedidos = med_ref("Pedidos")
    p.agregar("tabla_clientes", 790, 410, 470, 295,
              {"visualType": "tableEx", "query": {**consulta(Values=[col_ref("Ventas", "id_cliente"), pedidos, med_ref("Ventas")]),
                                                  **orden(pedidos, "Descending")}, "drillFilterOtherVisuals": True},
              "Clientes con más pedidos (de mayor a menor)")
    return p


def pagina_estrategico(tooltip: Pagina) -> Pagina:
    p = Pagina("estrategico", "Estratégico")
    barra_superior(p, "Estratégico")
    fila_segmentadores(p)
    # tres filas de gráficos que entran justo en la página de 1280 x 720
    p.agregar("lineas", 20, 152, 520, 170,
              grafico("lineChart", Category=[col_ref("Calendario", "Mes")], Series=[col_ref("Calendario", "Año")], Y=[med_ref("Ventas")]),
              "Ventas por mes, una línea por año")
    anio = col_ref("Calendario", "Año")
    p.agregar("ene_oct", 550, 152, 300, 170,
              grafico("clusteredColumnChart", sort=orden(anio), objetos=_ejes(False, True, 10, True), Category=[anio],
                      Y=[med_ref("Ventas ene-oct")], Tooltips=[med_ref("Variación interanual ene-oct")]),
              "Ventas de enero a octubre por año")
    p.agregar("dispersion", 860, 152, 400, 170,
              grafico("scatterChart", objetos={"categoryLabels": [{"properties": {"show": lit(True), "fontSize": dbl(8)}}]},
                      Category=[col_ref("Ventas", "producto")], X=[med_ref("Ventas")], Y=[med_ref("Margen %")]),
              "Rentabilidad por producto")
    p.agregar("paises", 20, 330, 420, 170,
              grafico("clusteredBarChart", sort=orden(med_ref("Ventas"), "Descending"), objetos=_ejes(False, True, 9, True),
                      Category=[col_ref("Ventas", "pais")], Y=[med_ref("Ventas")]),
              "Ventas por país (los de mayores ventas, arriba)")
    zona = grafico("clusteredBarChart", sort=orden(med_ref("Ventas"), "Descending"), objetos=_ejes(False, True, 9, True),
                   Category=[col_ref("Ventas", "zona")], Y=[med_ref("Ventas")], Tooltips=[med_ref("Margen %")])
    zona["visualContainerObjects"] = {"visualTooltip": [{"properties": {
        "show": lit(True), "type": lit("Canvas"), "section": lit(tooltip.nombre)}}]}
    p.agregar("zona", 450, 330, 330, 170, zona, "Ventas por zona (el tooltip muestra el margen)")
    p.agregar("matriz", 790, 330, 470, 170,
              {"visualType": "pivotTable", "query": consulta(Rows=[col_ref("Ventas", "zona")], Columns=[col_ref("Calendario", "Año")],
                                                              Values=[med_ref("Ventas")]), "drillFilterOtherVisuals": True},
              "Ventas por zona y año")
    y, h = 508, 197
    p.agregar("grupo", 20, y, 240, h,
              grafico("columnChart", Category=[col_ref("Clientes", "grupo")], Y=[med_ref("Clientes")]), "Clientes por grupo")
    p.agregar("pais_cli", 270, y, 240, h,
              grafico("clusteredBarChart", sort=orden(med_ref("Clientes"), "Descending"), Category=[col_ref("Clientes", "pais")], Y=[med_ref("Clientes")]), "Clientes por país")
    p.agregar("estado", 520, y, 240, h,
              grafico("clusteredBarChart", sort=orden(med_ref("Clientes"), "Descending"), Category=[col_ref("Clientes", "estado")], Y=[med_ref("Clientes")]), "Clientes por estado")
    alta = col_ref("Clientes", "Año de alta")
    p.agregar("alta", 770, y, 240, h,
              grafico("columnChart", sort=orden(alta), Category=[alta], Y=[med_ref("Clientes")], objetos=_ejes(True, False)), "Clientes dados de alta por año")
    edad = col_ref("Clientes", "Tramo edad")
    p.agregar("edad", 1020, y, 240, h,
              grafico("columnChart", sort=orden(edad), Category=[edad], Y=[med_ref("Clientes")]), "Clientes por tramo de edad")
    return p


def pagina_datos() -> Pagina:
    p = Pagina("datos", "Datos y alcance")
    barra_superior(p, "Datos y alcance")
    limites = [
        "Ventas y clientes no se cruzan: ninguno de los 951 IDs de cliente de las ventas está en el archivo de clientes. No hay relación entre las tablas, y los filtros de ventas no se aplican a los gráficos de clientes.",
        "Las ventas no traen identificador de proveedor: no se pueden asociar compras con proveedores.",
        "Las ventas están en euros y los saldos de proveedores en dólares, sin conversión.",
        "Noviembre de 2022 está incompleto (último pedido el 7/11/2022).",
        "Los meses sin compra de proveedores se miden contra la última compra del archivo (4/5/2022), no contra hoy.",
        "El país de cada cliente se infiere del formato de la dirección.",
    ]
    parrafos = [parrafo("Límites de los datos", "16pt", True, "#185890")]
    parrafos += [parrafo(f"{i}. {t}", "13pt") for i, t in enumerate(limites, 1)]
    parrafos.append(parrafo("Los productos son bienes de consumo y no servicios aéreos: la consigna es un marco de caso.", "13pt"))
    p.agregar("limites", 20, 80, 1240, 290, texto(parrafos))
    p.agregar("fuentes", 20, 390, 1240, 160,
              {"visualType": "tableEx", "query": consulta(Values=[col_ref("Fuentes", "Fuente"), col_ref("Fuentes", "Filas"),
                                                                    col_ref("Fuentes", "Período")]), "drillFilterOtherVisuals": True},
              "Fuentes de datos")
    return p


def pagina_detalle() -> Pagina:
    """Obtención de detalles: clic derecho sobre un producto > Obtención de detalles > Detalle de producto."""
    p = Pagina("detalle_producto", "Detalle de producto", tipo="Drillthrough")
    p.campo_detalle = ("Ventas", "producto")
    p.agregar("marca", 20, 10, 380, 50, texto([parrafo("Air Transport", "18pt", True, "#185890")]))
    p.agregar("titulo", 410, 10, 640, 50, texto([parrafo("Detalle de producto", "18pt", True, "#1F2933")]))
    p.agregar("volver", 1070, 10, 190, 50, boton_volver())
    for i, m in enumerate(["Ventas", "Margen %", "Costo", "Pedidos", "Unidades", "Plazo medio (días)"]):
        p.agregar(f"kpi_{m}", 20 + i * 208, 70, 200, 94, tarjeta(m), titulo=m, tamano_titulo=11)
    mes = col_ref("Calendario", "AñoMes")
    p.agregar("mensual", 20, 174, 620, 240,
              grafico("columnChart", sort=orden(mes), Category=[mes], Y=[med_ref("Ventas")], objetos=_ejes(True, False)),
              "Ventas del producto por mes")
    p.agregar("zona", 650, 174, 310, 240,
              grafico("clusteredBarChart", sort=orden(med_ref("Ventas"), "Descending"), objetos=_ejes(False, True, 9, True),
                      Category=[col_ref("Ventas", "zona")], Y=[med_ref("Ventas")]),
              "Ventas del producto por zona")
    p.agregar("canal", 970, 174, 290, 240,
              grafico("donutChart", Category=[col_ref("Ventas", "canal")], Y=[med_ref("Ventas")]), "Ventas del producto por canal")
    venta = col_ref("Ventas", "venta_total")
    p.agregar("pedidos", 20, 424, 1240, 281,
              {"visualType": "tableEx", "query": {**consulta(Values=[
                  col_ref("Ventas", "id_pedido"), col_ref("Ventas", "fecha_pedido"), col_ref("Ventas", "pais"), col_ref("Ventas", "zona"),
                  col_ref("Ventas", "canal"), col_ref("Ventas", "Prioridad del pedido"), col_ref("Ventas", "Plazo envío (días)"), venta]),
                  **orden(venta, "Descending")}, "drillFilterOtherVisuals": True},
              "Pedidos del producto (de mayor a menor importe)")
    return p


def pagina_tooltip() -> Pagina:
    p = Pagina("tooltip_producto", "Tooltip producto", ancho=320, alto=270, tipo="Tooltip")
    for i, m in enumerate(["Ventas", "Margen %", "Pedidos"]):
        p.agregar(f"kpi_{m}", 10, 6 + i * 86, 300, 82, tarjeta(m), titulo=m, tamano_titulo=11)
    return p


def informe(paginas: list[Pagina]) -> dict[str, object]:
    archivos: dict[str, object] = {
        "definition.pbir": {"$schema": ESQ["pbir"], "version": "4.0",
                            "datasetReference": {"byPath": {"path": f"../{NOMBRE}.SemanticModel"}}},
        "definition/version.json": {"$schema": ESQ["version"], "version": "2.0.0"},
        "definition/report.json": {
            "$schema": ESQ["report"],
            "themeCollection": {
                "baseTheme": {"name": "CY24SU10", "reportVersionAtImport": VERSIONES, "type": "SharedResources"},
                "customTheme": {"name": TEMA_ARCHIVO, "reportVersionAtImport": VERSIONES, "type": "RegisteredResources"},
            },
            "resourcePackages": [{
                "name": "RegisteredResources", "type": "RegisteredResources",
                "items": [{"name": TEMA_ARCHIVO, "path": TEMA_ARCHIVO, "type": "CustomTheme"}],
            }],
        },
        "definition/pages/pages.json": {
            "$schema": ESQ["pages"],
            "pageOrder": [p.nombre for p in paginas],
            "activePageName": paginas[0].nombre,
        },
    }
    for p in paginas:
        ruta = f"definition/pages/{p.nombre}"
        pagina = {"$schema": ESQ["page"], "name": p.nombre, "displayName": p.titulo,
                  "displayOption": "ActualSize" if p.tipo == "Tooltip" else ("FitToWidth" if p.alto > 720 else "FitToPage"),
                  "height": p.alto, "width": p.ancho}
        if p.tipo == "Tooltip":
            pagina.update({"type": "Tooltip", "visibility": "HiddenInViewMode",
                           "pageBinding": {"name": _guid("binding", p.clave), "type": "Tooltip"}})
        elif p.tipo == "Drillthrough":
            tabla_, campo_ = p.campo_detalle
            expr = {"Column": {"Expression": {"SourceRef": {"Entity": tabla_}}, "Property": campo_}}
            filtro = "Filter" + hashlib.md5(f"filtro:{p.clave}".encode()).hexdigest()[:24]
            pagina.update({
                "visibility": "HiddenInViewMode",
                "filterConfig": {"filters": [{"name": filtro, "field": expr, "type": "Categorical", "howCreated": "Drillthrough"}]},
                "type": "Drillthrough",
                "pageBinding": {
                    "name": _guid("binding", p.clave), "type": "Drillthrough",
                    "parameters": [{"name": "Param_" + filtro, "boundFilter": filtro, "fieldExpr": expr}],
                },
            })
        archivos[f"{ruta}/page.json"] = pagina
        for v in p.visuales:
            archivos[f"{ruta}/visuals/{v['name']}/visual.json"] = v
    return archivos


def plataforma(tipo: str) -> dict:
    return {
        "$schema": S + "gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": tipo, "displayName": NOMBRE},
        "config": {"version": "2.0", "logicalId": _guid("logicalId", tipo)},
    }


def generar(destino: Path = SALIDA) -> Path:
    if destino.exists():
        shutil.rmtree(destino)
    ruta_datos = str(RAIZ / "datos") + "\\"
    # --- modelo
    base_modelo = destino / f"{NOMBRE}.SemanticModel"
    escribir_json(base_modelo / ".platform", plataforma("SemanticModel"))
    escribir_json(base_modelo / "definition.pbism", {"$schema": ESQ["pbism"], "version": "4.0", "settings": {}})
    for nombre, contenido in modelo(ruta_datos).items():
        escribir(base_modelo / "definition" / nombre, contenido)
    # --- informe
    tooltip = pagina_tooltip()
    paginas = [pagina_operativo(tooltip), pagina_tactico(), pagina_estrategico(tooltip), pagina_datos(), pagina_detalle(), tooltip]
    base_informe = destino / f"{NOMBRE}.Report"
    escribir_json(base_informe / ".platform", plataforma("Report"))
    for ruta, datos in informe(paginas).items():
        escribir_json(base_informe / ruta, datos)
    tema = json.loads(TEMA_ORIGEN.read_text(encoding="utf-8"))
    tema["name"] = TEMA_ARCHIVO
    for clave in ("min", "max"):  # no existen en el esquema de temas de Power BI
        tema.pop(clave, None)
    escribir_json(base_informe / "StaticResources" / "RegisteredResources" / TEMA_ARCHIVO, tema)
    # --- proyecto
    escribir_json(destino / f"{NOMBRE}.pbip", {"$schema": ESQ["pbip"], "version": "1.0",
                                               "artifacts": [{"report": {"path": f"{NOMBRE}.Report"}}],
                                               "settings": {"enableAutoRecovery": True}})
    escribir(destino / ".gitignore", "**/.pbi/localSettings.json\n**/.pbi/cache.abf\n")
    return destino


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    carpeta = generar()
    archivos = [p for p in carpeta.rglob("*") if p.is_file()]
    print(f"Proyecto generado en {carpeta} ({len(archivos)} archivos)")
