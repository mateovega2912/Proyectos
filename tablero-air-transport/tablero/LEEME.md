# Tablero Air Transport (versión web)

Mismo trabajo que el proyecto de Power BI y la presentación, en una sola aplicación: **abrí `Tablero-Air-Transport.html` con doble clic desde el Explorador de archivos** (un solo archivo, no instala nada y funciona sin internet).

> Si lo abrís desde el panel de archivos de la app, que muestra el HTML como una foto, puede verse sin estilos ni gráficos. Abrilo en el navegador o con la vista previa «tablero» de la app (usa `.claude/launch.json`).

## Qué tiene

| Pestaña | Contenido |
|---|---|
| Operativo, Táctico, Estratégico | Los mismos gráficos y tablas que el Power BI, con los cinco filtros, «Limpiar filtros», tooltips con ventas, margen y pedidos, y el margen total como línea en la dispersión. El Estratégico suma el **mapa coroplético de ventas por país** (rueda para acercar, clic en un país para filtrar), que en Power BI no se pudo incluir. |
| Detalle de producto | Obtención de detalles: clic derecho en un producto > *Obtención de detalles*. |
| Mi página | Página en blanco para armar la tuya: **＋ Agregar gráfico** (de ventas, proveedores o clientes). |
| Decisiones | Las decisiones operativas, tácticas y estratégicas, cada una con su cifra y un acceso al gráfico donde se ve. |
| Presentación | Las 12 diapositivas del guion con cifras calculadas de los datos (flechas del teclado, pantalla completa). |
| Datos y alcance | Los límites de los datos y las tres fuentes. |

## Cómo se usa

- **Todo está enlazado:** un clic en una barra, una dona o un punto filtra el resto (el gráfico que filtra resalta lo elegido). Los filtros activos se ven como etiquetas que se quitan con ×.
- **Medida principal:** el selector de arriba (ventas, margen, pedidos, unidades) cambia a la vez todos los gráficos enlazados a ella, con sus títulos.
- **Editar un gráfico (✎):** título, fuente (en los propios), medida, dimensión, tipo, orden, cuántos mostrar, ancho y alto. Además: mover antes o después, **quitar de la página** (se restaura con el botón de abajo) y **descargar los datos en CSV**.
- **Agrupar tiempo por:** día, semana, mes, trimestre, semestre o año. Cambia a la vez los gráficos de período (ventas, costo y margen; ventas por período; líneas por año); con muchos períodos aparece un zoom. Cada gráfico también se puede fijar a un período desde ✎. Las semanas son bloques de 7 días desde el 1 de enero.
- **Descargar CSV ▾:** baja **un solo .zip** (el navegador no pide permiso por cada archivo) con una de tres opciones: los gráficos de la página (un CSV por gráfico), los datos filtrados de ventas, proveedores y clientes, o todo junto. Siempre trae `filtros-aplicados.txt` con lo que estaba activo. Además, cada gráfico baja su propio CSV desde ✎.
- **Modo oscuro:** botón en la cabecera (☾ / ☀). Cubre gráficos, mapa, tablas y presentación, y se recuerda. Al imprimir se usa siempre el modo claro.
- **Marca:** el logo de Air Transport (en vectores) está en la cabecera y en cada diapositiva de la presentación, con el avión recorriendo un círculo cerrado sin cambiar su inclinación. Se detiene si el sistema pide menos movimiento.
- **Barra superior:** Deshacer, Limpiar filtros, Actividad (bitácora de cambios), **Descargar CSV**, **Imprimir / PDF** y Restablecer todo. Todo lo que editás queda guardado en el navegador.
- **Límites:** igual que en Power BI, los filtros de ventas no tocan proveedores ni clientes (los datos no se relacionan).

## Para cambiar o regenerar

```bash
python tablero/generar_datos.py   # vuelve a leer los CSV de datos/ y arma tablero/datos.js
python tablero/generar_mapa.py    # arma tablero/mapa.js desde vendor/world.json y los nombres de país de los datos
python tablero/servir.py          # opcional: lo sirve en http://localhost:8765
python tablero/empaquetar.py      # junta todo en Tablero-Air-Transport.html (correrlo después de cualquier cambio)
```

**Mapa:** usa el mapa del mundo de ECharts 4.9.0 (`vendor/world.json`, Apache 2.0). Dibuja 174 de los 184 países de los datos; los otros 10 son demasiado chicos para ese mapa (Kosovo, Maldivas, Islas Marshall, Mónaco, Nauru, San Cristóbal y Nieves, San Marino, Taiwán, Tuvalu y Vaticano) y el gráfico los lista en su nota. Sudamérica aparece en blanco porque las ventas no traen ninguna zona ni país de ese continente.

Código: `nucleo.js` (cálculos y estado, sin pantalla), `paginas.js` (qué gráficos hay, como datos), `presentacion.js` (diapositivas y decisiones), `app.js` (pantalla), `descargas.js` (CSV en ZIP), `logo.js` (logo y su animación), `estilos.css` (colores de la empresa, claro y oscuro). Gráficos con Apache ECharts 5.5.1 (`vendor/`, licencia Apache 2.0). Las pruebas (`node tablero/pruebas.js`) verifican las cifras, el enlace entre gráficos, las páginas propias y la presentación.
