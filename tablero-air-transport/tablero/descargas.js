/* Descarga de CSV en un ZIP: un botón en la barra de acciones con tres opciones (gráficos de la página, datos con los filtros actuales, todo junto).
   Las funciones que arman los archivos son puras (sin DOM) y se prueban en Node (tests/test_descargas.py); el DOM solo se toca al cargar en el navegador. */
(function (g) {
  'use strict';
  /* columnas de cada fuente: [encabezado del CSV, campo de la fila] */
  const COLUMNAS = {
    ventas: [['id_pedido', 'id'], ['id_cliente', 'cli'], ['zona', 'zona'], ['pais', 'pais'], ['producto', 'producto'], ['canal', 'canal'], ['prioridad', 'prioridad'],
      ['fecha_pedido', 'fecha'], ['anio', 'anio'], ['mes', 'mes'], ['unidades', 'unidades'], ['venta_total', 'venta'], ['coste_total', 'costo'], ['plazo_envio_dias', 'plazo']],
    proveedores: [['id', 'id'], ['proveedor', 'nombre'], ['saldo_pendiente', 'saldo'], ['fecha_ultima_compra', 'fecha'], ['meses_sin_compra', 'meses'], ['tramo_proveedor', 'tramo']],
    clientes: [['id', 'id'], ['grupo', 'grupo'], ['pais', 'pais'], ['estado', 'estado'], ['edad', 'edad'], ['anio_alta', 'alta'], ['tramo_edad', 'tramoEdad']],
  };

  const dos = (n) => String(n).padStart(2, '0');
  const fechaIso = (d) => d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  const bytes = (txt) => new TextEncoder().encode(txt);
  const paginaDe = (estado) => (estado.detalle ? 'detalle' : estado.pagina);

  /* texto visible -> nombre de archivo: minúsculas, letras y números separados por «-», sin caracteres raros */
  const nombreArchivo = (txt, vacio) => String(txt == null ? '' : txt).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+/, '').slice(0, 80).replace(/-+$/, '') || vacio;
  /* si el nombre ya se usó, le agrega -2, -3... */
  const unico = (base, usados) => {
    let n = base, i = 1;
    while (usados.has(n)) n = base + '-' + (++i);
    usados.add(n);
    return n;
  };
  /* celdas vacías si falta el dato; los decimales se redondean a 12 cifras significativas (saca el ruido de las sumas, como 99463970.25999999) */
  const celda = (c) => (c == null ? '' : typeof c === 'number' && !Number.isInteger(c) ? Number(c.toPrecision(12)) : c);
  const csv = (nombre, detalle, cab, filas) => ({ nombre, detalle, datos: bytes(g.NU.csvTexto(cab, filas.map((f) => f.map(celda)))) });

  /* ---- Gráficos de la página: un CSV por cada vista con exportar() y las tarjetas (indicadores) si hay */
  const hijo = (c, tag, i) => (c.querySelector ? c.querySelector(tag) : c.children[i]);
  const tarjetas = (vistas) => {
    const k = vistas.get('kpis');
    if (!k || !k.caja) return null;
    const filas = [...k.caja.children].map((c) => [hijo(c, 'small', 0), hijo(c, 'b', 1)].map((x) => (x ? x.textContent : ''))).filter((f) => f[0] || f[1]);
    return filas.length ? filas : null;
  };
  const exportables = (vistas) => [...vistas.values()].filter((v) => typeof v.exportar === 'function');
  const contarGraficos = (vistas) => exportables(vistas).length + (tarjetas(vistas) ? 1 : 0);

  function archivosGraficos(vistas) {
    const usados = new Set(), salida = [], t = tarjetas(vistas);
    if (t) {
      usados.add('tarjetas');
      salida.push(csv('graficos/tarjetas.csv', 'Tarjetas de la página (indicadores)', ['Tarjeta', 'Valor'], t));
    }
    exportables(vistas).forEach((v) => {
      const titulo = v.h && v.h.textContent ? v.h.textContent.trim() : '', { cab, filas } = v.exportar();
      salida.push(csv('graficos/' + unico(nombreArchivo(titulo || (v.s && v.s.id), 'grafico'), usados) + '.csv', titulo || 'Gráfico sin título', cab, filas));
    });
    return salida;
  }

  /* ---- Datos con los filtros actuales: las filas de ventas, proveedores y clientes que quedan con filtrosEf(estado) */
  function datosFiltrados(estado) {
    const { NU, DATOS } = g, F = NU.filtrosEf(estado);
    return Object.keys(COLUMNAS).map((f) => ({ f, filas: NU.filtrar(f, DATOS[f], F), total: DATOS[f].length }));
  }
  const contarDatos = (estado) => Object.fromEntries(datosFiltrados(estado).map((d) => [d.f, { filas: d.filas.length, total: d.total }]));

  function archivosDatos(estado) {
    const n0 = g.NU.fmt.n0;
    return datosFiltrados(estado).map((d) => csv('datos/' + d.f + '.csv', n0(d.filas.length) + ' de ' + n0(d.total) + ' filas',
      COLUMNAS[d.f].map((c) => c[0]), d.filas.map((r) => COLUMNAS[d.f].map((c) => r[c[1]]))));
  }

  /* ---- filtros-aplicados.txt: qué filtros estaban activos al bajar los archivos */
  function filtrosActivos(estado) {
    const { NU, DATOS } = g, F = NU.filtrosEf(estado), salida = [];
    Object.keys(COLUMNAS).forEach((f) => Object.entries(F[f] || {}).forEach(([d, v]) => {
      const dim = NU.DIMS[f][d], fila = DATOS[f].find((r) => String(dim.f(r)) === String(v));
      salida.push(dim.n + ': ' + (dim.lab && fila ? dim.lab(dim.f(fila)) : String(v)) + (f === 'ventas' ? '' : ' (' + f + ')'));
    }));
    return salida;
  }

  function filtrosAplicados(estado, graficos, datos, ahora) {
    const { NU } = g, d = ahora || new Date(), clave = paginaDe(estado), P = g.PAGINAS && g.PAGINAS[clave], activos = filtrosActivos(estado);
    const principal = NU.MEDS.ventas[estado.principal], gran = NU.GRANULARIDADES.find((x) => x[0] === estado.granularidad);
    const L = ['TABLERO AIR TRANSPORT · Filtros aplicados a esta descarga', '',
      'Fecha de descarga: ' + fechaIso(d),
      'Página: ' + (P ? P.titulo : clave) + (estado.detalle ? ': ' + estado.detalle : ''),
      'Medida principal: ' + (principal ? principal.n : estado.principal) + ' (la usan los gráficos enlazados a ella)'];
    if (estado.granularidad) L.push('Agrupación del tiempo: ' + (gran ? gran[1] : estado.granularidad));
    L.push('', activos.length ? 'Filtros activos:' : 'Filtros activos: ninguno (datos completos)');
    activos.forEach((x) => L.push('  - ' + x));
    L.push('', 'Archivos incluidos en el .zip:');
    graficos.concat(datos).forEach((a) => L.push('  ' + a.nombre + ' · ' + a.detalle));
    const notas = [];
    if (graficos.length) notas.push('Cada gráfico aplica los filtros activos menos el de su propia dimensión (así el gráfico que filtra sigue mostrando todas sus categorías).');
    if (datos.length) {
      notas.push('Cada filtro afecta solo a su fuente (ventas, proveedores o clientes): no hay relación entre las tablas.');
      notas.push('Ventas y costos en euros (€); saldos de proveedores en dólares ($), sin conversión.');
    }
    if (notas.length) L.push('', 'Notas:', ...notas.map((x) => '  - ' + x));
    return { nombre: 'filtros-aplicados.txt', datos: bytes('﻿' + L.join('\r\n') + '\r\n') };
  }

  /* ---- El .zip: modo = 'graficos' | 'datos' | 'todo'. Devuelve { nombre, archivos, bytes } */
  const nombreZip = (estado, ahora) => 'tablero-air-transport-' + nombreArchivo(paginaDe(estado), 'tablero') + '-' + fechaIso(ahora || new Date()) + '.zip';
  function construir(modo, estado, vistas, ahora) {
    const d = ahora || new Date(), gr = modo === 'datos' ? [] : archivosGraficos(vistas), da = modo === 'graficos' ? [] : archivosDatos(estado);
    const archivos = [filtrosAplicados(estado, gr, da, d)].concat(gr, da);
    return { nombre: nombreZip(estado, d), archivos, bytes: g.NU.zip(archivos, d) };
  }

  g.DESCARGAS = { COLUMNAS, nombreArchivo, archivosGraficos, archivosDatos, contarGraficos, contarDatos, filtrosActivos, filtrosAplicados, nombreZip, construir };
  if (typeof module !== 'undefined') module.exports = g.DESCARGAS;

  /* ------------------------------------------------------------------ interfaz (solo en el navegador) */
  const CSS = `
#b-descargar[aria-expanded="true"] { border-color: var(--azul); color: var(--azul); }
.menu-descargas { max-width: min(360px, calc(100vw - 16px)); }
.menu-descargas[hidden] { display: none; }
.menu-descargas button { white-space: normal; }
.menu-descargas button small { display: block; margin-top: 1px; font-size: 11.5px; color: var(--suave); }
.menu-descargas button:focus-visible { background: var(--resalte, #EAF2FB); color: var(--azul); outline-offset: -2px; }
.menu-descargas button:disabled { opacity: .55; cursor: default; }
.menu-descargas button:disabled:hover { background: var(--blanco); color: var(--tinta); }
.descargas-aviso { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 70; max-width: calc(100vw - 32px); padding: 9px 16px;
  background: var(--tinta); color: var(--blanco); border: 1px solid var(--borde); border-radius: 10px; font-size: 13px; box-shadow: 0 8px 28px rgba(11, 46, 79, .25); }
.descargas-aviso[hidden] { display: none; }
.descargas-lector { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media print { .menu-descargas, .descargas-aviso, .descargas-lector { display: none !important; } }
`;

  function iniciar() {
    const barra = document.querySelector('.acciones');
    if (!barra || document.getElementById('b-descargar')) return;
    const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
    const css = el('style');
    css.id = 'descargas-css';
    css.textContent = CSS;
    document.head.append(css);

    const boton = el('button', '', 'Descargar CSV '), flecha = el('span', '', '▾'), imprimir = document.getElementById('b-imprimir');
    boton.id = 'b-descargar'; boton.type = 'button'; boton.title = 'Baja los datos en archivos CSV, juntos en un solo .zip';
    boton.setAttribute('aria-haspopup', 'menu'); boton.setAttribute('aria-expanded', 'false'); boton.setAttribute('aria-controls', 'menu-descargas');
    flecha.setAttribute('aria-hidden', 'true');
    boton.append(flecha);
    barra.insertBefore(boton, imprimir && imprimir.parentNode === barra ? imprimir : null);

    const menu = el('div', 'menu menu-descargas'), aviso = el('div', 'descargas-aviso'), lector = el('div', 'descargas-lector');
    menu.id = 'menu-descargas'; menu.hidden = true; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Descargar CSV');
    aviso.hidden = true; aviso.setAttribute('aria-hidden', 'true');
    lector.setAttribute('role', 'status');
    document.body.append(menu, aviso, lector);

    let reloj = 0;
    const avisar = (texto) => {
      lector.textContent = texto; aviso.textContent = texto; aviso.hidden = false;
      clearTimeout(reloj);
      reloj = setTimeout(() => { aviso.hidden = true; }, 5000);
    };
    const items = () => [...menu.querySelectorAll('button:not(:disabled)')];
    const enfocar = (b) => { if (b) b.focus({ preventScroll: true }); };
    function cerrar(devolverFoco) {
      if (menu.hidden) return;
      menu.hidden = true;
      boton.setAttribute('aria-expanded', 'false');
      if (devolverFoco) enfocar(boton);
    }

    function bajar(modo) {
      try {
        const T = g.TABLERO, r = construir(modo, T.estado(), T.vistas()), a = el('a');
        a.href = URL.createObjectURL(new Blob([r.bytes], { type: 'application/zip' }));
        a.download = r.nombre;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        avisar('Descargando ' + r.nombre + ' (' + r.archivos.length + ' archivos).');
      } catch (e) {
        console.error(e);
        avisar('No se pudo armar el .zip: ' + e.message);
      }
    }
    function opcion(texto, detalle, modo, habilitada) {
      const b = el('button', '', texto);
      b.type = 'button'; b.disabled = !habilitada; b.setAttribute('role', 'menuitem');
      if (detalle) b.append(el('small', '', detalle));
      b.onclick = () => { cerrar(true); bajar(modo); };
      return b;
    }

    function abrir(alFinal) {
      const T = g.TABLERO, n = contarGraficos(T.vistas()), c = contarDatos(T.estado()), n0 = g.NU.fmt.n0;
      ['actividad', 'menu'].forEach((id) => { const x = document.getElementById(id); if (x) x.hidden = true; }); /* el clic del botón no llega a app.js, que los cierra */
      menu.replaceChildren(el('div', 'tit', 'Se baja un solo .zip con los CSV'),
        opcion('Gráficos de esta página (' + n + ' CSV)', n ? '' : 'Esta página no tiene gráficos ni tablas para exportar.', 'graficos', n > 0),
        opcion('Datos con los filtros actuales (ventas, proveedores y clientes)',
          n0(c.ventas.filas) + ' filas de ventas · ' + n0(c.proveedores.filas) + ' proveedores · ' + n0(c.clientes.filas) + ' clientes', 'datos', true),
        opcion('Todo junto', 'Los gráficos y los datos, en las carpetas graficos/ y datos/', 'todo', true));
      menu.hidden = false;
      const r = boton.getBoundingClientRect(), alto = menu.offsetHeight, arriba = r.bottom + 6 + alto > window.innerHeight - 8 && r.top - 6 - alto >= 8; /* sin lugar abajo, se abre hacia arriba */
      menu.style.top = Math.round(arriba ? r.top - 6 - alto : r.bottom + 6) + 'px';
      menu.style.left = Math.max(8, Math.min(Math.round(r.left), window.innerWidth - menu.offsetWidth - 8)) + 'px';
      boton.setAttribute('aria-expanded', 'true');
      const it = items();
      enfocar(alFinal ? it[it.length - 1] : it[0]);
    }

    boton.addEventListener('click', (ev) => {
      ev.stopPropagation(); /* app.js cierra sus menús con cualquier clic del documento */
      try { if (menu.hidden) abrir(false); else cerrar(false); } catch (e) { console.error(e); avisar('No se pudo abrir el menú: ' + e.message); }
    });
    boton.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
      ev.preventDefault();
      if (menu.hidden) abrir(ev.key === 'ArrowUp');
    });
    menu.addEventListener('keydown', (ev) => {
      const it = items(), i = it.indexOf(document.activeElement);
      if (ev.key === 'Tab') { cerrar(true); return; } /* el foco vuelve al botón y el navegador sigue desde ahí */
      if (ev.key === 'ArrowDown') enfocar(it[(i + 1) % it.length]);
      else if (ev.key === 'ArrowUp') enfocar(it[(i - 1 + it.length) % it.length]);
      else if (ev.key === 'Home') enfocar(it[0]);
      else if (ev.key === 'End') enfocar(it[it.length - 1]);
      else return;
      ev.preventDefault();
    });
    /* en captura: así también cierra cuando otro botón (como Actividad) frena el clic, y Escape no cierra además el editor de app.js */
    document.addEventListener('click', (ev) => { if (!menu.hidden && !boton.contains(ev.target) && !menu.contains(ev.target)) cerrar(false); }, true);
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !menu.hidden) { ev.stopPropagation(); cerrar(true); } }, true);
    window.addEventListener('resize', () => cerrar(false));
    window.addEventListener('scroll', () => cerrar(false), { passive: true });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
