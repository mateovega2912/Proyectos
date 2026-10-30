/* Interfaz del tablero. Un único estado (filtros + ediciones); cada acción lo cambia y se redibuja todo desde él. */
(function () {
  'use strict';
  const { DIMS, MEDS, PRINCIPALES, filtrar, agrupar, reducir, estadoInicial, filtrosEf, fmt } = window.NU;
  const DAT = window.DATOS;
  const FILAS = { ventas: DAT.ventas, proveedores: DAT.proveedores, clientes: DAT.clientes };
  /* paletas de color: el modo oscuro cambia estas variables y vuelve a dibujar todo */
  const PALETAS = {
    claro: { colores: ['#185890', '#E84818', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6', '#E34948'], apagado: '#C5D0DC', linea: '#E6EBF1', txt: '#525B66', area: '#EDF0F4', borde: '#FFFFFF' },
    oscuro: { colores: ['#4C9BE0', '#FF6A3D', '#2ED39B', '#F2B724', '#F08FB4', '#3FBF3F', '#8D7BFF', '#FF6B6A'], apagado: '#3A4B5E', linea: '#26364A', txt: '#9FB0C3', area: '#1D2B3A', borde: '#15222F' },
  };
  const CLAVE_TEMA = 'at-tema';
  let tema = 'claro', COLORES, AZUL, NARANJA, APAGADO, LIN, TXT, AREA, BORDE_MAPA, BASE;
  function usarPaleta(t) {
    tema = t;
    const p = PALETAS[t];
    COLORES = p.colores; AZUL = COLORES[0]; NARANJA = COLORES[1]; APAGADO = p.apagado; LIN = { color: p.linea }; TXT = p.txt; AREA = p.area; BORDE_MAPA = p.borde;
    BASE = { color: COLORES, backgroundColor: 'transparent', animationDuration: 450, textStyle: { fontFamily: 'Segoe UI, system-ui, sans-serif' } };
  }
  const temaGuardado = () => { try { return localStorage.getItem(CLAVE_TEMA) === 'oscuro' ? 'oscuro' : 'claro'; } catch (e) { return 'claro'; } };
  usarPaleta(temaGuardado());
  const GRAF = [['barra', 'Barras'], ['columna', 'Columnas'], ['linea', 'Líneas'], ['area', 'Área'], ['dona', 'Dona'], ['mapa', 'Mapa (solo por país)']];
  const ORDENES = [['natural', 'Orden natural'], ['desc', 'Mayor a menor'], ['asc', 'Menor a mayor']];
  const TOPS = [[0, 'Todos'], [5, 'Primeros 5'], [8, 'Primeros 8'], [10, 'Primeros 10'], [15, 'Primeros 15'], [20, 'Primeros 20']];
  const FILAS_TABLA = [[5, '5 filas'], [10, '10 filas'], [15, '15 filas'], [20, '20 filas'], [50, '50 filas']];
  const FUENTE = { ventas: 'ventas', proveedores: 'proveedores', clientes: 'clientes' };
  const TITULOS = { operativo: 'Ventas y operación diaria', tactico: 'Proveedores y clientes recurrentes', estrategico: 'Rentabilidad, mercados y clientes', mia: 'Mi página', decisiones: 'Decisiones por nivel', presentacion: 'Presentación del tablero', datos: 'Datos y alcance' };
  const esFija = (p) => window.FIJAS.includes(p);
  const ANCHOS = [[3, 'Chico (3/12)'], [4, 'Mediano (4/12)'], [6, 'Grande (6/12)'], [8, 'Muy grande (8/12)'], [12, 'Todo el ancho']];
  const ALTOS = [[200, 'Bajo'], [270, 'Normal'], [340, 'Alto'], [420, 'Muy alto']];
  const SEGMENTADORES = ['anio', 'zona', 'canal', 'prioridad', 'producto'];
  const CLAVE = 'at-tablero-v1';

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fecha = (s) => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);

  /* ------------------------------------------------------------------ estado */
  const cargar = () => {
    try { const s = JSON.parse(localStorage.getItem(CLAVE)); return s && s.filtros ? Object.assign(estadoInicial(), s) : estadoInicial(); } catch (e) { return estadoInicial(); }
  };
  const guardar = () => { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* sin almacenamiento: no pasa nada */ } };
  let estado = cargar();
  if (estado.detalle && !FILAS.ventas.some((r) => r.producto === estado.detalle)) estado = Object.assign({}, estado, { detalle: null });
  const historial = [];
  let vistas = new Map(), dibujada = null, editando = null;

  function enviar(a) {
    if (a.t === 'deshacer') {
      if (!historial.length) return;
      estado = Object.assign({}, historial.pop(), { pagina: estado.pagina, detalle: estado.detalle });
    } else {
      const nuevo = reducir(estado, a);
      if (nuevo === estado) return;
      if (!['pagina', 'volver'].includes(a.t)) historial.push(estado);
      estado = nuevo;
    }
    guardar();
    actualizar();
  }

  const clavePagina = () => (estado.detalle ? 'detalle' : estado.pagina);
  const medidasDe = (f) => Object.entries(MEDS[f]).map(([k, m]) => [k, m.n]);
  const dimsDe = (f) => Object.entries(DIMS[f]).map(([k, d]) => [k, d.n]).concat(f === 'ventas' ? [['periodo', 'Período elegido arriba («Agrupar tiempo»)']] : []);

  /* especificación efectiva = la de la página + las ediciones del usuario (con la medida principal ya resuelta) */
  function efectiva(s) {
    const o = Object.assign({ fuente: 'ventas' }, s, estado.ed[s.id] || {});
    if (o.dim === 'periodo' && o.fuente === 'ventas') o.dim = estado.granularidad;
    if (o.tipo === 'cat' && !DIMS[o.fuente][o.dim]) o.dim = s.dim;
    if (o.med === '$') o.med = estado.principal;
    if (o.med && !MEDS[o.fuente][o.med]) o.med = s.med === '$' ? estado.principal : s.med;
    return o;
  }
  /* posición dentro del año para las líneas (una por año), según cómo se agrupe el tiempo */
  const POSICION = {
    mes: { nombre: 'mes', campo: 'mesN', et: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] },
    trimestre: { nombre: 'trimestre', campo: 'trimN', et: ['T1', 'T2', 'T3', 'T4'] },
    semestre: { nombre: 'semestre', campo: 'semestreN', et: ['S1', 'S2'] },
    semana: { nombre: 'semana', campo: 'semanaN', et: Array.from({ length: 53 }, (_, i) => 'Sem ' + (i + 1)) },
    dia: { nombre: 'día', campo: 'diaN', et: Array.from({ length: 366 }, (_, i) => 'Día ' + (i + 1)) },
  };
  const posicion = () => POSICION[estado.granularidad] || POSICION.mes; /* «año» no tiene posición: se usa el mes */
  const TIEMPO = ['anio', 'mes', 'dia', 'semana', 'trimestre', 'semestre'];
  const TIEMPO_OPC = [['periodo', 'Período elegido arriba («Agrupar tiempo»)']].concat(window.NU.GRANULARIDADES);
  function titulo(s) {
    if (s.titulo) return s.titulo;
    if (s.tipo === 'cat') return MEDS[s.fuente][s.med].n + ' por ' + DIMS[s.fuente][s.dim].n.toLowerCase();
    if (s.tipo === 'mensual') return 'Ventas, costo y margen por ' + DIMS.ventas[s.dim].n.toLowerCase();
    if (s.tipo === 'lineas') return MEDS.ventas[s.med].n + ' por ' + posicion().nombre + ', una línea por año';
    return s.id;
  }

  /* ------------------------------------------------------------------ formatos de eje y etiquetas */
  function etq(t, v) {
    if (t === 'eur') return fmt.n1(v / 1e6) + ' M';
    if (t === 'eur2') return fmt.n2(v / 1e6) + ' M';
    if (t === 'usd') return v >= 1e6 ? '$ ' + fmt.n1(v / 1e6) + ' M' : '$ ' + fmt.n0(v / 1e3) + ' mil';
    if (t === 'pct') return fmt.n0(v * 100) + ' %';
    return t === 'n1' ? fmt.n1(v) : fmt.n0(v);
  }
  const vacio = () => Object.assign({}, BASE, { graphic: { type: 'text', left: 'center', top: 'middle', style: { text: 'Sin datos con estos filtros', fill: TXT, fontSize: 13 } } });

  function tip(s, datos, i) {
    const d = datos[i];
    if (!d) return '';
    const m = MEDS[s.fuente][s.med];
    let h = '<b>' + esc(d.et) + '</b><br>' + esc(m.n) + ': <b>' + fmt[m.t](d.v) + '</b>';
    if (s.fuente === 'ventas') {
      const R = filtrar('ventas', FILAS.ventas, filtrosEf(estado), s.dim).filter((r) => String(DIMS.ventas[s.dim].f(r)) === String(d.k));
      ['ventas', 'margenPct', 'pedidos'].filter((k) => k !== s.med).forEach((k) => { const mm = MEDS.ventas[k]; h += '<br>' + mm.n + ': ' + fmt[mm.t](mm.f(R, FILAS.ventas)); });
      if (s.variacion) {
        const prev = datos.find((x) => x.k === d.k - 1);
        if (prev && prev.v) h += '<br>Variación interanual ene-oct: <b>' + fmt.pct(d.v / prev.v - 1) + '</b>';
      }
    }
    return h;
  }

  /* ------------------------------------------------------------------ gráficos */
  function opcionCat(s, v, sel) {
    if (s.graf === 'mapa') return s.dim === 'pais' ? opcionMapa(s, v, sel) : opcionCat(Object.assign({}, s, { graf: 'columna' }), v, sel);
    const t = MEDS[s.fuente][s.med].t, apaga = (d) => sel != null && String(d.k) !== String(sel), datos = v.datos;
    if (s.graf === 'dona') {
      return Object.assign({}, BASE, {
        tooltip: { trigger: 'item', confine: true, formatter: (p) => tip(s, datos, p.dataIndex) },
        legend: { bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
        series: [{ type: 'pie', radius: ['42%', '70%'], center: ['50%', '44%'], label: { position: 'inside', formatter: '{d}%', fontSize: 11, color: '#fff' }, labelLine: { show: false },
          data: datos.map((d, i) => ({ name: d.et, value: d.v, itemStyle: { color: COLORES[i % COLORES.length], opacity: apaga(d) ? 0.3 : 1 } })) }],
      });
    }
    const hor = s.graf === 'barra', lineal = s.graf === 'linea' || s.graf === 'area', pocas = datos.length <= 14;
    const zoom = conZoom(datos.length);
    const eje = { type: 'category', data: datos.map((d) => d.et), inverse: hor, axisTick: { show: false },
      axisLabel: { fontSize: 11, hideOverlap: true, interval: pocas ? 0 : 'auto', width: hor ? 110 : 80, overflow: 'truncate' } };
    const val = { type: 'value', show: !(hor && pocas), axisLabel: { fontSize: 11, hideOverlap: true, formatter: (x) => etq(t, x) }, splitLine: { lineStyle: LIN } };
    const serie = lineal
      ? { type: 'line', symbolSize: 7, lineStyle: { color: AZUL, width: 2.5 }, areaStyle: s.graf === 'area' ? { opacity: 0.18, color: AZUL } : undefined,
        data: datos.map((d) => ({ value: d.v, itemStyle: { color: apaga(d) ? APAGADO : AZUL } })) }
      : { type: 'bar', barMaxWidth: 34, data: datos.map((d) => ({ value: d.v, itemStyle: { color: apaga(d) ? APAGADO : AZUL, borderRadius: hor ? [0, 4, 4, 0] : [4, 4, 0, 0] } })),
        label: pocas ? { show: true, position: hor ? 'right' : 'top', fontSize: 10.5, color: TXT, formatter: (p) => etq(t, p.value) } : { show: false } };
    return Object.assign({}, BASE, {
      grid: { left: 6, right: hor ? 54 : 14, top: 18, bottom: 4 + (hor ? 0 : zoom.abajo), containLabel: true },
      dataZoom: hor ? undefined : zoom.dataZoom,
      tooltip: { trigger: 'axis', confine: true, axisPointer: { type: lineal ? 'line' : 'shadow' }, formatter: (ps) => tip(s, datos, ps[0].dataIndex) },
      xAxis: hor ? val : eje, yAxis: hor ? eje : val, series: [serie],
    });
  }

  /* mapa coroplético por país: el nombre de los datos se traduce al del mapa; los países sin polígono se declaran en la nota */
  const NOMBRES_MAPA = new Set(window.MAPA.features.map((f) => f.properties.name));
  const enMapa = (k) => window.MAPA_NOMBRES[String(k).trim()] || String(k).trim();
  function opcionMapa(s, v, sel) {
    if (!window.echarts.getMap('mundo')) window.echarts.registerMap('mundo', window.MAPA);
    const t = MEDS[s.fuente][s.med].t, nameMap = {}, datos = v.datos;
    datos.forEach((d) => { nameMap[enMapa(d.k)] = d.et; });
    return Object.assign({}, BASE, {
      tooltip: { trigger: 'item', confine: true, formatter: (p) => (datos[p.dataIndex] ? tip(s, datos, p.dataIndex) : '<b>' + esc(p.name) + '</b><br>Sin ventas en los datos') },
      visualMap: { min: 0, max: Math.max(1, ...datos.map((d) => d.v)), calculable: true, left: 8, bottom: 8, itemWidth: 10, itemHeight: 90, textStyle: { fontSize: 10, color: TXT },
        inRange: { color: ['#CDE2FB', '#4F8CC4', '#185890', '#0B2E4F'] }, formatter: (x) => etq(t, x) },
      series: [{ type: 'map', map: 'mundo', roam: true, nameMap, selectedMode: false, label: { show: false },
        itemStyle: { areaColor: AREA, borderColor: BORDE_MAPA, borderWidth: 0.5 }, emphasis: { label: { show: false }, itemStyle: { areaColor: NARANJA } },
        data: datos.map((d) => ({ name: d.et, value: d.v,
          itemStyle: sel == null ? {} : String(d.k) === String(sel) ? { borderColor: NARANJA, borderWidth: 2 } : { opacity: 0.35 } })) }],
    });
  }

  /* con muchos períodos (días, semanas) se agrega un zoom con deslizador */
  const conZoom = (n) => (n > 40 ? { dataZoom: [{ type: 'inside' }, { type: 'slider', height: 14, bottom: 2 }], abajo: 26 } : { abajo: 0 });

  function opcionMensual(s, v, sel) {
    const t = 'eur', F = filtrosEf(estado), R = filtrar('ventas', FILAS.ventas, F, s.dim), nombre = DIMS.ventas[s.dim].n;
    const costo = agrupar('ventas', R, s.dim, 'costo', 'natural', 0), margen = agrupar('ventas', R, s.dim, 'margen', 'natural', 0);
    v.datos = costo.map((c, i) => ({ k: c.k, et: c.et, costo: c.v, margen: margen[i].v }));
    v.exportar = () => ({ cab: [nombre, 'Costo', 'Margen bruto'], filas: v.datos.map((d) => [d.et, d.costo, d.margen]) });
    const apaga = (d) => sel != null && String(d.k) !== String(sel), lineal = s.graf === 'linea', z = conZoom(v.datos.length);
    const serie = (nom, campo, color) => ({ name: nom, type: lineal ? 'line' : 'bar', stack: lineal ? undefined : 'v', barMaxWidth: 22, symbolSize: 5, showSymbol: v.datos.length <= 40,
      itemStyle: { color }, lineStyle: { width: 2.5 }, data: v.datos.map((d) => ({ value: d[campo], itemStyle: { color: apaga(d) ? APAGADO : color } })) });
    return Object.assign({}, BASE, {
      grid: { left: 6, right: 14, top: 34, bottom: 4 + z.abajo, containLabel: true },
      legend: { top: 0, right: 0, textStyle: { fontSize: 11 }, data: ['Costo', 'Margen bruto'] },
      tooltip: { trigger: 'axis', confine: true, formatter: (ps) => { const d = v.datos[ps[0].dataIndex]; return '<b>' + esc(d.et) + '</b><br>Ventas: <b>' + fmt.eur(d.costo + d.margen) + '</b><br>Costo: ' + fmt.eur(d.costo) + '<br>Margen bruto: ' + fmt.eur(d.margen); } },
      dataZoom: z.dataZoom,
      xAxis: { type: 'category', data: v.datos.map((d) => d.et), axisTick: { show: false }, axisLabel: { fontSize: 10.5, hideOverlap: true } },
      yAxis: { type: 'value', axisLabel: { fontSize: 11, formatter: (x) => etq(t, x) }, splitLine: { lineStyle: LIN } },
      series: [serie('Costo', 'costo', AZUL), serie('Margen bruto', 'margen', NARANJA)],
    });
  }

  function opcionLineas(s, v, sel) {
    const t = MEDS.ventas[s.med].t, P = posicion(), R = filtrar('ventas', FILAS.ventas, filtrosEf(estado), TIEMPO);
    const anios = [...new Set(R.map((r) => r.anio))].sort(), idx = new Map(), n = P.et.length, z = conZoom(n);
    R.forEach((r) => { const k = r.anio + '|' + r[P.campo]; if (!idx.has(k)) idx.set(k, []); idx.get(k).push(r); });
    v.datos = anios;
    const valor = (a, m) => { const rr = idx.get(a + '|' + (m + 1)); return rr ? MEDS.ventas[s.med].f(rr, R) : null; };
    v.exportar = () => ({ cab: ['Año', P.nombre[0].toUpperCase() + P.nombre.slice(1), MEDS.ventas[s.med].n],
      filas: anios.flatMap((a) => P.et.map((e, m) => [a, e, valor(a, m)]).filter((f) => f[2] != null)) });
    return Object.assign({}, BASE, {
      grid: { left: 6, right: 14, top: 34, bottom: 4 + z.abajo, containLabel: true },
      legend: { top: 0, right: 0, textStyle: { fontSize: 11 } },
      tooltip: { trigger: 'axis', confine: true, valueFormatter: (x) => (x == null ? '—' : fmt[t](x)) },
      dataZoom: z.dataZoom,
      xAxis: { type: 'category', data: P.et, axisTick: { show: false }, axisLabel: { fontSize: 11, hideOverlap: true } },
      yAxis: { type: 'value', axisLabel: { fontSize: 11, formatter: (x) => etq(t, x) }, splitLine: { lineStyle: LIN } },
      series: anios.map((a, i) => ({ name: String(a), type: 'line', symbolSize: 6, showSymbol: n <= 12, connectNulls: n > 12,
        lineStyle: { width: 2.5, opacity: sel == null || String(sel) === String(a) ? 1 : 0.25 }, itemStyle: { color: COLORES[i % COLORES.length] },
        data: P.et.map((_, m) => valor(a, m)) })),
    });
  }

  function opcionDispersion(s, v, sel) {
    const R = filtrar('ventas', FILAS.ventas, filtrosEf(estado), 'producto');
    const gx = agrupar('ventas', R, 'producto', s.medX, 'natural', 0), gy = agrupar('ventas', R, 'producto', s.medY, 'natural', 0);
    v.datos = gx.map((d, i) => ({ k: d.k, et: d.et, x: d.v, y: gy[i].v }));
    const mx = MEDS.ventas[s.medX], my = MEDS.ventas[s.medY];
    v.exportar = () => ({ cab: ['Producto', mx.n, my.n], filas: v.datos.map((d) => [d.et, d.x, d.y]) });
    const ejeV = (m, extra) => Object.assign({ type: 'value', name: m.n, nameLocation: 'middle', scale: true, nameTextStyle: { fontSize: 11, color: TXT },
      axisLabel: { fontSize: 11, formatter: (x) => etq(m.t, x) }, splitLine: { lineStyle: LIN } }, extra);
    return Object.assign({}, BASE, {
      grid: { left: 6, right: 30, top: 14, bottom: 4, containLabel: true },
      tooltip: { trigger: 'item', confine: true, formatter: (p) => { const d = v.datos[p.dataIndex]; return '<b>' + esc(d.et) + '</b><br>' + mx.n + ': ' + fmt[mx.t](d.x) + '<br>' + my.n + ': ' + fmt[my.t](d.y); } },
      xAxis: ejeV(mx, { nameGap: 28 }), yAxis: ejeV(my, { nameGap: 44 }),
      series: [{ type: 'scatter', symbolSize: 15, label: { show: true, formatter: '{b}', position: 'right', fontSize: 10, color: TXT },
        markLine: s.medY === 'margenPct' && R.length ? { silent: true, symbol: 'none', lineStyle: { color: AZUL, type: 'dashed' },
          label: { formatter: 'Margen total ' + fmt.pct(MEDS.ventas.margenPct.f(R, R)), position: 'insideEndTop', fontSize: 10, color: AZUL },
          data: [{ yAxis: MEDS.ventas.margenPct.f(R, R) }] } : undefined,
        data: v.datos.map((d) => ({ name: d.et, value: [d.x, d.y], itemStyle: { color: sel != null && String(d.k) !== String(sel) ? APAGADO : NARANJA } })) }],
    });
  }

  /* ------------------------------------------------------------------ tablas y matriz */
  const col = (h, f, n) => ({ h, f, n });
  const TABLAS = {
    pedidos: { fuente: 'ventas', filas: (F) => filtrar('ventas', FILAS.ventas, F).slice().sort((a, b) => b.plazo - a.plazo),
      cols: [col('Pedido', (r) => r.id), col('Fecha', (r) => fecha(r.fecha)), col('Plazo (días)', (r) => fmt.n0(r.plazo), 1), col('País', (r) => r.pais),
        col('Producto', (r) => r.producto), col('Prioridad', (r) => r.prioridad), col('Venta', (r) => fmt.eur(r.venta), 1)] },
    proveedores: { fuente: 'proveedores', filas: (F) => filtrar('proveedores', FILAS.proveedores, F).slice().sort((a, b) => b.saldo - a.saldo),
      cols: [col('ID', (r) => r.id), col('Proveedor', (r) => r.nombre), col('Saldo', (r) => fmt.usd(r.saldo), 1), col('Última compra', (r) => fecha(r.fecha)),
        col('Meses sin compra', (r) => fmt.n1(r.meses), 1)] },
    clientes: { fuente: 'ventas', filas: (F) => {
      const m = new Map();
      filtrar('ventas', FILAS.ventas, F).forEach((r) => { const c = m.get(r.cli) || { id: r.cli, p: new Set(), v: 0 }; c.p.add(r.id); c.v += r.venta; m.set(r.cli, c); });
      return [...m.values()].filter((c) => c.p.size > 1).sort((a, b) => b.p.size - a.p.size || b.v - a.v);
    }, cols: [col('Cliente', (r) => r.id), col('Pedidos', (r) => fmt.n0(r.p.size), 1), col('Ventas', (r) => fmt.eur(r.v), 1)] },
    pedidosProducto: { fuente: 'ventas', filas: (F) => filtrar('ventas', FILAS.ventas, F).slice().sort((a, b) => b.venta - a.venta),
      cols: [col('Pedido', (r) => r.id), col('Fecha', (r) => fecha(r.fecha)), col('País', (r) => r.pais), col('Zona', (r) => r.zona), col('Canal', (r) => r.canal),
        col('Prioridad', (r) => r.prioridad), col('Plazo (días)', (r) => fmt.n0(r.plazo), 1), col('Venta', (r) => fmt.eur(r.venta), 1)] },
    fuentes: { filas: () => [
      { f: 'ventas.csv', n: FILAS.ventas.length, p: 'Pedidos del ' + fecha(DAT.meta.ventasDesde) + ' al ' + fecha(DAT.meta.ventasHasta) },
      { f: 'proveedores.csv', n: FILAS.proveedores.length, p: 'Últimas compras del ' + fecha(DAT.meta.provDesde) + ' al ' + fecha(DAT.meta.provRef) },
      { f: 'clientes.csv', n: FILAS.clientes.length, p: 'Altas de ' + DAT.meta.altaDesde + ' a ' + DAT.meta.altaHasta }],
    cols: [col('Fuente', (r) => r.f), col('Filas', (r) => fmt.n0(r.n), 1), col('Período', (r) => r.p)] },
  };

  function pintarTabla(v, s) {
    const T = TABLAS[s.tabla], filas = T.filas(filtrosEf(estado)), top = s.top || 10;
    v.exportar = () => ({ cab: T.cols.map((c) => c.h), filas: filas.map((r) => T.cols.map((c) => c.f(r))) });
    const tabla = el('table'), cab = el('tr');
    T.cols.forEach((c) => cab.append(el('th', c.n ? 'n' : '', c.h)));
    const thead = el('thead');
    thead.append(cab);
    tabla.append(thead);
    const cuerpo = el('tbody');
    filas.slice(0, top).forEach((r) => { const tr = el('tr'); T.cols.forEach((c) => tr.append(el('td', c.n ? 'n' : '', c.f(r)))); cuerpo.append(tr); });
    tabla.append(cuerpo);
    const caja = el('div', 'tabla-caja');
    caja.style.maxHeight = (s.alto || 300) - 24 + 'px';
    caja.append(tabla);
    v.caja.replaceChildren(caja, el('p', 'pie-tabla', filas.length ? 'Mostrando ' + Math.min(top, filas.length) + ' de ' + fmt.n0(filas.length) : 'Sin datos con estos filtros'));
  }

  function pintarMatriz(v, s) {
    const R = filtrar('ventas', FILAS.ventas, filtrosEf(estado), ['zona', 'anio']), m = MEDS.ventas[s.med], F = estado.filtros.ventas;
    const zonas = agrupar('ventas', R, 'zona', s.med, 'desc', 0).map((d) => d.k), anios = agrupar('ventas', R, 'anio', s.med, 'natural', 0).map((d) => d.k);
    const celda = (z, a) => { const rr = R.filter((r) => (z == null || r.zona === z) && (a == null || r.anio === a)); return rr.length ? m.f(rr, R) : null; };
    const max = Math.max(1, ...zonas.flatMap((z) => anios.map((a) => celda(z, a) || 0)));
    const tabla = el('table'), cab = el('tr');
    cab.append(el('th', '', 'Zona'));
    anios.forEach((a) => { const th = el('th', 'n clic' + (String(F.anio) === String(a) ? ' sel' : ''), String(a)); th.onclick = () => enviar({ t: 'filtro', f: 'ventas', d: 'anio', v: a }); cab.append(th); });
    cab.append(el('th', 'n', 'Total'));
    const thead = el('thead');
    thead.append(cab);
    tabla.append(thead);
    const cuerpo = el('tbody');
    zonas.forEach((z) => {
      const tr = el('tr'), th = el('td', 'clic' + (F.zona === z ? ' sel' : ''), z);
      th.onclick = () => enviar({ t: 'filtro', f: 'ventas', d: 'zona', v: z });
      tr.append(th);
      anios.forEach((a) => { const x = celda(z, a), td = el('td', 'n', x == null ? '—' : fmt[m.t](x)); if (x) td.style.background = 'rgba(24,88,144,' + (0.08 + 0.42 * x / max).toFixed(2) + ')'; if (x && x / max > 0.6) td.style.color = '#fff'; tr.append(td); });
      tr.append(el('td', 'n', fmt[m.t](celda(z, null) || 0)));
      cuerpo.append(tr);
    });
    tabla.append(cuerpo);
    const caja = el('div', 'tabla-caja');
    caja.style.maxHeight = (s.alto || 270) - 24 + 'px';
    caja.append(tabla);
    v.caja.replaceChildren(caja, el('p', 'pie-tabla', m.n + ' · clic en una zona o un año para filtrar'));
  }

  /* ------------------------------------------------------------------ decisiones, presentación y exportación */
  let K = null, DIAPOS = null, diapo = 0;
  function presentacion() {
    if (!DIAPOS) { K = window.PRESENTACION.cifras(); DIAPOS = window.PRESENTACION.diapositivas(K); }
    return DIAPOS;
  }
  const irA = (p) => { const b = el('button', 'ir', 'Ver en el tablero ▸'); b.onclick = () => enviar({ t: 'pagina', p }); return b; };
  function bloqueDecision(d) {
    const c = el('div', 'decision');
    c.append(el('b', '', d.texto), el('p', 'cifra', d.cifra), irA(d.ir));
    return c;
  }
  function pintarDecisiones(v, s) {
    presentacion();
    const cont = el('div', 'decisiones');
    window.PRESENTACION.decisiones(K)[s.nivel].forEach((d) => cont.append(bloqueDecision(d)));
    v.caja.replaceChildren(cont);
  }
  /* pantalla completa: la tarjeta se superpone a toda la ventana (anda en cualquier visor) y, si el navegador lo permite, se pide además la pantalla completa real */
  function pantallaCompleta(v, activar) {
    const on = activar === undefined ? !v.t.classList.contains('pc') : activar;
    v.t.classList.toggle('pc', on);
    document.body.classList.toggle('sin-scroll', on);
    if (on) {
      v.t.scrollTop = 0;
      if (v.t.requestFullscreen) v.t.requestFullscreen().catch(() => { /* el visor no lo permite: queda la versión que ocupa toda la ventana */ });
    } else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    pintarSlides(v);
  }
  const salirDePantallaCompleta = () => vistas.forEach((v) => { if (v.t && v.t.classList.contains('pc')) pantallaCompleta(v, false); });

  function irDiapo(n) {
    const v = vistas.get('pr_slides');
    if (!v) return;
    diapo = Math.max(0, Math.min(presentacion().length - 1, n));
    pintarSlides(v);
  }
  function pintarSlides(v) {
    const D = presentacion(), d = D[diapo], cont = el('div', 'slide');
    cont.append(el('small', '', 'Diapositiva ' + (diapo + 1) + ' de ' + D.length), el('h2', '', d.t));
    if (d.p) { const ul = el('ul'); d.p.forEach((x) => ul.append(el('li', '', x))); cont.append(ul); }
    if (d.c) { const t = el('div', 'tiles'); d.c.forEach(([k, x]) => { const i = el('div', 'tile'); i.append(el('small', '', k), el('b', '', x)); t.append(i); }); cont.append(t); }
    if (d.niveles) {
      const t = el('div', 'niveles');
      [['operativo', 'Operativas'], ['tactico', 'Tácticas'], ['estrategico', 'Estratégicas']].forEach(([k, n]) => {
        const col = el('div', 'nivel');
        col.append(el('h3', '', n));
        d.niveles[k].forEach((x) => col.append(bloqueDecision(x)));
        t.append(col);
      });
      cont.append(t);
    }
    if (d.d) { const b = el('div', 'decision-box'); b.append(el('b', '', 'Decisión: '), document.createTextNode(d.d)); cont.append(b); }
    const nav = el('div', 'slide-nav'), ant = el('button', '', '◀ Anterior'), sig = el('button', '', 'Siguiente ▶'), pant = el('button', '', v.t.classList.contains('pc') ? 'Salir de pantalla completa' : 'Pantalla completa');
    ant.disabled = diapo === 0; sig.disabled = diapo === D.length - 1;
    ant.onclick = () => irDiapo(diapo - 1); sig.onclick = () => irDiapo(diapo + 1);
    pant.onclick = () => pantallaCompleta(v);
    nav.append(ant, sig, pant);
    if (d.ir && d.ir !== 'decisiones') nav.append(irA(d.ir));
    v.caja.replaceChildren(cont, nav);
  }

  function descargarCsv(datos, nombre) {
    const celda = (c) => '"' + String(c).replace(/"/g, '""') + '"';
    const csv = [datos.cab].concat(datos.filas).map((r) => r.map(celda).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre.replace(/[^\wáéíóúñ -]+/gi, '').trim().replace(/\s+/g, '-').toLowerCase() + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ------------------------------------------------------------------ página */
  const CHART = ['cat', 'mensual', 'lineas', 'dispersion'];

  /* gráficos de una página: los de siempre (menos los quitados) más los agregados, en el orden elegido */
  function graficosDe(pag) {
    const P = window.PAGINAS[pag];
    if (esFija(pag)) return P.graficos;
    const orden = estado.orden[pag] || [], pos = (s) => (orden.indexOf(s.id) + 1) || 999;
    return P.graficos.filter((s) => !estado.ocultos[s.id]).concat(estado.extra[pag] || []).sort((a, b) => pos(a) - pos(b));
  }

  function armar(pag, lista, quitados) {
    vistas.forEach((v) => { if (v.ro) v.ro.disconnect(); if (v.chart) v.chart.dispose(); });
    vistas = new Map();
    document.body.classList.remove('sin-scroll');
    const cont = $('pagina'), P = window.PAGINAS[pag];
    cont.replaceChildren();
    if (P.kpis.length) {
      const k = el('div', 'kpis');
      P.kpis.forEach(() => { const c = el('div', 'kpi'); c.append(el('small'), el('b')); k.append(c); });
      cont.append(k);
      vistas.set('kpis', { tipo: 'kpis', caja: k, kpis: P.kpis });
    }
    lista.forEach((s0) => {
      const t = el('section', 'tarjeta'), cab = el('div', 'tarjeta-cab'), h = el('h3'), b = el('button', 'editar', '✎');
      t.style.gridColumn = 'span ' + s0.span;
      b.title = 'Editar este gráfico'; b.setAttribute('aria-label', 'Editar gráfico'); b.onclick = () => abrirEditor(s0.id);
      cab.append(h, b);
      const nota = el('p', 'nota'), caja = el('div', 'caja');
      if (CHART.includes(s0.tipo)) caja.style.height = (s0.alto || 270) + 'px';
      t.append(cab, nota, caja);
      cont.append(t);
      const v = { s: s0, t, h, nota, caja, datos: [] };
      if (CHART.includes(s0.tipo)) {
        v.chart = window.echarts.init(caja, tema === 'oscuro' ? 'dark' : null);
        v.ro = new ResizeObserver(() => v.chart.resize());
        v.ro.observe(caja);
        v.chart.on('click', (p) => { const k = claveDe(v, p); if (k != null) enviar({ t: 'filtro', f: v.ff, d: v.fd, v: k }); });
        v.chart.on('dblclick', (p) => { const k = claveDe(v, p); if (k != null && v.fd === 'producto') abrirDetalle(k); });
        v.chart.on('contextmenu', (p) => {
          const k = claveDe(v, p);
          if (k == null || v.ff !== 'ventas' || v.fd !== 'producto') return;
          p.event.event.preventDefault();
          abrirMenu(p.event.event.clientX, p.event.event.clientY, k);
        });
      }
      vistas.set(s0.id, v);
    });
    if (!lista.length) { const p0 = el('p', 'vacio', 'Esta página está vacía: agregá tu primer gráfico.'); p0.style.gridColumn = 'span 12'; cont.append(p0); }
    if (!esFija(pag)) {
      const fila = el('div', 'agregar-fila'), nuevo = el('button', 'agregar', '＋ Agregar gráfico');
      nuevo.onclick = agregarGrafico;
      fila.append(nuevo);
      if (quitados) { const r = el('button', 'agregar', 'Restaurar ' + quitados + (quitados === 1 ? ' gráfico quitado' : ' gráficos quitados')); r.onclick = () => enviar({ t: 'restaurar' }); fila.append(r); }
      cont.append(fila);
    }
  }

  function claveDe(v, p) {
    if (v.s.tipo === 'lineas') return v.datos[p.seriesIndex];
    const d = v.datos[p.dataIndex];
    return d ? d.k : null;
  }

  function actualizarVista(v) {
    const F = filtrosEf(estado);
    if (v.tipo === 'kpis') {
      [...v.caja.children].forEach((c, i) => {
        const { f, m } = v.kpis[i], M = MEDS[f][m];
        c.children[0].textContent = M.n;
        c.children[1].textContent = M.t === 'eur' ? fmt.eurM(M.f(filtrar(f, FILAS[f], F), FILAS[f])) : fmt[M.t](M.f(filtrar(f, FILAS[f], F), FILAS[f]));
      });
      return;
    }
    const s = efectiva(v.s);
    v.sp = s;
    v.t.style.gridColumn = 'span ' + s.span;
    if (v.chart) v.caja.style.height = (s.alto || 270) + 'px';
    v.t.classList.toggle('editada', !!estado.ed[v.s.id]);
    v.h.textContent = titulo(s);
    v.nota.textContent = s.nota || '';
    if (s.tipo === 'texto') {
      const ol = el('ol');
      s.items.forEach((x) => ol.append(el('li', '', x)));
      v.caja.replaceChildren(ol, el('p', 'nota', 'Los productos son bienes de consumo y no servicios aéreos: la consigna es un marco de caso.'));
    } else if (s.tipo === 'decisiones') pintarDecisiones(v, s);
    else if (s.tipo === 'slides') pintarSlides(v);
    else if (s.tipo === 'tabla') pintarTabla(v, s);
    else if (s.tipo === 'matriz') pintarMatriz(v, s);
    else {
      let opcion;
      if (s.tipo === 'cat') {
        v.ff = s.fuente; v.fd = s.dim;
        const A = FILAS[s.fuente];
        v.datos = agrupar(s.fuente, filtrar(s.fuente, A, F, s.dim), s.dim, s.med, s.orden, s.graf === 'mapa' ? 0 : s.top, A);
        opcion = v.datos.length ? opcionCat(s, v, F[s.fuente][s.dim]) : vacio();
        v.exportar = () => ({ cab: [DIMS[s.fuente][s.dim].n, MEDS[s.fuente][s.med].n], filas: v.datos.map((d) => [d.et, d.v]) });
        if (s.graf === 'mapa' && s.dim === 'pais') {
          const fuera = v.datos.filter((d) => !NOMBRES_MAPA.has(enMapa(d.k))).map((d) => d.et.trim());
          v.nota.textContent = 'Rueda para acercar, arrastrá para mover.' + (fuera.length ? ' Sin dibujar en el mapa por su tamaño (' + fuera.length + '): ' + fuera.join(', ') + '.' : '');
        }
        if (s.variacion && s.med === 'eneOct' && v.datos.length > 1) {
          const u = v.datos[v.datos.length - 1], p = v.datos[v.datos.length - 2];
          v.nota.textContent = 'Enero a octubre de ' + u.k + ' frente a ' + p.k + ': ' + fmt.pct(u.v / p.v - 1);
        }
      } else if (s.tipo === 'mensual') { v.ff = 'ventas'; v.fd = s.dim; opcion = opcionMensual(s, v, F.ventas[s.dim]); }
      else if (s.tipo === 'lineas') { v.ff = 'ventas'; v.fd = 'anio'; opcion = opcionLineas(s, v, F.ventas.anio); }
      else { v.ff = 'ventas'; v.fd = 'producto'; opcion = opcionDispersion(s, v, F.ventas.producto); }
      v.chart.setOption(opcion, true);
    }
  }

  /* ------------------------------------------------------------------ barra superior */
  function resumen() {
    const F = filtrosEf(estado), pag = clavePagina();
    if (pag === 'datos') return TITULOS.datos + ': de dónde salen las cifras y qué límites tienen.';
    if (pag === 'decisiones') return TITULOS.decisiones + ': cada decisión se apoya en una cifra del tablero (con todos los datos, sin filtros).';
    if (pag === 'presentacion') return TITULOS.presentacion + ': el recorrido de 12 diapositivas con cifras calculadas de los datos. Flechas del teclado para avanzar.';
    if (pag === 'tactico') {
      const P = filtrar('proveedores', FILAS.proveedores, F), M = MEDS.proveedores;
      return TITULOS.tactico + ' · ' + fmt.n0(P.length) + ' proveedores con ' + fmt.usd(M.saldo.f(P)) + ' de saldo pendiente; ' + fmt.pct(M.sin12Pct.f(P, FILAS.proveedores)) +
        ' del saldo no tuvo compras en los 12 meses previos a la última fecha del archivo.';
    }
    const R = filtrar('ventas', FILAS.ventas, F), cabeza = pag === 'detalle' ? 'Detalle de ' + estado.detalle : TITULOS[pag];
    if (!R.length) return cabeza + ' · No hay pedidos con esta combinación de filtros.';
    const fs = R.map((r) => r.fecha).sort(), M = MEDS.ventas;
    return cabeza + ' · ' + fecha(fs[0]) + ' a ' + fecha(fs[fs.length - 1]) + ': ' + fmt.eurM(M.ventas.f(R)) + ' en ' + fmt.n0(M.pedidos.f(R)) + ' pedidos, con un margen bruto de ' + fmt.pct(M.margenPct.f(R)) + '.';
  }

  function etiquetaFiltro(f, d, v) {
    const dim = DIMS[f][d], fila = FILAS[f].find((r) => String(dim.f(r)) === String(v));
    return dim.lab && fila ? dim.lab(dim.f(fila)) : String(v);
  }

  function barra() {
    const tabs = $('tabs');
    tabs.replaceChildren();
    window.ORDEN_TABS.forEach((p) => {
      const b = el('button', 'tab', window.PAGINAS[p].titulo);
      b.setAttribute('aria-selected', String(!estado.detalle && estado.pagina === p));
      b.onclick = () => enviar({ t: 'pagina', p });
      tabs.append(b);
    });
    if (estado.detalle) {
      const b = el('button', 'tab', 'Detalle: ' + estado.detalle), volver = el('button', 'tab', '← Volver');
      b.setAttribute('aria-selected', 'true');
      volver.onclick = () => enviar({ t: 'volver' });
      tabs.append(b, volver);
    }
    $('resumen').textContent = resumen();
    const datosPag = ['datos', 'decisiones', 'presentacion'].includes(clavePagina());
    $('filtros').hidden = datosPag;
    $('principal').parentElement.hidden = datosPag;
    $('granularidad').parentElement.hidden = datosPag;
    $('granularidad').value = estado.granularidad;
    SEGMENTADORES.forEach((d) => {
      const s = $('seg-' + d), v = estado.filtros.ventas[d];
      const fijo = d === 'producto' && estado.detalle;
      s.value = fijo ? estado.detalle : v == null ? '' : String(v);
      s.disabled = !!fijo;
      s.parentElement.classList.toggle('activo', v != null || !!fijo);
    });
    $('principal').value = estado.principal;
    const chips = $('chips');
    chips.replaceChildren();
    let n = 0;
    ['ventas', 'proveedores', 'clientes'].forEach((f) => Object.entries(estado.filtros[f]).forEach(([d, v]) => {
      n++;
      const c = el('span', 'chip', DIMS[f][d].n + ': ' + etiquetaFiltro(f, d, v) + (f === 'ventas' ? '' : ' (' + FUENTE[f] + ')')), x = el('button', '', '×');
      x.title = 'Quitar este filtro'; x.setAttribute('aria-label', 'Quitar filtro ' + DIMS[f][d].n);
      x.onclick = () => enviar({ t: 'filtro', f, d, v });
      c.append(x);
      chips.append(c);
    }));
    if (estado.detalle) chips.append(el('span', 'hint', 'Detalle abierto para «' + estado.detalle + '»'));
    else if (!n && !datosPag) chips.append(el('span', 'hint', 'Sin filtros: clic en una barra, un punto o una dona para filtrar el resto de los gráficos.'));
    $('b-deshacer').disabled = !historial.length;
    $('b-limpiar').disabled = !n;
    $('n-actividad').textContent = String(estado.log.length);
    const ol = el('ol');
    estado.log.slice(0, 15).forEach((x) => ol.append(el('li', '', x)));
    $('actividad').replaceChildren(el('h2', '', 'Actividad reciente'), estado.log.length ? ol : el('p', 'nota', 'Todavía no hiciste cambios.'));
  }

  function actualizar() {
    const pag = clavePagina(), lista = graficosDe(pag);
    const quitados = esFija(pag) ? 0 : window.PAGINAS[pag].graficos.filter((s) => estado.ocultos[s.id]).length;
    const firma = pag + '|' + lista.map((s) => s.id).join() + '|' + quitados;
    if (firma !== dibujada) { const previo = editando; armar(pag, lista, quitados); dibujada = firma; editando = vistas.has(previo) ? previo : null; }
    barra();
    vistas.forEach(actualizarVista);
    renderEditor();
  }

  /* ------------------------------------------------------------------ editor de gráficos, menú y detalle */
  function abrirEditor(id) { editando = id; renderEditor(); }
  function agregarGrafico() {
    const pag = clavePagina(), n = 1 + Math.max(0, ...Object.values(estado.extra).flat().map((s) => Number(s.id.slice(2)) || 0));
    const spec = { id: 'u_' + n, tipo: 'cat', fuente: 'ventas', dim: 'producto', med: '$', graf: 'columna', orden: 'desc', top: 10, span: 4, alto: 270, usuario: true };
    enviar({ t: 'agregar', pagina: pag, spec, nombre: window.PAGINAS[pag].titulo });
    abrirEditor(spec.id);
    const v = vistas.get(spec.id);
    if (v) v.t.scrollIntoView({ block: 'center' });
  }
  function abrirDetalle(producto) { cerrarMenu(); enviar({ t: 'detalle', v: producto }); window.scrollTo({ top: 0 }); }

  function campoSelect(rotulo, valor, opciones, alCambiar) {
    const l = el('label', '', rotulo), s = el('select');
    opciones.forEach(([v, t]) => { const o = new Option(t, String(v)); s.add(o); });
    s.value = String(valor);
    s.onchange = () => alCambiar(s.value);
    l.append(s);
    return l;
  }

  function renderEditor() {
    const ed = $('editor');
    if (!editando || !vistas.has(editando)) { ed.hidden = true; return; }
    const base = vistas.get(editando).s, s = efectiva(base), crudo = Object.assign({}, base, estado.ed[base.id] || {});
    const cambiar = (c, texto) => enviar({ t: 'editar', id: base.id, c, titulo: titulo(s), desc: texto });
    ed.replaceChildren(el('h2', '', 'Editar gráfico'), el('p', '', 'Los cambios se aplican al instante y los demás gráficos se recalculan.'));
    const lt = el('label', '', 'Título'), it = el('input');
    it.type = 'text'; it.value = estado.ed[base.id] && 'titulo' in estado.ed[base.id] ? estado.ed[base.id].titulo : (base.titulo || '');
    it.placeholder = base.tipo === 'cat' ? 'Automático: ' + titulo(Object.assign({}, s, { titulo: '' })) : '';
    it.onchange = () => cambiar({ titulo: it.value }, 'Título → «' + it.value + '»');
    lt.append(it);
    ed.append(lt);
    const meds = medidasDe(s.fuente), conPrincipal = s.fuente === 'ventas' ? [['$', 'Medida principal (enlazada)']].concat(meds) : meds;
    if (base.tipo === 'cat') {
      if (base.usuario) ed.append(campoSelect('Fuente de datos', s.fuente, [['ventas', 'Ventas (pedidos)'], ['proveedores', 'Proveedores'], ['clientes', 'Clientes']],
        (x) => cambiar({ fuente: x, dim: Object.keys(DIMS[x])[0], med: x === 'ventas' ? '$' : Object.keys(MEDS[x])[0], titulo: '' }, 'Fuente → ' + x)));
      ed.append(campoSelect('Medida', crudo.med, conPrincipal, (x) => cambiar({ med: x, titulo: '' }, 'Medida → ' + (x === '$' ? 'principal' : MEDS[s.fuente][x].n))));
      ed.append(campoSelect('Dimensión', crudo.dim, dimsDe(s.fuente), (x) => cambiar({ dim: x, titulo: '' }, 'Dimensión → ' + DIMS[s.fuente][x].n)));
      ed.append(campoSelect('Tipo de gráfico', crudo.graf, GRAF, (x) => cambiar({ graf: x }, 'Tipo → ' + x)));
      ed.append(campoSelect('Orden', crudo.orden, ORDENES, (x) => cambiar({ orden: x }, 'Orden → ' + x)));
      ed.append(campoSelect('Mostrar', crudo.top, TOPS, (x) => cambiar({ top: Number(x) }, 'Mostrar → ' + (x === '0' ? 'todos' : 'primeros ' + x))));
    } else if (base.tipo === 'mensual') {
      ed.append(campoSelect('Agrupar por', crudo.dim, TIEMPO_OPC, (x) => cambiar({ dim: x }, 'Agrupar por → ' + x)));
      ed.append(campoSelect('Tipo de gráfico', crudo.graf, [['columna', 'Columnas apiladas'], ['linea', 'Líneas']], (x) => cambiar({ graf: x }, 'Tipo → ' + x)));
    } else if (base.tipo === 'lineas' || base.tipo === 'matriz') {
      ed.append(campoSelect('Medida', crudo.med === '$' ? '$' : crudo.med, [['$', 'Medida principal (enlazada)']].concat(meds.slice(0, 8)), (x) => cambiar({ med: x }, 'Medida → ' + (x === '$' ? 'principal' : MEDS.ventas[x].n))));
    } else if (base.tipo === 'dispersion') {
      ed.append(campoSelect('Eje horizontal', crudo.medX, meds.slice(0, 8), (x) => cambiar({ medX: x }, 'Eje horizontal → ' + MEDS.ventas[x].n)));
      ed.append(campoSelect('Eje vertical', crudo.medY, meds.slice(0, 8), (x) => cambiar({ medY: x }, 'Eje vertical → ' + MEDS.ventas[x].n)));
    } else if (base.tipo === 'tabla') {
      ed.append(campoSelect('Filas a mostrar', crudo.top || 10, FILAS_TABLA, (x) => cambiar({ top: Number(x) }, 'Filas → ' + x)));
    }
    const conActual = (op, v) => (op.some(([x]) => Number(x) === Number(v)) ? op : op.concat([[v, String(v)]]));
    ed.append(campoSelect('Ancho', s.span, conActual(ANCHOS, s.span), (x) => cambiar({ span: Number(x) }, 'Ancho → ' + x + '/12')));
    if (base.tipo !== 'texto') ed.append(campoSelect('Alto', s.alto || 270, conActual(ALTOS, s.alto || 270), (x) => cambiar({ alto: Number(x) }, 'Alto → ' + x + ' px')));
    if (!esFija(clavePagina())) {
      const f2 = el('div', 'fila'), antes = el('button', '', '◀ Antes'), despues = el('button', '', 'Después ▶'), quitar = el('button', 'peligro', 'Quitar de la página');
      const ids = graficosDe(clavePagina()).map((x) => x.id), mover = (d) => enviar({ t: 'mover', pagina: clavePagina(), id: base.id, d, ids, titulo: titulo(s) });
      antes.onclick = () => mover(-1); despues.onclick = () => mover(1);
      quitar.onclick = () => { editando = null; enviar({ t: 'quitar', pagina: clavePagina(), id: base.id, titulo: titulo(s) }); };
      f2.append(antes, despues, quitar);
      ed.append(f2);
    }
    const vv = vistas.get(editando);
    if (vv.exportar) {
      const ex = el('button', '', 'Descargar datos (CSV)'), f3 = el('div', 'fila');
      ex.onclick = () => descargarCsv(vv.exportar(), titulo(s));
      f3.append(ex);
      ed.append(f3);
    }
    const fila = el('div', 'fila'), rest = el('button', '', 'Restablecer'), cerrar = el('button', '', 'Cerrar');
    rest.onclick = () => enviar({ t: 'restablecer', id: base.id, titulo: titulo(s) });
    cerrar.onclick = () => { editando = null; renderEditor(); };
    fila.append(rest, cerrar);
    ed.append(fila);
    ed.hidden = false;
  }

  function abrirMenu(x, y, producto) {
    const m = $('menu'), b1 = el('button', '', 'Obtención de detalles ▸ Detalle de producto'), b2 = el('button', '', 'Filtrar solo este producto');
    b1.onclick = () => abrirDetalle(producto);
    b2.onclick = () => { cerrarMenu(); enviar({ t: 'filtro', f: 'ventas', d: 'producto', v: producto }); };
    m.replaceChildren(el('div', 'tit', 'Producto: ' + producto), b1, b2);
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - 260)) + 'px';
    m.style.top = Math.max(8, Math.min(y, window.innerHeight - 120)) + 'px';
    m.hidden = false;
  }
  const cerrarMenu = () => { $('menu').hidden = true; };

  /* ------------------------------------------------------------------ modo claro / oscuro */
  function aplicarTema(t, persistir) {
    usarPaleta(t);
    document.documentElement.dataset.tema = t;
    if (persistir !== false) { try { localStorage.setItem(CLAVE_TEMA, t); } catch (e) { /* sin almacenamiento: no pasa nada */ } }
    const b = $('b-tema');
    b.textContent = t === 'oscuro' ? '☀ Modo claro' : '☾ Modo oscuro';
    b.setAttribute('aria-pressed', String(t === 'oscuro'));
    dibujada = null; /* los gráficos se vuelven a crear con el tema de ECharts */
    actualizar();
  }
  /* al imprimir se usa siempre el modo claro (el texto claro sobre papel blanco no se lee) */
  function imprimir() {
    if (tema !== 'oscuro') { window.print(); return; }
    aplicarTema('claro', false);
    window.addEventListener('afterprint', () => aplicarTema('oscuro', false), { once: true });
    setTimeout(() => window.print(), 700);
  }

  /* ------------------------------------------------------------------ arranque */
  function iniciar() {
    SEGMENTADORES.forEach((d) => {
      const l = el('label', 'campo', DIMS.ventas[d].n), s = el('select');
      s.id = 'seg-' + d;
      s.add(new Option('Todos', ''));
      agrupar('ventas', FILAS.ventas, d, 'ventas', 'natural', 0).forEach((g) => s.add(new Option(g.et, String(g.k))));
      s.onchange = () => enviar({ t: 'filtro', f: 'ventas', d, v: s.value === '' ? null : s.value });
      l.append(s);
      $('filtros').append(l);
    });
    PRINCIPALES.forEach((k) => $('principal').add(new Option(MEDS.ventas[k].n, k)));
    window.NU.GRANULARIDADES.forEach(([k, n]) => $('granularidad').add(new Option(n, k)));
    $('granularidad').onchange = () => enviar({ t: 'granularidad', v: $('granularidad').value });
    $('principal').onchange = () => enviar({ t: 'principal', v: $('principal').value });
    $('b-deshacer').onclick = () => enviar({ t: 'deshacer' });
    $('b-limpiar').onclick = () => enviar({ t: 'limpiar' });
    $('b-todo').onclick = () => enviar({ t: 'todo' });
    $('b-imprimir').onclick = imprimir;
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) salirDePantallaCompleta(); });
    $('b-tema').onclick = () => aplicarTema(tema === 'oscuro' ? 'claro' : 'oscuro');
    $('b-actividad').onclick = (e) => { e.stopPropagation(); $('actividad').hidden = !$('actividad').hidden; };
    document.addEventListener('click', (e) => { cerrarMenu(); if (!$('actividad').contains(e.target)) $('actividad').hidden = true; });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { salirDePantallaCompleta(); cerrarMenu(); $('actividad').hidden = true; editando = null; renderEditor(); }
      if (clavePagina() === 'presentacion' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') irDiapo(diapo + 1);
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') irDiapo(diapo - 1);
      }
    });
    aplicarTema(tema, false);
  }
  window.TABLERO = { enviar, estado: () => estado, vistas: () => vistas, tema: () => tema, aplicarTema };
  iniciar();
})();
