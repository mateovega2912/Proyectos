/* Núcleo del tablero: funciones puras (sin DOM). Se usa en el navegador (window.NU) y en las pruebas (Node). */
(function (g) {
  'use strict';
  const sum = (R, f) => R.reduce((s, r) => s + f(r), 0);
  const distinct = (R, f) => new Set(R.map(f)).size;
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  /* agrupar el tiempo: clave de la dimensión, nombre y campo con la posición dentro del año (para las líneas, una por año) */
  const GRANULARIDADES = [['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes'], ['trimestre', 'Trimestre'], ['semestre', 'Semestre'], ['anio', 'Año']];
  const PRIORIDAD = ['Crítica', 'Alta', 'Media', 'Baja'];
  const TRAMO_PROV = ['0 a 12 meses', '13 a 36 meses', 'Más de 36 meses'];
  const TRAMO_EDAD = ['26 a 30', '31 a 35', '36 a 40', '41 a 45', '46 a 50', '51 a 56'];

  /* ---- Dimensiones: n = nombre, f = valor de la fila, lab = etiqueta, orden = orden natural fijo */
  const D = (n, f, extra) => Object.assign({ n, f }, extra);
  const DIMS = {
    ventas: {
      producto: D('Producto', (r) => r.producto), zona: D('Zona', (r) => r.zona), pais: D('País', (r) => r.pais),
      canal: D('Canal', (r) => r.canal), prioridad: D('Prioridad', (r) => r.prioridad, { orden: PRIORIDAD }),
      anio: D('Año', (r) => r.anio),
      mes: D('Mes', (r) => r.mes, { lab: (k) => MESES[+k.slice(5, 7) - 1] + ' ' + k.slice(2, 4) }),
      dia: D('Día', (r) => r.fecha, { lab: (k) => k.slice(8, 10) + '/' + k.slice(5, 7) + '/' + k.slice(2, 4) }),
      semana: D('Semana', (r) => r.sem, { lab: (k) => 'Sem ' + Number(k.slice(6)) + ' ' + k.slice(0, 4) }),
      trimestre: D('Trimestre', (r) => r.trim, { lab: (k) => k.slice(5) + ' ' + k.slice(0, 4) }),
      semestre: D('Semestre', (r) => r.semestre, { lab: (k) => k.slice(5) + ' ' + k.slice(0, 4) }),
      plazo: D('Plazo de envío', (r) => r.tramoPlazo, { lab: (k) => k + ' a ' + (k + 4) + ' días' }),
      cliente: D('Cliente', (r) => r.cli),
    },
    proveedores: {
      tramo: D('Última compra', (r) => r.tramo, { orden: TRAMO_PROV }), anioUlt: D('Año de última compra', (r) => r.anioUlt),
      tramoSaldo: D('Tramo de saldo', (r) => r.tramoSaldo, { lab: (k) => '$ ' + k / 1000 + ' a ' + (k + 2000) / 1000 + ' mil' }),
    },
    clientes: {
      grupo: D('Grupo', (r) => r.grupo), pais: D('País', (r) => r.pais), estado: D('Estado', (r) => r.estado),
      alta: D('Año de alta', (r) => r.alta), tramoEdad: D('Tramo de edad', (r) => r.tramoEdad, { orden: TRAMO_EDAD }),
    },
  };

  /* ---- Medidas: t = tipo de formato, f(R, A) = valor sobre las filas R (A = todas las filas de la fuente) */
  const M = (n, t, f) => ({ n, t, f });
  const ventas = (R) => sum(R, (r) => r.venta);
  const costo = (R) => sum(R, (r) => r.costo);
  const pedidos = (R) => distinct(R, (r) => r.id);
  const recurrentes = (R) => {
    const c = new Map();
    R.forEach((r) => c.set(r.cli, (c.get(r.cli) || 0) + 1));
    return [...c.values()].filter((n) => n > 1).length;
  };
  const MEDS = {
    ventas: {
      ventas: M('Ventas', 'eur', ventas), costo: M('Costo', 'eur', costo), margen: M('Margen bruto', 'eur', (R) => ventas(R) - costo(R)),
      margenPct: M('Margen %', 'pct', (R) => (ventas(R) ? 1 - costo(R) / ventas(R) : 0)), pedidos: M('Pedidos', 'n0', pedidos),
      unidades: M('Unidades', 'n0', (R) => sum(R, (r) => r.unidades)), ticket: M('Ticket medio', 'eur2', (R) => (R.length ? ventas(R) / pedidos(R) : 0)),
      plazo: M('Plazo medio (días)', 'n1', (R) => (R.length ? sum(R, (r) => r.plazo) / R.length : 0)),
      eneOct: M('Ventas ene-oct', 'eur', (R) => ventas(R.filter((r) => r.mesN <= 10))),
      recurrentes: M('Clientes con más de 1 pedido', 'n0', recurrentes),
      recurrentesPct: M('% clientes recurrentes', 'pct', (R) => (R.length ? recurrentes(R) / distinct(R, (r) => r.cli) : 0)),
    },
    proveedores: {
      proveedores: M('Proveedores', 'n0', (R) => R.length), saldo: M('Saldo pendiente', 'usd', (R) => sum(R, (r) => r.saldo)),
      sin12: M('Proveedores sin compra 12m', 'n0', (R) => R.filter((r) => r.meses > 12).length),
      sin12Pct: M('% saldo sin compra 12m', 'pct', (R, A) => sum(R.filter((r) => r.meses > 12), (r) => r.saldo) / sum(A, (r) => r.saldo)),
    },
    clientes: { clientes: M('Clientes', 'n0', (R) => R.length) },
  };
  /* medidas que puede tomar la «medida principal» (la que enlaza a varios gráficos a la vez) */
  const PRINCIPALES = ['ventas', 'margen', 'pedidos', 'unidades'];

  /* ---- Filtrado y agrupación */
  const filtrar = (fuente, filas, filtros, excluir) => {
    const ex = [].concat(excluir || []);
    const fs = Object.entries(filtros[fuente] || {}).filter(([d]) => !ex.includes(d));
    return fs.length ? filas.filter((r) => fs.every(([d, v]) => String(DIMS[fuente][d].f(r)) === String(v))) : filas;
  };
  const comparador = (d) => (a, b) => {
    if (d.orden) return d.orden.indexOf(a.k) - d.orden.indexOf(b.k);
    return typeof a.k === 'number' ? a.k - b.k : String(a.k).localeCompare(String(b.k), 'es');
  };
  /* agrupar(...) -> [{k, et, v}] ; orden: 'natural' | 'desc' | 'asc' ; top: cantidad máxima (0 = todos) */
  function agrupar(fuente, filas, dim, med, orden, top, todas) {
    const d = DIMS[fuente][dim], m = MEDS[fuente][med], grupos = new Map();
    filas.forEach((r) => {
      const k = d.f(r);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(r);
    });
    const salida = [...grupos].map(([k, R]) => ({ k, et: d.lab ? d.lab(k) : String(k), v: m.f(R, todas || filas) }));
    salida.sort(orden === 'desc' ? (a, b) => b.v - a.v : orden === 'asc' ? (a, b) => a.v - b.v : comparador(d));
    return top ? salida.slice(0, top) : salida;
  }

  /* ---- Estado y acciones (reductor puro): la edición de un gráfico o un filtro cambia el estado y todo se recalcula */
  const estadoInicial = () => ({
    pagina: 'operativo', detalle: null, principal: 'ventas', ed: {}, log: [],
    granularidad: 'mes', extra: {}, ocultos: {}, orden: {}, /* gráficos agregados por página, gráficos quitados y orden elegido */
    filtros: { ventas: {}, proveedores: {}, clientes: {} },
  });
  const sinClave = (o, k) => Object.fromEntries(Object.entries(o).filter(([c]) => c !== k));
  const anotar = (e, txt) => Object.assign({}, e, { log: [txt].concat(e.log).slice(0, 40) });
  function reducir(e, a) {
    switch (a.t) {
      case 'filtro': {
        const f = e.filtros[a.f], quita = a.v == null || String(f[a.d]) === String(a.v);
        const nf = quita ? sinClave(f, a.d) : Object.assign({}, f, { [a.d]: a.v });
        const nombre = DIMS[a.f][a.d].n;
        return anotar(Object.assign({}, e, { filtros: Object.assign({}, e.filtros, { [a.f]: nf }) }),
          quita ? 'Se quitó el filtro ' + nombre : 'Filtro ' + nombre + ': ' + (DIMS[a.f][a.d].lab ? DIMS[a.f][a.d].lab(a.v) : a.v));
      }
      case 'limpiar':
        return anotar(Object.assign({}, e, { filtros: estadoInicial().filtros }), 'Se limpiaron todos los filtros');
      case 'pagina':
        return Object.assign({}, e, { pagina: a.p, detalle: null });
      case 'detalle':
        /* la obtención de detalles reemplaza el filtro de producto: el resto de los filtros se mantiene */
        return anotar(Object.assign({}, e, { detalle: a.v, filtros: Object.assign({}, e.filtros, { ventas: sinClave(e.filtros.ventas, 'producto') }) }),
          'Detalle de producto: ' + a.v);
      case 'volver':
        return Object.assign({}, e, { detalle: null });
      case 'granularidad':
        return anotar(Object.assign({}, e, { granularidad: a.v }), 'Agrupar tiempo por: ' + GRANULARIDADES.find(([k]) => k === a.v)[1].toLowerCase());
      case 'principal':
        return anotar(Object.assign({}, e, { principal: a.v }), 'Medida principal: ' + MEDS.ventas[a.v].n);
      case 'editar':
        return anotar(Object.assign({}, e, { ed: Object.assign({}, e.ed, { [a.id]: Object.assign({}, e.ed[a.id], a.c) }) }),
          'Gráfico «' + (a.titulo || a.id) + '»: ' + (a.desc || Object.keys(a.c).join(', ')));
      case 'restablecer':
        return anotar(Object.assign({}, e, { ed: sinClave(e.ed, a.id) }), 'Gráfico «' + (a.titulo || a.id) + '» vuelto a su estado original');
      case 'agregar': /* spec = gráfico nuevo (id 'u_N') en la página a.pagina */
        return anotar(Object.assign({}, e, { extra: Object.assign({}, e.extra, { [a.pagina]: (e.extra[a.pagina] || []).concat([a.spec]) }) }),
          'Se agregó un gráfico en «' + a.nombre + '»');
      case 'quitar': { /* los propios se borran; los de la página se ocultan y se pueden restaurar */
        const propio = (e.extra[a.pagina] || []).some((s) => s.id === a.id);
        const base = propio
          ? Object.assign({}, e, { extra: Object.assign({}, e.extra, { [a.pagina]: e.extra[a.pagina].filter((s) => s.id !== a.id) }), ed: sinClave(e.ed, a.id) })
          : Object.assign({}, e, { ocultos: Object.assign({}, e.ocultos, { [a.id]: true }) });
        return anotar(base, 'Se quitó el gráfico «' + (a.titulo || a.id) + '»');
      }
      case 'restaurar':
        return anotar(Object.assign({}, e, { ocultos: {} }), 'Se restauraron los gráficos quitados');
      case 'mover': { /* a.ids = orden actual de la página; a.d = -1 (antes) o 1 (después) */
        const i = a.ids.indexOf(a.id), j = i + a.d;
        if (i < 0 || j < 0 || j >= a.ids.length) return e;
        const ids = a.ids.slice();
        ids[i] = ids[j]; ids[j] = a.id;
        return anotar(Object.assign({}, e, { orden: Object.assign({}, e.orden, { [a.pagina]: ids }) }), 'Se movió el gráfico «' + (a.titulo || a.id) + '»');
      }
      case 'todo':
        return anotar(estadoInicial(), 'Se restableció todo el tablero');
      default:
        return e;
    }
  }

  /* filtros efectivos: los del usuario más, si hay detalle abierto, el producto elegido */
  const filtrosEf = (e) => (e.detalle ? Object.assign({}, e.filtros, { ventas: Object.assign({}, e.filtros.ventas, { producto: e.detalle }) }) : e.filtros);

  /* ---- ZIP sin compresión (método «stored»): baja varios CSV juntos sin librerías */
  const TABLA_CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  /* archivos: [{ nombre, datos: Uint8Array }] -> Uint8Array con el .zip */
  function zip(archivos, ahora) {
    const enc = new TextEncoder(), d = ahora || new Date();
    const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const partes = [], central = [];
    let pos = 0;
    archivos.forEach((a) => {
      const nombre = enc.encode(a.nombre), crc = crc32(a.datos), n = a.datos.length, cab = new DataView(new ArrayBuffer(30)), ent = new DataView(new ArrayBuffer(46));
      cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true); cab.setUint16(10, hora, true); cab.setUint16(12, dia, true);
      cab.setUint32(14, crc, true); cab.setUint32(18, n, true); cab.setUint32(22, n, true); cab.setUint16(26, nombre.length, true);
      partes.push(new Uint8Array(cab.buffer), nombre, a.datos);
      ent.setUint32(0, 0x02014b50, true); ent.setUint16(4, 20, true); ent.setUint16(6, 20, true); ent.setUint16(8, 0x0800, true); ent.setUint16(12, hora, true); ent.setUint16(14, dia, true);
      ent.setUint32(16, crc, true); ent.setUint32(20, n, true); ent.setUint32(24, n, true); ent.setUint16(28, nombre.length, true); ent.setUint32(42, pos, true);
      central.push(new Uint8Array(ent.buffer), nombre);
      pos += 30 + nombre.length + n;
    });
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, central.reduce((s, x) => s + x.length, 0), true); fin.setUint32(16, pos, true);
    const todo = partes.concat(central, [new Uint8Array(fin.buffer)]), salida = new Uint8Array(todo.reduce((s, x) => s + x.length, 0));
    let o = 0;
    todo.forEach((x) => { salida.set(x, o); o += x.length; });
    return salida;
  }
  /* CSV con BOM (para que Excel lea bien las tildes) */
  const csvTexto = (cab, filas) => '\ufeff' + [cab].concat(filas).map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');

  /* ---- Formatos es-AR */
  const nf = (dec) => new Intl.NumberFormat('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: 'always' });
  const f0 = nf(0), f1 = nf(1), f2 = nf(2);
  const fmt = {
    n0: (v) => f0.format(v), n1: (v) => f1.format(v), n2: (v) => f2.format(v), pct: (v) => f1.format(v * 100) + ' %',
    eur: (v) => '€ ' + f0.format(v), eurM: (v) => '€ ' + f1.format(v / 1e6) + ' M', eur2: (v) => '€ ' + f2.format(v / 1e6) + ' M', usd: (v) => '$ ' + f0.format(v),
  };
  /* formato corto para tarjetas y etiquetas: los euros en millones */
  const corto = (t, v) => (t === 'eur' ? fmt.eurM(v) : fmt[t](v));

  g.NU = { GRANULARIDADES, zip, csvTexto, DIMS, MEDS, PRINCIPALES, filtrar, agrupar, estadoInicial, reducir, filtrosEf, fmt, corto, sum, distinct };
  if (typeof module !== 'undefined') module.exports = g.NU;
})(typeof window !== 'undefined' ? window : globalThis);
