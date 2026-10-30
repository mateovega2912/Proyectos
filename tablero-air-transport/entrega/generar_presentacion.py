"""Arma la presentación de 12 diapositivas del tablero de Air Transport.

Uso:  python entrega/generar_presentacion.py   (genera la versión clara y la oscura)
Todas las cifras salen de `datos/` (ver cifras.py) y se comprueban contra los datos de referencia antes de armar nada.
Los gráficos son nativos de PowerPoint: se pueden editar con clic derecho > Editar datos.
El logo se dibuja con formas de PowerPoint (sin imágenes) y los colores salen del diccionario TEMAS.
"""
from __future__ import annotations

import math
import re
import sys
from pathlib import Path

from pptx import Presentation
from pptx.chart.data import CategoryChartData, XyChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_MARKER_STYLE
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml import parse_xml
from pptx.oxml.ns import nsdecls, qn
from pptx.util import Inches, Pt

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cifras import calcular, millones, num, pct, verificar  # noqa: E402

SALIDAS = {"claro": Path(__file__).resolve().parent / "AirTransport-presentacion.pptx",
           "oscuro": Path(__file__).resolve().parent / "AirTransport-presentacion-oscuro.pptx"}
SALIDA = SALIDAS["claro"]

# Paletas: cada clave alimenta una constante de color de más abajo (ver usar_tema). El naranja de marca no cambia;
# en el oscuro el azul de los datos se aclara para que se lea sobre el fondo azul noche.
TEMAS = {
    "claro": {
        "fondo": "FFFFFF", "tarjeta": "F3F5F8", "texto": "1F2933", "texto_suave": "525B66",
        "azul": "185890", "azul_marca": "185890", "azul_claro": "CDE2FB", "naranja": "E84818",
        "neutro": "525B66", "decision": "FDEEE8", "linea": "C9CED6", "grilla": "E3E6EB", "palabra_logo": "185890",
    },
    "oscuro": {
        "fondo": "0D1722", "tarjeta": "15222F", "texto": "E6EDF5", "texto_suave": "9FB0C3",
        "azul": "4C9BE0", "azul_marca": "185890", "azul_claro": "CDE2FB", "naranja": "E84818",
        "neutro": "4A5A6C", "decision": "2C2326", "linea": "3A4A5C", "grilla": "263646", "palabra_logo": "CDE2FB",
    },
}
BLANCO = RGBColor(0xFF, 0xFF, 0xFF)
FUENTE = "Segoe UI"


def usar_tema(nombre: str) -> None:
    """Carga en las constantes de color del módulo la paleta del tema ("claro" u "oscuro")."""
    global FONDO, TARJETA, TEXTO, TEXTO_SUAVE, AZUL, AZUL_MARCA, AZUL_CLARO, NARANJA
    global NEUTRO, FONDO_DECISION, LINEA, GRILLA, PALABRA_LOGO, TEMA
    t = {clave: RGBColor.from_string(valor) for clave, valor in TEMAS[nombre].items()}
    FONDO, TARJETA, TEXTO, TEXTO_SUAVE = t["fondo"], t["tarjeta"], t["texto"], t["texto_suave"]
    AZUL, AZUL_MARCA, AZUL_CLARO, NARANJA = t["azul"], t["azul_marca"], t["azul_claro"], t["naranja"]
    NEUTRO, FONDO_DECISION, LINEA, GRILLA, PALABRA_LOGO = t["neutro"], t["decision"], t["linea"], t["grilla"], t["palabra_logo"]
    TEMA = nombre


usar_tema("claro")
NIVEL_DE_LA_DIAPOSITIVA = {
    2: "Los datos", 3: "Cómo se lee el tablero", 4: "Operativo", 5: "Operativo", 6: "Táctico", 7: "Táctico",
    8: "Estratégico", 9: "Estratégico", 10: "Estratégico", 11: "Decisiones por nivel", 12: "Datos y alcance",
}


# --------------------------------------------------------------------------
# Ayudas de dibujo
# --------------------------------------------------------------------------
def _runs(parrafo, partes, size, color, bold=False):
    """partes: texto o lista de (texto, {bold, color})."""
    if isinstance(partes, str):
        partes = [(partes, {})]
    for texto, est in partes:
        r = parrafo.add_run()
        r.text = texto
        r.font.name, r.font.size = FUENTE, Pt(size)
        r.font.bold = est.get("bold", bold)
        r.font.color.rgb = est.get("color", color)


def texto(slide, x, y, w, h, parrafos, size=16, color=None, bold=False, align=PP_ALIGN.LEFT,
          anchor=MSO_ANCHOR.TOP, espacio=6, vineta=False):
    color = TEXTO if color is None else color
    caja = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    marco = caja.text_frame
    marco.word_wrap, marco.vertical_anchor = True, anchor
    marco.margin_left = marco.margin_right = Inches(0.05)
    marco.margin_top = marco.margin_bottom = Inches(0.03)
    if isinstance(parrafos, str):
        parrafos = [parrafos]
    for i, p in enumerate(parrafos):
        par = marco.paragraphs[0] if i == 0 else marco.add_paragraph()
        par.alignment, par.space_after = align, Pt(espacio)
        _runs(par, ("•  " if vineta else "") + p if isinstance(p, str) else ([("•  ", {})] if vineta else []) + p, size, color, bold)
    return caja


def rectangulo(slide, x, y, w, h, relleno, forma=MSO_SHAPE.RECTANGLE, linea=None):
    s = slide.shapes.add_shape(forma, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid()
    s.fill.fore_color.rgb = relleno
    if linea:
        s.line.color.rgb, s.line.width = linea, Pt(1)
    else:
        s.line.fill.background()
    s.shadow.inherit = False
    return s


# Logo vectorial (aproximación al original): dibujo en un lienzo de 300 x 92 unidades, que se escala al ancho pedido.
LOGO_ANCHO, LOGO_ALTO = 300, 92
LOGO_PALABRA = {"texto": "AIR TRANSPORT", "x": 22, "base": 86, "alto": 36}
LOGO_AVION = {  # coordenadas locales: nariz en +x (28, 0) y centro en (0, 0)
    "fuselaje": "M28 0 C26 -3.4 16 -4.2 6 -4.2 L-20 -2.8 C-25 -2.2 -27 -1 -27 0 C-27 1 -25 2.2 -20 2.8 "
                "L6 4.2 C16 4.2 26 3.4 28 0 Z",
    "ala superior": "M7 -3.6 L-9 -26 L-14.5 -26 L-5.5 -3.2 Z",
    "ala inferior": "M7 3.6 L-9 26 L-14.5 26 L-5.5 3.2 Z",
    "cola superior": "M-18 -2.6 L-25 -11 L-28.5 -11 L-24 -2.2 Z",
    "cola inferior": "M-18 2.6 L-25 11 L-28.5 11 L-24 2.2 Z",
}
LOGO_ESTELA = "M0 74 C14 62 32 51 52 44 C36 55 18 66 2 78 Z"
LOGO_AVION_ESCALA, LOGO_AVION_GIRO, LOGO_AVION_CENTRO = 0.95, -56, (62, 23)


def _vertices(trazo, pasos=12):
    """Pasa un trazo SVG (M, L, C, Z) a vértices; cada curva de Bézier se muestrea en `pasos` puntos."""
    fichas = re.findall(r"[MLCZ]|-?\d+(?:\.\d+)?", trazo)
    puntos, i = [], 0
    while i < len(fichas) and fichas[i] != "Z":
        orden, i = fichas[i], i + 1
        n = 6 if orden == "C" else 2
        v = [float(f) for f in fichas[i:i + n]]
        i += n
        if orden != "C":
            puntos.append((v[0], v[1]))
            continue
        (x0, y0), (x1, y1), (x2, y2), (x3, y3) = puntos[-1], v[0:2], v[2:4], v[4:6]
        for k in range(1, pasos + 1):
            t = k / pasos
            a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
            puntos.append((a * x0 + b * x1 + c * x2 + d * x3, a * y0 + b * y1 + c * y2 + d * y3))
    if puntos[-1] == puntos[0]:  # la curva final vuelve al inicio: el cierre del polígono ya lo hace
        puntos.pop()
    return puntos


def _colocar_avion(punto):
    giro = math.radians(LOGO_AVION_GIRO)
    x, y = punto[0] * LOGO_AVION_ESCALA, punto[1] * LOGO_AVION_ESCALA
    return (x * math.cos(giro) - y * math.sin(giro) + LOGO_AVION_CENTRO[0],
            x * math.sin(giro) + y * math.cos(giro) + LOGO_AVION_CENTRO[1])


def logo(slide, x, y, ancho):
    """Logo de Air Transport con formas de PowerPoint (sin imágenes), con la esquina superior izquierda en (x, y)."""
    k = Inches(ancho) / LOGO_ANCHO  # EMU por unidad del dibujo
    origen_x, origen_y = Inches(x), Inches(y)
    grupo = slide.shapes.add_group_shape()
    grupo.name = "Logo Air Transport"
    grupo._element.nvGrpSpPr.cNvPr.set("descr", "Logo de Air Transport: un avión naranja y el nombre")

    def poligono(nombre, puntos):
        emu = [(round(origen_x + px * k), round(origen_y + py * k)) for px, py in puntos]
        trazo = grupo.shapes.build_freeform(*emu[0])
        trazo.add_line_segments(emu[1:], close=True)
        forma = trazo.convert_to_shape()
        forma.name = nombre
        forma.fill.solid()
        forma.fill.fore_color.rgb = NARANJA
        forma.line.fill.background()
        forma.shadow.inherit = False

    poligono("Logo estela", _vertices(LOGO_ESTELA))
    for nombre, trazo in LOGO_AVION.items():
        poligono(f"Logo avión {nombre}", [_colocar_avion(v) for v in _vertices(trazo)])

    # Segoe UI: el tope de la línea queda a 1,079 veces el tamaño por encima de la base de la letra.
    alto = LOGO_PALABRA["alto"]
    caja = grupo.shapes.add_textbox(round(origen_x + LOGO_PALABRA["x"] * k),
                                    round(origen_y + (LOGO_PALABRA["base"] - 1.079 * alto) * k),
                                    round((LOGO_ANCHO - LOGO_PALABRA["x"]) * k), round(1.2 * alto * k))
    caja.name = "Logo palabra"
    marco = caja.text_frame
    marco.word_wrap = False
    marco.margin_left = marco.margin_right = marco.margin_top = marco.margin_bottom = 0
    marco.vertical_anchor = MSO_ANCHOR.TOP
    run = marco.paragraphs[0].add_run()
    run.text = LOGO_PALABRA["texto"]
    run.font.name, run.font.size = FUENTE, Pt(alto * k / 12700)
    run.font.bold = run.font.italic = True
    run.font.color.rgb = PALABRA_LOGO
    return grupo


def base(prs, titulo, fuente, numero, notas):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    nivel = NIVEL_DE_LA_DIAPOSITIVA.get(numero)
    marca = [("Air ", {"color": AZUL}), ("Transport", {"color": NARANJA})]
    if nivel:
        marca.append((f"   ·   {nivel}", {"color": TEXTO_SUAVE}))
    texto(slide, 0.6, 0.28, 8, 0.3, [marca], size=12, bold=True)
    texto(slide, 0.6, 0.55, 12.1, 1.1, titulo, size=26, bold=True, anchor=MSO_ANCHOR.TOP)
    rectangulo(slide, 0.65, 1.62, 1.1, 0.06, NARANJA)
    logo(slide, 11.15, 0.05, 1.6)
    texto(slide, 0.6, 7.0, 10.5, 0.3, fuente, size=10, color=TEXTO_SUAVE)
    texto(slide, 12.0, 7.0, 0.8, 0.3, str(numero), size=10, color=TEXTO_SUAVE, align=PP_ALIGN.RIGHT)
    slide.notes_slide.notes_text_frame.text = notas
    return slide


def kpi(slide, x, y, w, valor, etiqueta, color=None, h=1.05):
    color = AZUL if color is None else color
    rectangulo(slide, x, y, w, h, TARJETA)
    rectangulo(slide, x, y, 0.08, h, color)
    tamano = 24 if len(valor) * 0.2 < w - 0.3 else 20
    texto(slide, x + 0.2, y + 0.05, w - 0.3, 0.6, valor, size=tamano, bold=True, color=color)
    texto(slide, x + 0.2, y + 0.62, w - 0.3, 0.4, etiqueta, size=12, color=TEXTO_SUAVE)


def decision(slide, x, y, w, h, cuerpo):
    rectangulo(slide, x, y, w, h, FONDO_DECISION)
    rectangulo(slide, x, y, 0.08, h, NARANJA)
    texto(slide, x + 0.2, y + 0.08, w - 0.35, 0.35, "DECISIÓN PARA EVALUAR", size=11, bold=True, color=NARANJA)
    texto(slide, x + 0.2, y + 0.42, w - 0.35, h - 0.5, cuerpo, size=16)


def _estilo_grafico(chart, size=12):
    chart.has_title = False
    chart.has_legend = False
    chart.font.size, chart.font.name = Pt(size), FUENTE
    chart.font.color.rgb = TEXTO


def _rotulo(etiqueta, size):
    """Tamaño y color de una etiqueta de dato con texto propio (si no, en el oscuro saldría negra)."""
    fuente = etiqueta.text_frame.paragraphs[0].runs[0].font
    fuente.size = Pt(size)
    fuente.color.rgb = TEXTO


def _pintar(serie, colores):
    for i, color in enumerate(colores):
        p = serie.points[i]
        p.format.fill.solid()
        p.format.fill.fore_color.rgb = color


def barras(slide, x, y, w, h, categorias, valores, colores, etiquetas, horizontal=True, size=12, brecha=45):
    datos = CategoryChartData()
    datos.categories = categorias
    datos.add_series("Serie", valores)
    tipo = XL_CHART_TYPE.BAR_CLUSTERED if horizontal else XL_CHART_TYPE.COLUMN_CLUSTERED
    chart = slide.shapes.add_chart(tipo, Inches(x), Inches(y), Inches(w), Inches(h), datos).chart
    _estilo_grafico(chart, size)
    plot = chart.plots[0]
    plot.gap_width, plot.vary_by_categories = brecha, False
    # Las etiquetas van como texto para que se vean con coma decimal sin importar la configuración regional.
    for i, rotulo in enumerate(etiquetas):
        marca = plot.series[0].points[i].data_label
        marca.text_frame.text = rotulo
        _rotulo(marca, size)
        marca.position = XL_LABEL_POSITION.OUTSIDE_END
    chart.value_axis.visible = False
    chart.value_axis.has_major_gridlines = False
    chart.value_axis.minimum_scale = 0
    chart.category_axis.format.line.color.rgb = LINEA
    chart.category_axis.tick_labels.font.size = Pt(size)
    chart.category_axis.tick_labels.font.color.rgb = TEXTO
    if horizontal:
        chart.category_axis.reverse_order = True
    _pintar(plot.series[0], colores)
    return chart


def _bordes(celda, color):
    """Bordes de 1 pt del color del fondo: separan las celdas sin la línea blanca del estilo de tabla (que sobre el oscuro se ve)."""
    propiedades = celda._tc.get_or_add_tcPr()
    for i, lado in enumerate(("lnL", "lnR", "lnT", "lnB")):
        propiedades.insert(i, parse_xml(
            f'<a:{lado} {nsdecls("a")} w="12700"><a:solidFill><a:srgbClr val="{color}"/></a:solidFill></a:{lado}>'))


def tabla(slide, x, y, w, h, filas, anchos, size=13, encabezado=None):
    encabezado = AZUL_MARCA if encabezado is None else encabezado
    forma = slide.shapes.add_table(len(filas), len(filas[0]), Inches(x), Inches(y), Inches(w), Inches(h))
    t = forma.table
    for j, ancho in enumerate(anchos):
        t.columns[j].width = Inches(ancho)
    for i, fila in enumerate(filas):
        for j, valor in enumerate(fila):
            celda = t.cell(i, j)
            celda.margin_left = celda.margin_right = Inches(0.1)
            marco = celda.text_frame
            marco.word_wrap = True
            marco.paragraphs[0].text = ""
            _runs(marco.paragraphs[0], valor, size, BLANCO if i == 0 else TEXTO, bold=(i == 0 or j == 0))
            celda.fill.solid()
            celda.fill.fore_color.rgb = encabezado if i == 0 else (TARJETA if i % 2 else FONDO)
            _bordes(celda, FONDO)
            celda.vertical_anchor = MSO_ANCHOR.MIDDLE
    return t


# --------------------------------------------------------------------------
# Las 12 diapositivas
# --------------------------------------------------------------------------
def _fondo_de_la_presentacion(prs):
    """Pinta el patrón de diapositivas con el color de fondo del tema; así las diapositivas que se agreguen después también lo heredan."""
    maestra = prs.slide_master
    maestra.background.fill.solid()
    maestra.background.fill.fore_color.rgb = FONDO
    if TEMA == "oscuro":  # el texto nuevo (y los gráficos que se agreguen) salen claros sobre el fondo oscuro
        mapa = maestra._element.find(qn("p:clrMap"))
        mapa.set("bg1", "dk1"), mapa.set("tx1", "lt1"), mapa.set("bg2", "dk2"), mapa.set("tx2", "lt2")


def armar(tema: str = "claro") -> Presentation:
    usar_tema(tema)
    c = calcular()
    desvios = verificar(c)
    if desvios:
        raise SystemExit("Las cifras no coinciden con los datos de referencia:\n" + "\n".join(desvios))

    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    _fondo_de_la_presentacion(prs)
    prs.core_properties.title = "Tablero de gestión de Air Transport"
    prs.core_properties.subject = "Ventas, proveedores y clientes"
    n = 0

    pr = {p: (v, m) for p, v, m in c["por_producto"]}
    ventas_m, margen = millones(c["ventas_total"]), pct(c["margen_pct"])
    ticket = num(c["ticket_medio"] / 1e6, 2)
    prio = c["plazo_por_prioridad"]
    tr = c["prov_tramos"]
    por_anio_eo = c["ene_oct"]
    zonas = {z: (v, p) for z, v, p in c["por_zona"]}
    c_ped = c["distribucion_pedidos"]

    # 1 ------------------------------------------------------------------
    n += 1
    s = prs.slides.add_slide(prs.slide_layouts[6])
    rectangulo(s, 0, 0, 5.2, 7.5, AZUL_MARCA)
    insignia = rectangulo(s, 0.4, 0.6, 4.4, 1.6, FONDO, forma=MSO_SHAPE.ROUNDED_RECTANGLE)  # el naranja y el azul del logo se leen mejor sobre el fondo de la hoja
    insignia.adjustments[0] = 0.08
    logo(s, 0.62, 0.78, 3.96)
    texto(s, 0.6, 5.3, 4.2, 1.4, ["Consultoría estratégica", "Análisis de datos para la dirección"], size=14, color=AZUL_CLARO)
    texto(s, 5.9, 1.5, 6.9, 1.9, "Tablero de gestión para la dirección de Air Transport", size=36, bold=True)
    rectangulo(s, 5.95, 3.45, 1.4, 0.07, NARANJA)
    texto(s, 5.9, 3.7, 6.9, 0.8, f"Ventas, proveedores y clientes · enero 2020 a noviembre 2022", size=18, color=TEXTO_SUAVE)
    texto(s, 5.9, 4.6, 6.9, 2.0, ["Tres preguntas que ordena el tablero:",
                                   [("1. ", {"bold": True, "color": NARANJA}), ("¿Cómo se vende?", {})],
                                   [("2. ", {"bold": True, "color": NARANJA}), ("¿Cómo se cuida a los proveedores?", {})],
                                   [("3. ", {"bold": True, "color": NARANJA}), ("¿A quién conviene fidelizar?", {})]], size=18)
    s.notes_slide.notes_text_frame.text = (
        "Presentación del tablero de Power BI para la alta dirección de Air Transport. "
        "El tablero tiene cuatro páginas (operativo, táctico, estratégico y datos y alcance) y responde tres preguntas: "
        "cómo se vende, cómo se cuida a los proveedores y a quién conviene fidelizar. "
        "Cada diapositiva muestra una cifra del tablero y la decisión que podría tomar la empresa a partir de ella."
    )

    # 2 ------------------------------------------------------------------
    n += 1
    s = base(prs, "Tres fuentes: 1.000 pedidos, 999 proveedores y 999 clientes", "Fuente: ventas.csv, proveedores.csv y clientes.csv.", n,
             "Las tres fuentes llegaron sucias. En ventas, los importes eran texto con el símbolo € y comas; los convertí a número y pasé las fechas a formato ISO. "
             "En proveedores, los saldos eran texto con $; descarté dos columnas sin encabezado. En clientes, parte de las direcciones estaba desordenada entre columnas, "
             "así que el país se infiere del formato: Estados Unidos si aparece «Ciudad, ST 12345» y Reino Unido en el resto. "
             "No incorporé nombres, correos, teléfonos, direcciones ni fechas de nacimiento porque el análisis no los necesita. "
             f"Ventas va del {c['primer_pedido'].strftime('%d/%m/%Y')} al {c['ultimo_pedido'].strftime('%d/%m/%Y')}; noviembre de 2022 está incompleto.")
    tabla(s, 0.6, 1.95, 12.1, 3.6, [
        ["Fuente", "Filas", "Qué trae", "Qué se limpió"],
        ["Ventas", "1.000", "Pedido, cliente, zona, país, producto, canal, prioridad, fechas, unidades, precio, costo e importes",
         "Importes de texto con «€» a número; fechas a formato ISO"],
        ["Proveedores", "999", "ID, proveedor, saldo pendiente y fecha de la última compra",
         "Saldos de texto con «$» a número; dos columnas sin encabezado descartadas"],
        ["Clientes", "999", "ID, grupo (A a E), país, estado, edad y fecha de alta",
         "País inferido de la dirección; sin nombres, correos ni teléfonos"],
    ], [1.7, 0.9, 5.0, 4.5], size=13)
    rectangulo(s, 0.6, 5.85, 12.1, 0.8, TARJETA)
    texto(s, 0.8, 5.95, 11.7, 0.6, [[("Período de ventas: ", {"bold": True}),
                                     (f"{c['primer_pedido'].day} de enero de 2020 al {c['ultimo_pedido'].day} de noviembre de 2022 (noviembre está incompleto). ", {}),
                                     ("Variables clave: ", {"bold": True}), ("producto, zona, país, canal, prioridad, plazo de envío, saldo y grupo de cliente.", {})]], size=13)

    # 3 ------------------------------------------------------------------
    n += 1
    s = base(prs, "El tablero tiene cuatro páginas y se explora con filtros y clics", "Informe de Power BI · AirTransport.pbix", n,
             "Arriba hay un navegador de páginas con cuatro pestañas: Operativo, Táctico, Estratégico y Datos y alcance. "
             "Los filtros de año, zona, canal, prioridad y producto están sincronizados entre las páginas operativa y estratégica. "
             "Al hacer clic en una barra o en un punto se filtra el resto de los gráficos de ventas. "
             "El botón Limpiar filtros vuelve todo al estado inicial. Al pasar el mouse por un producto o una zona aparece un cuadro con ventas, margen y pedidos. "
             "Con clic derecho sobre un producto y la opción Obtención de detalles se abre una página con sus ventas por mes, zona y canal y la lista de sus pedidos; el botón Volver regresa.")
    paginas = [("Operativo", "¿Cómo vamos hoy?", "Ventas, costos, productos y seguimiento de pedidos"),
               ("Táctico", "¿Cómo cuidamos la relación?", "Proveedores, saldos pendientes y clientes frecuentes"),
               ("Estratégico", "¿Hacia dónde crecer?", "Rentabilidad, geografía, tendencia y clientes"),
               ("Datos y alcance", "¿Qué tan firme es el análisis?", "Fuentes y límites de los datos")]
    for i, (nombre, pregunta, detalle) in enumerate(paginas):
        x = 0.6 + i * 3.05
        rectangulo(s, x, 2.0, 2.9, 2.25, TARJETA)
        rectangulo(s, x, 2.0, 2.9, 0.6, AZUL_MARCA if i < 3 else NEUTRO)
        texto(s, x + 0.1, 2.05, 2.7, 0.5, nombre, size=17, bold=True, color=BLANCO, anchor=MSO_ANCHOR.MIDDLE)
        texto(s, x + 0.1, 2.75, 2.7, 0.5, pregunta, size=15, bold=True, color=NARANJA)
        texto(s, x + 0.1, 3.3, 2.7, 1.1, detalle, size=13, color=TEXTO_SUAVE)
    texto(s, 0.6, 4.7, 12.1, 2.1, ["Navegador de páginas arriba, siempre visible.",
                                    "Filtros de año, zona, canal, prioridad y producto, sincronizados entre las páginas operativa y estratégica.",
                                    "Un clic en un gráfico filtra todo lo demás; el botón «Limpiar filtros» vuelve al inicio.",
                                    "Al pasar el mouse por un producto o una zona aparece ventas, margen y pedidos.",
                                    "Con clic derecho sobre un producto se abre su detalle (obtención de detalles)."], size=16, vineta=True, espacio=6)

    # 4 ------------------------------------------------------------------
    n += 1
    s = base(prs, f"Vendimos €{ventas_m} M con {margen} de margen, pero los productos que más venden dejan poco", "Fuente: ventas.csv · 1.000 pedidos. Importes en millones de euros; entre paréntesis, el margen bruto.", n,
             f"Las ventas suman €{ventas_m} millones, el costo €{millones(c['costo_total'])} millones y el margen bruto {margen}. El ticket medio es de €{ticket} millones por pedido. "
             f"Los tres productos que más venden son Doméstico (€{millones(pr['Doméstico'][0])} M), Material de oficina (€{millones(pr['Material de oficina'][0])} M) y Cárnicos (€{millones(pr['Cárnicos'][0])} M), "
             f"y los tres tienen margen por debajo del 30 %. Cárnicos es el peor con {pct(pr['Cárnicos'][1])}. Ropa tiene el mejor margen ({pct(pr['Ropa'][1])}) pero vende solo €{millones(pr['Ropa'][0])} M. "
             "Las barras naranjas son los productos con margen por debajo del total.")
    prods = c["por_producto"]
    barras(s, 0.6, 1.85, 7.4, 5.0,
           [f"{p} ({pct(m)})" for p, _, m in prods], [v / 1e6 for _, v, _ in prods],
           [NARANJA if m < c["margen_pct"] else AZUL for _, _, m in prods], [num(v / 1e6, 1) for _, v, _ in prods], size=11, brecha=35)
    kpi(s, 8.3, 1.85, 4.4, f"€{ventas_m} M", "ventas totales")
    kpi(s, 8.3, 3.0, 2.1, margen, "margen bruto", NARANJA, h=1.05)
    kpi(s, 10.6, 3.0, 2.1, f"€{ticket} M", "ticket medio", AZUL, h=1.05)
    decision(s, 8.3, 4.3, 4.4, 2.5, f"Doméstico, Material de oficina y Cárnicos venden más y rinden menos. Cárnicos es el peor con {pct(pr['Cárnicos'][1])}: revisar precio y costo ahí.")

    # 5 ------------------------------------------------------------------
    n += 1
    s = base(prs, "Un pedido crítico no sale antes que uno de baja prioridad", "Fuente: ventas.csv · plazo = días entre la fecha del pedido y la de envío.", n,
             f"El plazo promedio entre pedido y envío es de {num(c['plazo_medio'], 1)} días. Por prioridad: Crítica {num(prio['Crítica'], 1)}, Alta {num(prio['Alta'], 1)}, "
             f"Media {num(prio['Media'], 1)} y Baja {num(prio['Baja'], 1)}. La prioridad Crítica es en realidad la más lenta: la prioridad no se está traduciendo en rapidez. "
             "En el tablero, la tabla de seguimiento de pedidos se ordena por plazo y permite buscar un pedido por país, producto o número.")
    orden = ["Crítica", "Alta", "Media", "Baja"]
    barras(s, 0.6, 1.85, 7.4, 4.55, orden, [prio[k] for k in orden], [NARANJA, AZUL, AZUL, AZUL], [num(prio[k], 1) for k in orden], horizontal=False, size=14, brecha=60)
    texto(s, 0.6, 6.45, 7.4, 0.4, "Plazo medio de envío, en días, según la prioridad del pedido", size=12, color=TEXTO_SUAVE, align=PP_ALIGN.CENTER)
    kpi(s, 8.3, 1.85, 4.4, f"{num(c['plazo_medio'], 1)} días", "plazo medio de envío (todos los pedidos)")
    texto(s, 8.3, 3.15, 4.4, 1.3, [f"Crítica: {num(prio['Crítica'], 1)} días contra {num(prio['Baja'], 1)} de Baja.",
                                    "La prioridad hoy no cambia el plazo."], size=15, vineta=True)
    decision(s, 8.3, 4.5, 4.4, 2.3, "Definir un plazo objetivo menor para los pedidos críticos y dar seguimiento a los más lentos con la tabla de pedidos del tablero.")

    # 6 ------------------------------------------------------------------
    n += 1
    s = base(prs, f"{pct(c['prov_sin12_pct'])} de los proveedores no compra hace más de un año y concentra {pct(c['prov_sin12_saldo_pct'])} del saldo", "Fuente: proveedores.csv · antigüedad medida contra la última compra del archivo (4/5/2022). Saldos en dólares.", n,
             f"El saldo pendiente total es de ${num(c['prov_saldo'])} repartido en {c['prov_n']} proveedores. Medido contra la última compra del archivo ({c['prov_fecha_ref'].day}/{c['prov_fecha_ref'].month}/{c['prov_fecha_ref'].year}), "
             f"solo {tr['0 a 12 meses'][0]} compraron en los últimos 12 meses; {tr['13 a 36 meses'][0]} entre 13 y 36 meses y {tr['Más de 36 meses'][0]} hace más de 36 meses. "
             f"En total, {c['prov_sin12']} proveedores ({pct(c['prov_sin12_pct'])}) llevan más de un año sin comprar y tienen ${num(c['prov_sin12_saldo'])} del saldo ({pct(c['prov_sin12_saldo_pct'])}). "
             f"Los de más de 36 meses suman ${num(tr['Más de 36 meses'][1])}. El saldo está muy repartido: los 10 mayores son solo el {pct(c['prov_top10_pct'])} del total. "
             "Ojo: los saldos están en dólares y las ventas en euros; no se convierten.")
    nombres = list(tr)
    barras(s, 0.6, 1.85, 7.4, 4.55, [f"{k}  (${num(tr[k][1])})" for k in nombres], [tr[k][0] for k in nombres], [AZUL, AZUL, NARANJA], [num(tr[k][0]) for k in nombres], size=13, brecha=55)
    texto(s, 0.6, 6.45, 7.4, 0.4, "Cantidad de proveedores según su última compra; entre paréntesis, el saldo pendiente", size=12, color=TEXTO_SUAVE, align=PP_ALIGN.CENTER)
    kpi(s, 8.3, 1.85, 2.1, f"${num(c['prov_saldo'])}", "saldo pendiente total", AZUL)
    kpi(s, 10.6, 1.85, 2.1, f"{c['prov_sin12']} de {c['prov_n']}", "proveedores sin compras en 12 meses", NARANJA)
    texto(s, 8.3, 3.1, 4.4, 1.4, [f"Más de 36 meses: {tr['Más de 36 meses'][0]} proveedores y ${num(tr['Más de 36 meses'][1])}.",
                                   f"Los 10 mayores saldos son solo {pct(c['prov_top10_pct'])} del total."], size=14, vineta=True)
    decision(s, 8.3, 4.5, 4.4, 2.3, "Conciliar primero los de más de 36 meses y definir, proveedor por proveedor, si se paga, se renegocia o se da de baja.")

    # 7 ------------------------------------------------------------------
    n += 1
    s = base(prs, f"Solo {c['clientes_recurrentes']} de {c['clientes_con_compras']} clientes ({pct(c['recurrentes_pct'])}) compraron más de una vez", "Fuente: ventas.csv · clientes identificados por el ID de las ventas.", n,
             f"En las ventas hay {c['clientes_con_compras']} clientes distintos para {c['pedidos']} pedidos. De ellos, {c['clientes_recurrentes']} ({pct(c['recurrentes_pct'])}) compraron más de una vez y el máximo es de {c['max_pedidos_cliente']} pedidos. "
             f"Es decir: {num(c_ped[1])} clientes compraron una sola vez, {c_ped[2]} dos veces y {c_ped[3]} tres veces. "
             "La fidelización es la oportunidad más clara: casi nadie vuelve a comprar. "
             "Importante: estos clientes se identifican por el ID de las ventas, que no coincide con el archivo de clientes; por eso no se puede decir de qué grupo son.")
    barras(s, 0.6, 1.85, 7.4, 4.55, ["1 pedido", "2 pedidos", "3 pedidos"], [c_ped[1], c_ped[2], c_ped[3]], [AZUL, NARANJA, NARANJA], [num(c_ped[k]) for k in (1, 2, 3)], horizontal=False, size=14, brecha=60)
    texto(s, 0.6, 6.45, 7.4, 0.4, "Cantidad de clientes según cuántos pedidos hicieron", size=12, color=TEXTO_SUAVE, align=PP_ALIGN.CENTER)
    kpi(s, 8.3, 1.85, 2.1, f"{c['clientes_recurrentes']}", "clientes con más de 1 pedido", NARANJA)
    kpi(s, 10.6, 1.85, 2.1, pct(c["recurrentes_pct"]), "clientes recurrentes", NARANJA)
    texto(s, 8.3, 3.1, 4.4, 1.4, [f"{num(c_ped[1])} clientes compraron una sola vez.", f"El máximo es de {c['max_pedidos_cliente']} pedidos por cliente."], size=14, vineta=True)
    decision(s, 8.3, 4.5, 4.4, 2.3, "Lanzar una acción de recompra y un programa de fidelización, y medir cuántos clientes vuelven a comprar.")

    # 8 ------------------------------------------------------------------
    n += 1
    s = base(prs, f"Ropa rinde {pct(pr['Ropa'][1])} pero vende €{millones(pr['Ropa'][0])} M; los tres que más venden rinden menos de 30 %", "Fuente: ventas.csv · margen bruto = (ventas − costo) / ventas. La línea punteada es el margen total.", n,
             f"Cada punto es un producto: a la derecha vende más y arriba rinde más. La línea marca el margen total ({margen}). "
             f"Ropa está arriba a la izquierda: el mejor margen ({pct(pr['Ropa'][1])}) pero solo €{millones(pr['Ropa'][0])} M de ventas. "
             f"Doméstico ({pct(pr['Doméstico'][1])}), Material de oficina ({pct(pr['Material de oficina'][1])}) y Cárnicos ({pct(pr['Cárnicos'][1])}) están abajo a la derecha: "
             "venden mucho pero dejan poco. En Power BI es el gráfico de dispersión de la página estratégica.")
    datos = XyChartData()
    for p, v, m in prods:
        datos.add_series(p).add_data_point(v / 1e6, m)
    ref = datos.add_series("Margen total")
    ref.add_data_point(0, c["margen_pct"])
    ref.add_data_point(300, c["margen_pct"])
    chart = s.shapes.add_chart(XL_CHART_TYPE.XY_SCATTER, Inches(0.6), Inches(1.85), Inches(7.9), Inches(5.0), datos).chart
    _estilo_grafico(chart, 11)
    for serie, (p, v, m) in zip(chart.plots[0].series, prods):
        color = NARANJA if m < c["margen_pct"] else AZUL
        serie.marker.style, serie.marker.size = XL_MARKER_STYLE.CIRCLE, 11
        serie.marker.format.fill.solid()
        serie.marker.format.fill.fore_color.rgb = color
        serie.marker.format.line.color.rgb = color
        etiqueta = serie.points[0].data_label
        etiqueta.text_frame.text = p
        _rotulo(etiqueta, 10)
        etiqueta.position = (XL_LABEL_POSITION.BELOW if p in ("Cuidado personal", "Frutas") else
                             XL_LABEL_POSITION.RIGHT if v / 1e6 < 200 else XL_LABEL_POSITION.LEFT)
    linea = chart.plots[0].series[-1]
    linea.marker.style = XL_MARKER_STYLE.NONE
    linea.format.line.color.rgb, linea.format.line.width = TEXTO_SUAVE, Pt(1.5)
    linea.format.line.dash_style = 4
    chart.value_axis.minimum_scale, chart.value_axis.maximum_scale = 0, 80
    chart.value_axis.has_title = True
    chart.value_axis.axis_title.text_frame.text = "Margen bruto (%)"
    chart.value_axis.axis_title.text_frame.paragraphs[0].runs[0].font.size = Pt(11)
    chart.value_axis.major_gridlines.format.line.color.rgb = GRILLA
    chart.category_axis.minimum_scale, chart.category_axis.maximum_scale = 0, 300
    chart.category_axis.has_title = True
    chart.category_axis.axis_title.text_frame.text = "Ventas (€ millones)"
    chart.category_axis.axis_title.text_frame.paragraphs[0].runs[0].font.size = Pt(11)
    chart.category_axis.has_major_gridlines = False
    for eje in (chart.value_axis, chart.category_axis):  # títulos, números y líneas de los ejes con los colores del tema
        eje.axis_title.text_frame.paragraphs[0].runs[0].font.color.rgb = TEXTO_SUAVE
        eje.tick_labels.font.color.rgb = TEXTO_SUAVE
        eje.format.line.color.rgb = LINEA
    kpi(s, 8.8, 1.85, 3.9, pct(pr["Cárnicos"][1]), "margen de Cárnicos, el peor producto", NARANJA)
    texto(s, 8.8, 3.1, 3.9, 1.5, [f"Ropa: {pct(pr['Ropa'][1])} de margen, €{millones(pr['Ropa'][0])} M de ventas.",
                                   f"Doméstico: {pct(pr['Doméstico'][1])} con €{millones(pr['Doméstico'][0])} M."], size=14, vineta=True)
    decision(s, 8.8, 4.55, 3.9, 2.25, "Política por producto: cuidar los de margen alto y corregir los de mucho volumen con margen bajo.")

    # 9 ------------------------------------------------------------------
    n += 1
    ene_oct_21, ene_oct_22 = por_anio_eo[2021], por_anio_eo[2022]
    s = base(prs, f"África concentra {pct(zonas['África'][1])} de las ventas y de enero a octubre de 2022 se vendió {pct(-c['var_ene_oct_2022'])} menos con los mismos pedidos", "Fuente: ventas.csv · comparación de enero a octubre para no mezclar un año completo con uno parcial.", n,
             f"África concentra {pct(zonas['África'][1])} de las ventas y Norteamérica solo {pct(zonas['Norteamérica'][1])}. Hay {c['paises']} países y los 10 primeros suman apenas {pct(c['top10_paises_pct'])}: las ventas están muy repartidas. "
             f"Para la tendencia comparo enero a octubre, porque noviembre de 2022 está incompleto. En 2020 se vendieron €{millones(por_anio_eo[2020][0])} M, en 2021 €{millones(ene_oct_21[0])} M y en 2022 €{millones(ene_oct_22[0])} M. "
             f"2022 cae {pct(-c['var_ene_oct_2022'])} frente a 2021 con la misma cantidad de pedidos ({ene_oct_22[1]} contra {ene_oct_21[1]}): lo que baja es el importe por pedido.")
    orden_z = [z for z, _, _ in c["por_zona"]]
    barras(s, 0.6, 1.85, 5.4, 4.55, orden_z, [zonas[z][1] for z in orden_z], [AZUL if z != "Norteamérica" else NARANJA for z in orden_z], [pct(zonas[z][1]) for z in orden_z], size=12, brecha=40)
    texto(s, 0.6, 6.45, 5.4, 0.4, "Participación de cada zona en las ventas (%)", size=12, color=TEXTO_SUAVE, align=PP_ALIGN.CENTER)
    barras(s, 6.1, 1.85, 3.1, 4.55, ["2020", "2021", "2022"], [por_anio_eo[a][0] / 1e6 for a in (2020, 2021, 2022)], [AZUL, AZUL, NARANJA], [num(por_anio_eo[a][0] / 1e6, 1) for a in (2020, 2021, 2022)], horizontal=False, size=12, brecha=40)
    texto(s, 6.1, 6.45, 3.1, 0.4, "Ventas de enero a octubre (€ M)", size=12, color=TEXTO_SUAVE, align=PP_ALIGN.CENTER)
    kpi(s, 9.4, 1.85, 3.3, f"−{num(-c['var_ene_oct_2022'], 1)} %", "ventas ene-oct 2022 contra 2021", NARANJA)
    texto(s, 9.4, 3.1, 3.3, 1.5, [f"{ene_oct_22[1]} pedidos en 2022 y {ene_oct_21[1]} en 2021.", f"{c['paises']} países; los 10 primeros suman {pct(c['top10_paises_pct'])}."], size=13, vineta=True, espacio=4)
    decision(s, 9.4, 4.6, 3.3, 2.2, "Reforzar o desarrollar zonas y revisar el ticket medio.")

    # 10 -----------------------------------------------------------------
    n += 1
    g = c["cli_grupos"]
    edades = c["cli_edad_por_grupo"]
    s = base(prs, "Los cinco grupos de clientes son iguales en tamaño y en edad: falta definir qué los distingue", "Fuente: clientes.csv · 999 clientes. País inferido del formato de la dirección.", n,
             f"Los grupos A a E tienen entre {min(g.values())} y {max(g.values())} clientes y una edad promedio de {num(c['cli_edad_media'], 1)} años en todos (entre {num(min(edades.values()), 1)} y {num(max(edades.values()), 1)}). "
             f"Por país, {c['cli_paises']['Estados Unidos']} clientes están en Estados Unidos y {c['cli_paises']['Reino Unido']} en Reino Unido. "
             "Con estos datos los grupos no se diferencian: habría que preguntar qué criterio los define. "
             "Y como las ventas no comparten ID con este archivo, tampoco se puede medir cuánto vale cada grupo.")
    barras(s, 0.6, 1.85, 7.4, 4.55, [f"Grupo {k}" for k in g], list(g.values()), [AZUL] * 5, [str(v) for v in g.values()], horizontal=False, size=14, brecha=50)
    texto(s, 0.6, 6.45, 7.4, 0.4, "Cantidad de clientes por grupo", size=12, color=TEXTO_SUAVE, align=PP_ALIGN.CENTER)
    kpi(s, 8.3, 1.85, 2.1, f"{num(c['cli_edad_media'], 1)} años", "edad promedio, igual en todos los grupos", AZUL)
    kpi(s, 10.6, 1.85, 2.1, f"{c['cli_paises']['Estados Unidos']} / {c['cli_paises']['Reino Unido']}", "EE. UU. / Reino Unido", AZUL)
    texto(s, 8.3, 3.1, 4.4, 1.4, [f"Entre {min(g.values())} y {max(g.values())} clientes por grupo.", "No hay diferencias de tamaño ni de edad."], size=14, vineta=True)
    decision(s, 8.3, 4.5, 4.4, 2.3, "Definir con qué criterio se arman los grupos y medir cuánto vale cada uno, para saber a quién fidelizar primero.")

    # 11 -----------------------------------------------------------------
    n += 1
    s = base(prs, "Qué podría decidir Air Transport en cada nivel", "Cada decisión se apoya en una cifra del tablero.", n,
             "Resumen de las decisiones por nivel. Operativas: lo que se puede corregir esta semana (precio y costo de Cárnicos, plazo de los pedidos críticos). "
             "Tácticas: cómo se gestiona la relación con proveedores y clientes (conciliar saldos, recompra). "
             "Estratégicas: hacia dónde crecer (política por producto, zonas y ticket medio). "
             "Son decisiones para evaluar, no órdenes: el tablero muestra dónde mirar primero.")
    niveles = [
        ("Operativas", "Esta semana", [
            (pct(pr["Cárnicos"][1]), f"Revisar precio y costo de Cárnicos: el margen más bajo, con €{millones(pr['Cárnicos'][0])} M vendidos."),
            (f"{num(prio['Crítica'], 1)} días", f"Plazo objetivo para los pedidos críticos: hoy tardan más que los de baja prioridad ({num(prio['Baja'], 1)}).")]),
        ("Tácticas", "Este trimestre", [
            (f"${num(tr['Más de 36 meses'][1])}", f"Conciliar los {tr['Más de 36 meses'][0]} proveedores sin compras hace más de 36 meses: pagar, renegociar o dar de baja."),
            (pct(c["recurrentes_pct"]), f"Programa de recompra: solo {c['clientes_recurrentes']} de {c['clientes_con_compras']} clientes compraron más de una vez.")]),
        ("Estratégicas", "Este año", [
            (f"{pct(pr['Ropa'][1])} y {pct(pr['Cárnicos'][1])}", "Política por producto: cuidar Ropa y corregir Doméstico, Material de oficina y Cárnicos."),
            (f"−{num(-c['var_ene_oct_2022'], 1)} %", f"Revisar ticket medio y zonas: ventas de ene-oct 2022 con los mismos {por_anio_eo[2022][1]} pedidos; África {pct(zonas['África'][1])}, Norteamérica {pct(zonas['Norteamérica'][1])}.")]),
    ]
    for i, (nombre, cuando, items) in enumerate(niveles):
        x = 0.6 + i * 4.1
        rectangulo(s, x, 1.95, 3.95, 4.85, TARJETA)
        rectangulo(s, x, 1.95, 3.95, 0.75, AZUL_MARCA)
        texto(s, x + 0.15, 1.98, 3.7, 0.4, nombre, size=19, bold=True, color=BLANCO)
        texto(s, x + 0.15, 2.36, 3.7, 0.3, cuando, size=12, color=AZUL_CLARO)
        for j, (cifra, cuerpo) in enumerate(items):
            y = 2.9 + j * 1.95
            texto(s, x + 0.15, y, 3.7, 0.5, cifra, size=26 if len(cifra) <= 12 else 22, bold=True, color=NARANJA)
            texto(s, x + 0.15, y + 0.55, 3.65, 1.3, cuerpo, size=14)

    # 12 -----------------------------------------------------------------
    n += 1
    s = base(prs, "Qué no podemos afirmar todavía y qué pedirle a la empresa", "Los límites también figuran en la página «Datos y alcance» del tablero.", n,
             "Estos son los límites de los datos y conviene decirlos antes de que pregunten. "
             "Uno: ninguno de los 951 IDs de cliente de las ventas figura en el archivo de clientes, así que no se puede medir ventas por grupo de cliente ni por país de residencia. "
             "Dos: las ventas no traen identificador de proveedor. Tres: las ventas están en euros y los saldos en dólares, sin conversión. "
             "Cuatro: noviembre de 2022 está incompleto. Cinco: la antigüedad de los proveedores se mide contra la última fecha del archivo, no contra hoy. Seis: el país de cada cliente se infiere de la dirección. "
             "Si preguntan por el rubro: los productos son bienes de consumo y no servicios aéreos; el trabajo trata los datos como los de la empresa sin suponer nada más. "
             "Próximo paso: pedir un ID común entre ventas y clientes y la moneda de los saldos.")
    limites = [
        "Ventas y clientes no se cruzan: ninguno de los 951 IDs de las ventas está en el archivo de clientes (0 coinciden).",
        "Las ventas no traen identificador de proveedor: no se puede asociar compras con proveedores.",
        "Las ventas están en euros y los saldos de proveedores en dólares, sin conversión.",
        f"Noviembre de 2022 está incompleto (último pedido el {c['ultimo_pedido'].day}/11/2022).",
        f"La antigüedad de los proveedores se mide contra la última compra del archivo ({c['prov_fecha_ref'].day}/{c['prov_fecha_ref'].month}/{c['prov_fecha_ref'].year}), no contra hoy.",
        "El país de cada cliente se infiere del formato de la dirección.",
    ]
    texto(s, 0.6, 1.9, 7.6, 4.9, limites, size=16, vineta=True, espacio=11)
    rectangulo(s, 8.5, 1.9, 4.2, 4.9, TARJETA)
    rectangulo(s, 8.5, 1.9, 4.2, 0.08, NARANJA)
    texto(s, 8.7, 2.1, 3.8, 0.4, "Próximos pasos", size=18, bold=True, color=NARANJA)
    texto(s, 8.7, 2.65, 3.8, 4.0, ["Pedir un ID común entre ventas y clientes para medir ventas por grupo de cliente.",
                                   "Pedir la moneda de los saldos para poder compararlos con las ventas.",
                                   "Completar noviembre de 2022 y volver a medir la tendencia."], size=16, vineta=True, espacio=12)
    return prs


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for tema, salida in SALIDAS.items():
        armar(tema).save(salida)
        print(f"Presentación ({tema}) guardada en {salida}")
