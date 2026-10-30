# Entrega: tablero de Air Transport

Acá está lo que pide la consigna, armado desde los tres CSV de `datos/`.

| Archivo | Qué es |
|---|---|
| `AirTransport-presentacion.pptx` | La presentación de 12 diapositivas, con gráficos editables, las decisiones operativas, tácticas y estratégicas, y notas del orador en cada una. |
| `AirTransport-presentacion-oscuro.pptx` | La misma presentación en modo oscuro (fondo azul noche, gráficos con texto claro). Mismas cifras y notas. |
| `powerbi/AirTransport.pbip` | El proyecto de Power BI con el modelo y las páginas del tablero. Se abre con doble clic y se guarda como `.pbix`. |

El logo de Air Transport está dibujado con formas de PowerPoint (sin imágenes): grande en la portada y chico arriba a la derecha en las demás diapositivas. Es una aproximación vectorial del logo; si tenés el archivo original, reemplazalo en la portada y en las demás diapositivas.

## Cómo dejar el tablero listo (5 minutos)

1. **Abrí `powerbi/AirTransport.pbip`** con Power BI Desktop. Si te pide activar la vista previa de *Proyectos de Power BI (.pbip)*, activala en *Archivo > Opciones y configuración > Opciones > Características en versión preliminar* y reiniciá Power BI.
2. **Cargá los datos.** Arriba van a aparecer avisos amarillos. Tocá **Actualizar ahora** (en los dos avisos) y, cuando aparezca, **Aplicar cambios**. Los CSV se leen de la carpeta `datos/` de este proyecto. Si moviste la carpeta, cambiá la ruta en *Transformar datos > Administrar parámetros > RutaDatos* (tiene que terminar con `\`).
3. **Revisá las cifras de control.** Tienen que dar: ventas € 1.289,1 millones, margen 29,6 %, costo € 907,1 millones, ticket medio € 1,29 millones, 5.024.481 unidades, plazo medio 24,0 días, 999 proveedores, saldo pendiente $ 4.265.977, 901 proveedores sin compra en 12 meses (90,5 % del saldo), 48 clientes con más de un pedido (5,0 %) y 5 grupos de clientes de 190 a 208.
4. **Guardá como `.pbix`:** *Archivo > Guardar como* y elegí el tipo de archivo de Power BI. Ese `.pbix` es el que se entrega.
5. **Revisá** el `.pbix` contra la consigna: cuatro páginas (operativo, táctico, estratégico y datos), filtros e interacciones.

## Qué tiene el tablero

- **Operativo:** 6 tarjetas (ventas, margen %, costo, ticket medio, unidades y plazo medio), costo y margen por mes, ventas por producto (con el margen en el tooltip y el detalle del producto con clic derecho), ventas por canal, plazo según prioridad, histograma del plazo y tabla de seguimiento de pedidos. Cinco filtros y botón «Limpiar filtros».
- **Táctico:** proveedores y saldos (tarjetas, antigüedad de la última compra, saldo por año, distribución y tabla de mayores saldos) y clientes con más pedidos.
- **Estratégico:** ventas por mes con una línea por año, comparación de enero a octubre, rentabilidad por producto (dispersión), ventas por país y por zona, matriz zona por año y segmentación de clientes (grupo, país, estado, altas y edad). Los cinco filtros están **sincronizados** con la página operativa.
- **Datos y alcance:** los límites de los datos y las tres fuentes.
- **Tooltip producto:** página oculta con ventas, margen y pedidos, usada por los gráficos de producto y zona.
- **Detalle de producto:** página oculta de obtención de detalles (drill-through). En la página Operativo, clic derecho sobre una barra de «Ventas por producto» > *Obtención de detalles* > *Detalle de producto*. Muestra seis tarjetas del producto, sus ventas por mes, zona y canal, y la lista de sus pedidos de mayor a menor importe. El botón «Volver» regresa a la página de origen.
- **Modelo:** una sola relación (Calendario → Ventas). Ventas no se relaciona con Clientes ni con Proveedores a propósito: los ID no coinciden y las ventas no traen proveedor.

## Qué se comprobó

- **Se abrió en Power BI Desktop** (la versión instalada en esta compu) y las cuatro páginas, el tooltip y el detalle de producto cargan con datos. Las cifras de control de arriba coinciden.
- **La herramienta oficial de Microsoft** para revisar informes (`@microsoft/powerbi-report-authoring-cli`) valida el informe sin errores ni advertencias. Esa revisión encontró y permitió corregir cinco problemas del primer intento.
- **La obtención de detalles** se validó con la herramienta de Microsoft (0 errores, 0 advertencias) y Power BI Desktop la reconoció: al guardar una copia conservó la página como «Drillthrough» con su filtro por producto. No hice yo el clic derecho en pantalla: probalo una vez.
- **Una prueba de Power BI** detectó una dependencia circular en el orden de «Prioridad» y se corrigió con una columna propia.
- Esto no reemplaza que lo abras vos: si aparece un mensaje de error, copiá el texto completo.

## Lo que tenés que saber

- **No hay mapa.** Azure Maps le pide a Power BI que inicie sesión con una cuenta de Microsoft al abrir la página, así que lo reemplacé por barras de ventas por país y por zona. Si querés el mapa, agregalo en *Insertar > Mapa de Azure Maps* con el país y las ventas (te va a pedir iniciar sesión). Por eso el evaluador marca el análisis geográfico como «cumple en parte».
- **Las tablas** de mayores saldos y de clientes con más pedidos están ordenadas de mayor a menor; no tienen el filtro «Top 20» ni «más de 1 pedido» de la guía.
- **En «Clientes por estado»** la barra más larga (457) son los clientes de Reino Unido, que no tienen estado.
- **Antes de presentar:** completá tu nombre en la portada y mirá las notas del orador (vista del moderador): explican de dónde sale cada cifra.

## Para regenerar todo

```bash
python entrega/generar_presentacion.py
python entrega/generar_powerbi.py
```

La presentación comprueba cada cifra contra los datos de referencia antes de armarse: si un dato cambia, avisa en vez de mostrar una cifra equivocada.
