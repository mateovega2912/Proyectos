/* Páginas del tablero, declaradas como datos: qué gráficos hay, de qué fuente y qué se puede editar de cada uno.
   med '$' = «medida principal» (la que se cambia desde la barra superior y mueve a todos los gráficos que la usan). */
(function (g) {
  'use strict';
  const cat = (id, o) => Object.assign({ id, tipo: 'cat', fuente: 'ventas', med: '$', graf: 'barra', orden: 'natural', top: 0, span: 4, alto: 270 }, o);
  const kp = (f, m) => ({ f, m });

  const LIMITES = [
    'Ventas y clientes no se cruzan: ninguno de los 951 IDs de cliente de las ventas está en el archivo de clientes. No hay relación entre las tablas, y los filtros de ventas no se aplican a los gráficos de clientes.',
    'Las ventas no traen identificador de proveedor: no se pueden asociar compras con proveedores.',
    'Las ventas están en euros y los saldos de proveedores en dólares, sin conversión.',
    'Noviembre de 2022 está incompleto (último pedido el 7/11/2022).',
    'Los meses sin compra de proveedores se miden contra la última compra del archivo (4/5/2022), no contra hoy.',
    'El país de cada cliente se infiere del formato de la dirección.',
  ];

  const PAGINAS = {
    operativo: {
      titulo: 'Operativo',
      kpis: [kp('ventas', 'ventas'), kp('ventas', 'margenPct'), kp('ventas', 'costo'), kp('ventas', 'ticket'), kp('ventas', 'unidades'), kp('ventas', 'plazo')],
      graficos: [
        { id: 'op_mensual', tipo: 'mensual', dim: 'periodo', graf: 'columna', span: 5, alto: 290 },
        cat('op_producto', { dim: 'producto', orden: 'desc', span: 4, alto: 290, drill: true, nota: 'Clic derecho en un producto: obtención de detalles' }),
        cat('op_canal', { dim: 'canal', graf: 'dona', orden: 'desc', span: 3, alto: 290 }),
        cat('op_prioridad', { dim: 'prioridad', med: 'plazo', span: 3 }),
        cat('op_hist', { dim: 'plazo', med: 'pedidos', graf: 'columna', span: 3 }),
        { id: 'op_pedidos', tipo: 'tabla', tabla: 'pedidos', titulo: 'Seguimiento de pedidos (mayor plazo de envío primero)', span: 6, top: 10, alto: 270 },
      ],
    },
    tactico: {
      titulo: 'Táctico',
      kpis: [kp('proveedores', 'proveedores'), kp('proveedores', 'saldo'), kp('proveedores', 'sin12'), kp('proveedores', 'sin12Pct'),
        kp('ventas', 'recurrentes'), kp('ventas', 'recurrentesPct')],
      graficos: [
        cat('ta_tramo', { fuente: 'proveedores', dim: 'tramo', med: 'proveedores' }),
        cat('ta_saldo', { fuente: 'proveedores', dim: 'anioUlt', med: 'saldo', graf: 'columna' }),
        cat('ta_hist', { fuente: 'proveedores', dim: 'tramoSaldo', med: 'proveedores', graf: 'columna' }),
        { id: 'ta_prov', tipo: 'tabla', tabla: 'proveedores', titulo: 'Top 20 proveedores por saldo (de mayor a menor)', span: 7, top: 20, alto: 330 },
        { id: 'ta_cli', tipo: 'tabla', tabla: 'clientes', titulo: 'Clientes con más de 1 pedido (de mayor a menor)', span: 5, top: 20, alto: 330 },
      ],
    },
    estrategico: {
      titulo: 'Estratégico',
      kpis: [],
      graficos: [
        { id: 'es_lineas', tipo: 'lineas', med: 'ventas', span: 5, alto: 270 },
        cat('es_eneoct', { dim: 'anio', med: 'eneOct', graf: 'columna', span: 3, alto: 270, titulo: 'Ventas de enero a octubre por año', variacion: true }),
        { id: 'es_disp', tipo: 'dispersion', medX: 'ventas', medY: 'margenPct', titulo: 'Rentabilidad por producto', span: 4, alto: 270, drill: true },
        cat('es_mapa', { dim: 'pais', graf: 'mapa', top: 0, span: 8, alto: 340 }),
        cat('es_paises', { dim: 'pais', orden: 'desc', top: 10, span: 4, alto: 340 }),
        cat('es_zona', { dim: 'zona', orden: 'desc', span: 4 }),
        { id: 'es_matriz', tipo: 'matriz', med: '$', titulo: 'Ventas por zona y año', span: 8, alto: 270 },
        cat('es_grupo', { fuente: 'clientes', dim: 'grupo', med: 'clientes', graf: 'columna', span: 2 }),
        cat('es_paiscli', { fuente: 'clientes', dim: 'pais', med: 'clientes', orden: 'desc', top: 8, span: 3 }),
        cat('es_estado', { fuente: 'clientes', dim: 'estado', med: 'clientes', orden: 'desc', top: 8, span: 3 }),
        cat('es_alta', { fuente: 'clientes', dim: 'alta', med: 'clientes', graf: 'columna', span: 2 }),
        cat('es_edad', { fuente: 'clientes', dim: 'tramoEdad', med: 'clientes', graf: 'columna', span: 2 }),
      ],
    },
    datos: {
      titulo: 'Datos y alcance',
      kpis: [],
      graficos: [
        { id: 'da_texto', tipo: 'texto', titulo: 'Límites de los datos', span: 12, items: LIMITES },
        { id: 'da_fuentes', tipo: 'tabla', tabla: 'fuentes', titulo: 'Fuentes de datos', span: 12, top: 5, alto: 200 },
      ],
    },
    decisiones: {
      titulo: 'Decisiones', kpis: [],
      graficos: [
        { id: 'dc_op', tipo: 'decisiones', nivel: 'operativo', titulo: 'Decisiones operativas', span: 4 },
        { id: 'dc_ta', tipo: 'decisiones', nivel: 'tactico', titulo: 'Decisiones tácticas', span: 4 },
        { id: 'dc_es', tipo: 'decisiones', nivel: 'estrategico', titulo: 'Decisiones estratégicas', span: 4 },
      ],
    },
    presentacion: { titulo: 'Presentación', kpis: [], graficos: [{ id: 'pr_slides', tipo: 'slides', titulo: 'Presentación del tablero (12 diapositivas)', span: 12 }] },
    mia: { titulo: 'Mi página', kpis: [], graficos: [] }, /* página en blanco: la arma la persona con «Agregar gráfico» */
    detalle: {
      titulo: 'Detalle de producto',
      kpis: [kp('ventas', 'ventas'), kp('ventas', 'margenPct'), kp('ventas', 'costo'), kp('ventas', 'pedidos'), kp('ventas', 'unidades'), kp('ventas', 'plazo')],
      graficos: [
        cat('de_mensual', { dim: 'periodo', graf: 'columna', span: 6, alto: 260 }),
        cat('de_zona', { dim: 'zona', orden: 'desc', span: 3, alto: 260 }),
        cat('de_canal', { dim: 'canal', graf: 'dona', orden: 'desc', span: 3, alto: 260 }),
        { id: 'de_pedidos', tipo: 'tabla', tabla: 'pedidosProducto', titulo: 'Pedidos del producto (de mayor a menor importe)', span: 12, top: 10, alto: 300 },
      ],
    },
  };
  const ORDEN_TABS = ['operativo', 'tactico', 'estrategico', 'mia', 'decisiones', 'presentacion', 'datos'];
  const FIJAS = ['datos', 'detalle', 'decisiones', 'presentacion']; /* páginas sin agregar, quitar ni mover gráficos */
  g.PAGINAS = PAGINAS;
  g.ORDEN_TABS = ORDEN_TABS;
  g.FIJAS = FIJAS;
})(window);
