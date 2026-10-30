/* Pruebas del núcleo en Node: imprime las cifras (las compara tests/test_tablero.py con entrega/cifras.py) y verifica el enlace entre gráficos. */
const assert = require('node:assert/strict');
globalThis.window = globalThis;
require('./datos.js');
const NU = require('./nucleo.js');
const { ventas: V, proveedores: P, clientes: C } = globalThis.DATOS;
const { MEDS, agrupar, filtrar, reducir, estadoInicial, filtrosEf } = NU;
const fs = require('node:fs'), os = require('node:os'), ruta = require('node:path');
const zipRuta = ruta.join(os.tmpdir(), 'at_prueba.zip');
const bytes = (s) => new TextEncoder().encode(s);
fs.writeFileSync(zipRuta, NU.zip([{ nombre: 'ventas.csv', datos: bytes(NU.csvTexto(['a', 'b'], [[1, 'dice "hola"'], [2, 'ñandú']])) }, { nombre: 'carpeta/niños.csv', datos: bytes('x') }]));

const mv = (k, R = V) => MEDS.ventas[k].f(R, V);
const porProducto = Object.fromEntries(agrupar('ventas', V, 'producto', 'ventas', 'natural', 0).map((d) => [d.k, d.v]));
const margenProd = Object.fromEntries(Object.keys(porProducto).map((p) => [p, mv('margenPct', V.filter((r) => r.producto === p))]));
const porZona = Object.fromEntries(agrupar('ventas', V, 'zona', 'ventas', 'natural', 0).map((d) => [d.k, d.v]));
const porAnio = Object.fromEntries(agrupar('ventas', V, 'anio', 'ventas', 'natural', 0).map((d) => [d.k, d.v]));
const eneOct = Object.fromEntries(agrupar('ventas', V, 'anio', 'eneOct', 'natural', 0).map((d) => [d.k, d.v]));
const plazoPri = Object.fromEntries(agrupar('ventas', V, 'prioridad', 'plazo', 'natural', 0).map((d) => [d.k, d.v]));
const tramos = Object.fromEntries(agrupar('proveedores', P, 'tramo', 'proveedores', 'natural', 0).map((d) => [d.k, d.v]));
const saldoTramos = Object.fromEntries(agrupar('proveedores', P, 'tramo', 'saldo', 'natural', 0).map((d) => [d.k, d.v]));
console.log(JSON.stringify({
  ventas: mv('ventas'), costo: mv('costo'), margenPct: mv('margenPct'), pedidos: mv('pedidos'), unidades: mv('unidades'), ticket: mv('ticket'), plazo: mv('plazo'),
  recurrentes: mv('recurrentes'), recurrentesPct: mv('recurrentesPct'), porProducto, margenProd, porZona, porAnio, eneOct, plazoPri,
  proveedores: MEDS.proveedores.proveedores.f(P), saldo: MEDS.proveedores.saldo.f(P), sin12: MEDS.proveedores.sin12.f(P), sin12Pct: MEDS.proveedores.sin12Pct.f(P, P),
  tramos, saldoTramos, clientes: MEDS.clientes.clientes.f(C), zipRuta,
  gruposClientes: Object.fromEntries(agrupar('clientes', C, 'grupo', 'clientes', 'natural', 0).map((d) => [d.k, d.v])),
}));

/* --- enlace entre gráficos: el filtro de uno cambia lo que muestran los demás --- */
let e = estadoInicial();
const base = agrupar('ventas', filtrar('ventas', V, e.filtros), 'producto', 'ventas', 'desc', 0);
e = reducir(e, { t: 'filtro', f: 'ventas', d: 'zona', v: 'África' });
const africa = agrupar('ventas', filtrar('ventas', V, e.filtros), 'producto', 'ventas', 'desc', 0);
assert.notDeepEqual(base.map((d) => d.v), africa.map((d) => d.v), 'filtrar por zona tiene que cambiar el gráfico de productos');
assert.ok(Math.abs(africa.reduce((s, d) => s + d.v, 0) / mv('ventas') - 0.387) < 0.001, 'África = 38,7 % de las ventas');
assert.equal(filtrar('ventas', V, e.filtros, 'zona').length, V.length, 'el gráfico que filtra no se filtra a sí mismo');
assert.equal(reducir(e, { t: 'filtro', f: 'ventas', d: 'zona', v: 'África' }).filtros.ventas.zona, undefined, 'el segundo clic quita el filtro');

/* los filtros de ventas no tocan proveedores ni clientes (no hay relación entre las tablas) */
assert.equal(filtrar('proveedores', P, e.filtros).length, P.length);
assert.equal(filtrar('clientes', C, e.filtros).length, C.length);

/* la medida principal mueve a todos los gráficos que la usan; la bitácora anota cada cambio */
const e2 = reducir(e, { t: 'principal', v: 'pedidos' });
assert.equal(e2.principal, 'pedidos');
assert.equal(e2.log.length, 2);
assert.match(e2.log[0], /Pedidos/);

/* editar un gráfico y restablecerlo */
const e3 = reducir(e2, { t: 'editar', id: 'op_canal', c: { graf: 'barra' }, desc: 'Tipo → barra' });
assert.equal(e3.ed.op_canal.graf, 'barra');
assert.equal(reducir(e3, { t: 'restablecer', id: 'op_canal' }).ed.op_canal, undefined);

/* obtención de detalles: el producto elegido filtra la página sin tocar los filtros del usuario */
const previo = reducir(estadoInicial(), { t: 'filtro', f: 'ventas', d: 'producto', v: 'Snacks' });
const d = reducir(reducir(previo, { t: 'filtro', f: 'ventas', d: 'canal', v: 'Online' }), { t: 'detalle', v: 'Ropa' });
const detalle = filtrar('ventas', V, filtrosEf(d));
assert.ok(detalle.length > 0 && detalle.every((r) => r.producto === 'Ropa'));
assert.deepEqual(d.filtros.ventas, { canal: 'Online' }, 'el detalle reemplaza el filtro de producto y conserva los demás');
assert.equal(reducir(d, { t: 'volver' }).detalle, null);
/* páginas propias: agregar, mover, quitar y restaurar gráficos */
let m = reducir(estadoInicial(), { t: 'agregar', pagina: 'mia', spec: { id: 'u_1', tipo: 'cat', usuario: true }, nombre: 'Mi página' });
m = reducir(m, { t: 'agregar', pagina: 'mia', spec: { id: 'u_2', tipo: 'cat', usuario: true }, nombre: 'Mi página' });
assert.deepEqual(m.extra.mia.map((s) => s.id), ['u_1', 'u_2']);
m = reducir(m, { t: 'mover', pagina: 'mia', id: 'u_2', d: -1, ids: ['u_1', 'u_2'] });
assert.deepEqual(m.orden.mia, ['u_2', 'u_1']);
assert.equal(reducir(m, { t: 'mover', pagina: 'mia', id: 'u_2', d: -1, ids: m.orden.mia }), m, 'no se puede mover más allá del borde');
m = reducir(m, { t: 'editar', id: 'u_1', c: { dim: 'zona' }, desc: 'Dimensión → Zona' });
m = reducir(m, { t: 'quitar', pagina: 'mia', id: 'u_1', titulo: 'x' });
assert.deepEqual(m.extra.mia.map((s) => s.id), ['u_2']);
assert.equal(m.ed.u_1, undefined, 'al quitar un gráfico propio se borra también su edición');
const q = reducir(estadoInicial(), { t: 'quitar', pagina: 'operativo', id: 'op_canal', titulo: 'canal' });
assert.equal(q.ocultos.op_canal, true);
assert.deepEqual(reducir(q, { t: 'restaurar' }).ocultos, {});
assert.deepEqual(reducir(q, { t: 'todo' }).ocultos, {}, 'restablecer todo vuelve al tablero original');

/* la presentación calcula sus cifras desde los datos (no hay números escritos a mano) */
require('./presentacion.js');
const diapos = globalThis.PRESENTACION.diapositivas(globalThis.PRESENTACION.cifras());
assert.equal(diapos.length, 12);
const texto = JSON.stringify(diapos);
['1.289,1', '13,6', '4.265.977', '3.003.639', '14,3', '38,7', '301', '716', '901', '40,9', '184'].forEach((c) => assert.ok(texto.includes(c), 'falta la cifra ' + c));
const dec = globalThis.PRESENTACION.decisiones(globalThis.PRESENTACION.cifras());
['operativo', 'tactico', 'estrategico'].forEach((n) => assert.ok(dec[n].length >= 1 && dec[n].every((d) => /\d/.test(d.cifra)), 'cada decisión cita una cifra: ' + n));
/* agrupar el tiempo: cada agrupación reparte todas las ventas sin perder ni repetir ninguna */
const total = mv('ventas');
const cuantos = { dia: new Set(V.map((r) => r.fecha)).size, semana: new Set(V.map((r) => r.sem)).size, mes: 35, trimestre: 12, semestre: 6, anio: 3 };
NU.GRANULARIDADES.forEach(([k]) => {
  const g = agrupar('ventas', V, k, 'ventas', 'natural', 0);
  assert.equal(g.length, cuantos[k], 'cantidad de grupos por ' + k);
  assert.ok(Math.abs(g.reduce((s, d) => s + d.v, 0) - total) < 1, 'la suma por ' + k + ' da el total');
  assert.deepEqual(g.map((d) => d.k), g.map((d) => d.k).slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), 'orden cronológico por ' + k);
});
assert.equal(NU.DIMS.ventas.trimestre.lab('2021-T3'), 'T3 2021');
assert.equal(NU.DIMS.ventas.semana.lab('2021-W05'), 'Sem 5 2021');
assert.equal(NU.DIMS.ventas.dia.lab('2021-03-07'), '07/03/21');
assert.equal(estadoInicial().granularidad, 'mes');
const gr = reducir(estadoInicial(), { t: 'granularidad', v: 'trimestre' });
assert.equal(gr.granularidad, 'trimestre');
assert.match(gr.log[0], /trimestre/);
/* filtrar por un trimestre deja solo los pedidos de esos tres meses */
const trim1 = filtrar('ventas', V, reducir(estadoInicial(), { t: 'filtro', f: 'ventas', d: 'trimestre', v: '2021-T1' }).filtros);
assert.ok(trim1.length > 0 && trim1.every((r) => r.anio === 2021 && r.mesN <= 3));
console.error('pruebas del núcleo: ok');
