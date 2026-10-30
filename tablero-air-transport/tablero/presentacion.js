/* Presentación y decisiones por nivel: todo el texto se arma con cifras calculadas de los datos (nada escrito a mano). */
(function (g) {
  'use strict';
  const { MEDS, agrupar, fmt } = g.NU, D = g.DATOS, V = D.ventas, P = D.proveedores, C = D.clientes;
  const mv = (k, R) => MEDS.ventas[k].f(R || V, V);
  const dic = (fuente, filas, dim, med) => Object.fromEntries(agrupar(fuente, filas, dim, med, 'natural', 0).map((d) => [d.k, d.v]));
  const fecha = (s) => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
  const pct = (x) => fmt.pct(x), eurM = (x) => fmt.eurM(x), n0 = fmt.n0, n1 = fmt.n1, usd = fmt.usd;
  const lista = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a[0]);

  function cifras() {
    const total = mv('ventas'), eo = dic('ventas', V, 'anio', 'eneOct');
    const prodV = dic('ventas', V, 'producto', 'ventas');
    const prod = Object.keys(prodV).map((p) => ({ et: p, v: prodV[p], m: mv('margenPct', V.filter((r) => r.producto === p)) }));
    const top3 = prod.slice().sort((a, b) => b.v - a.v).slice(0, 3), mejor = prod.slice().sort((a, b) => b.m - a.m)[0];
    const peor = top3.slice().sort((a, b) => a.m - b.m)[0];
    const zonas = Object.entries(dic('ventas', V, 'zona', 'ventas')).sort((a, b) => b[1] - a[1]);
    const paises = agrupar('ventas', V, 'pais', 'ventas', 'desc', 0);
    const ped = (a) => MEDS.ventas.pedidos.f(V.filter((r) => r.anio === a && r.mesN <= 10));
    const pri = dic('ventas', V, 'prioridad', 'plazo');
    const saldo = MEDS.proveedores.saldo.f(P), sin12 = P.filter((r) => r.meses > 12), mas36 = P.filter((r) => r.tramo === 'Más de 36 meses');
    const suma = (R) => R.reduce((s, r) => s + r.saldo, 0);
    const porCli = new Map();
    V.forEach((r) => porCli.set(r.cli, (porCli.get(r.cli) || 0) + 1));
    const idsMaestro = new Set(C.map((r) => r.id));
    const grupos = dic('clientes', C, 'grupo', 'clientes'), anios = Object.keys(eo).map(Number).sort();
    const aU = anios[anios.length - 1], aP = anios[anios.length - 2];
    return {
      total, margen: mv('margenPct'), ticket: mv('ticket'), pedidos: mv('pedidos'), plazo: mv('plazo'), top3, mejor, peor, pri,
      zonaTop: zonas[0], zonaMin: zonas[zonas.length - 1], zonaPct: (z) => z[1] / total, nPaises: paises.length, top10Paises: paises.slice(0, 10).reduce((s, d) => s + d.v, 0) / total,
      aU, aP, eoU: eo[aU], eoP: eo[aP], pedU: ped(aU), pedP: ped(aP), variacion: eo[aU] / eo[aP] - 1,
      saldo, nProv: P.length, sin12: sin12.length, sin12Saldo: suma(sin12), n36: mas36.length, saldo36: suma(mas36),
      top10Prov: P.map((r) => r.saldo).sort((a, b) => b - a).slice(0, 10).reduce((s, x) => s + x, 0) / saldo,
      conCompras: porCli.size, recurrentes: MEDS.ventas.recurrentes.f(V), recPct: MEDS.ventas.recurrentesPct.f(V), maxPed: Math.max(...porCli.values()),
      enMaestro: [...porCli.keys()].filter((id) => idsMaestro.has(id)).length,
      nGrupos: Object.keys(grupos).length, gMin: Math.min(...Object.values(grupos)), gMax: Math.max(...Object.values(grupos)),
      edad: C.reduce((s, r) => s + r.edad, 0) / C.length,
      eeuu: C.filter((r) => r.pais === 'Estados Unidos').length, ru: C.filter((r) => r.pais === 'Reino Unido').length,
      desde: D.meta.ventasDesde, hasta: D.meta.ventasHasta,
    };
  }

  /* decisiones por nivel (consigna, paso 4): cada una con su cifra y la página del tablero donde se ve */
  function decisiones(K) {
    const bajoTop = K.top3.every((p) => p.m < 0.3);
    const mismos = K.pedU === K.pedP;
    return {
      operativo: [
        { texto: 'Revisar precio y costo de los productos de mayor venta' + (bajoTop ? ', que tienen margen bajo.' : '.'),
          cifra: lista(K.top3.map((p) => p.et)) + ' suman ' + eurM(K.top3.reduce((s, p) => s + p.v, 0)) + '; ' + K.peor.et + ' rinde ' + pct(K.peor.m) + ' de margen.', ir: 'operativo' },
        { texto: 'Fijar un plazo objetivo menor para los pedidos críticos y seguir los más lentos con la tabla de pedidos.',
          cifra: 'Plazo medio ' + n1(K.plazo) + ' días; Crítica ' + n1(K.pri['Crítica']) + ' contra ' + n1(K.pri.Baja) + ' de la prioridad Baja.', ir: 'operativo' },
      ],
      tactico: [
        { texto: 'Conciliar primero a los proveedores sin compras de más de 36 meses y decidir si se paga, se renegocia o se da de baja.',
          cifra: n0(K.n36) + ' proveedores con ' + usd(K.saldo36) + '; ' + n0(K.sin12) + ' de ' + n0(K.nProv) + ' sin compra en 12 meses (' + usd(K.sin12Saldo) + ').', ir: 'tactico' },
        { texto: 'Lanzar una acción de recompra y un programa de fidelización con una meta medible.',
          cifra: K.recurrentes + ' de ' + n0(K.conCompras) + ' clientes (' + pct(K.recPct) + ') pidieron más de una vez; el máximo es ' + K.maxPed + ' pedidos.', ir: 'tactico' },
      ],
      estrategico: [
        { texto: 'Definir una política por producto: cuidar los de margen alto y corregir los de volumen con margen bajo.',
          cifra: K.mejor.et + ' tiene ' + pct(K.mejor.m) + ' de margen pero vende solo ' + eurM(K.mejor.v) + '.', ir: 'estrategico' },
        { texto: 'Reforzar o desarrollar zonas y revisar el ticket medio.',
          cifra: 'De enero a octubre ' + K.aU + ' ' + (K.variacion < 0 ? 'cae ' : 'sube ') + pct(Math.abs(K.variacion)) + ' frente a ' + K.aP + (mismos ? ' con los mismos ' + K.pedU + ' pedidos; ' : '; ') +
            K.zonaTop[0] + ' concentra ' + pct(K.zonaPct(K.zonaTop)) + ' y ' + K.zonaMin[0] + ' solo ' + pct(K.zonaPct(K.zonaMin)) + '.', ir: 'estrategico' },
        { texto: 'Definir el criterio de los grupos de clientes y medir su valor.',
          cifra: K.nGrupos + ' grupos de ' + K.gMin + ' a ' + K.gMax + ' clientes y edad promedio de ' + n1(K.edad) + ' años.', ir: 'estrategico' },
      ],
    };
  }

  /* guion de 12 diapositivas: t = título, p = puntos, c = cifras grandes, d = decisión, ir = página del tablero, niveles = tabla de decisiones */
  function diapositivas(K) {
    const dec = decisiones(K), mismos = K.pedU === K.pedP;
    const bajoTop = K.top3.every((p) => p.m < 0.3);
    return [
      { t: 'Tablero de gestión para la dirección de Air Transport', p: ['Tres preguntas: cómo se vende, cómo se cuida a los proveedores y a quién conviene fidelizar.', 'Se apoya en las tres fuentes de la empresa: ventas, proveedores y clientes.'],
        c: [['Ventas', eurM(K.total)], ['Margen bruto', pct(K.margen)], ['Pedidos', n0(K.pedidos)]], ir: 'operativo' },
      { t: 'Los datos', p: ['Ventas: ' + n0(V.length) + ' pedidos del ' + fecha(K.desde) + ' al ' + fecha(K.hasta) + '.', 'Proveedores: ' + n0(P.length) + '. Clientes: ' + n0(C.length) + '.',
        'Se limpiaron los importes con símbolo (pasados a número), las fechas y el país del cliente.'], c: [['Pedidos', n0(V.length)], ['Proveedores', n0(P.length)], ['Clientes', n0(C.length)]], ir: 'datos' },
      { t: 'Cómo se lee el tablero', p: ['Cuatro páginas con un navegador arriba: Operativo, Táctico, Estratégico y Datos y alcance.', 'Los cinco filtros se mantienen al cambiar de página y las etiquetas muestran lo que está activo.',
        'Un clic en un gráfico filtra el resto; clic derecho en un producto abre su detalle.', 'Cada gráfico se puede editar con ✎ y «Mi página» permite armar uno propio.'], ir: 'operativo' },
      { t: 'Operativo: ventas', p: [eurM(K.total) + ' vendidos, margen bruto de ' + pct(K.margen) + ' y ticket medio de ' + fmt.eur2(K.ticket) + '.',
        'Los tres productos de mayor venta (' + lista(K.top3.map((p) => p.et)) + ')' + (bajoTop ? ' tienen margen por debajo del 30 %' : ' rinden menos de lo esperado') + '; ' + K.peor.et + ' rinde ' + pct(K.peor.m) + '.'],
        c: [['Ventas', eurM(K.total)], ['Margen', pct(K.margen)], ['Ticket medio', fmt.eur2(K.ticket)]], d: dec.operativo[0].texto, ir: 'operativo' },
      { t: 'Operativo: entregas', p: ['El plazo medio de envío es de ' + n1(K.plazo) + ' días.', 'Prioridad Crítica: ' + n1(K.pri['Crítica']) + ' días; prioridad Baja: ' + n1(K.pri.Baja) + '.'],
        c: [['Plazo medio', n1(K.plazo) + ' días'], ['Crítica', n1(K.pri['Crítica']) + ' días'], ['Baja', n1(K.pri.Baja) + ' días']], d: dec.operativo[1].texto, ir: 'operativo' },
      { t: 'Táctico: proveedores', p: ['Saldo pendiente de ' + usd(K.saldo) + '.', n0(K.sin12) + ' de ' + n0(K.nProv) + ' proveedores (' + pct(K.sin12 / K.nProv) + ') sin compras en los 12 meses previos a la última fecha del archivo, con ' + usd(K.sin12Saldo) + ' del saldo.',
        n0(K.n36) + ' con más de 36 meses (' + usd(K.saldo36) + '). Los 10 mayores saldos son el ' + pct(K.top10Prov) + ' del total.'],
        c: [['Saldo', usd(K.saldo)], ['Sin compra 12 m', n0(K.sin12)], ['Más de 36 meses', n0(K.n36)]], d: dec.tactico[0].texto, ir: 'tactico' },
      { t: 'Táctico: clientes frecuentes', p: ['De ' + n0(K.conCompras) + ' clientes con compras, solo ' + K.recurrentes + ' (' + pct(K.recPct) + ') pidieron más de una vez; el máximo es ' + K.maxPed + ' pedidos.'],
        c: [['Con más de 1 pedido', String(K.recurrentes)], ['Recurrentes', pct(K.recPct)], ['Máximo de pedidos', String(K.maxPed)]], d: dec.tactico[1].texto, ir: 'tactico' },
      { t: 'Estratégico: rentabilidad', p: [K.mejor.et + ' tiene ' + pct(K.mejor.m) + ' de margen pero vende ' + eurM(K.mejor.v) + '.', lista(K.top3.map((p) => p.et)) + ' suman la mayor venta con menos margen.'],
        c: [[K.mejor.et + ' (margen)', pct(K.mejor.m)], [K.peor.et + ' (margen)', pct(K.peor.m)]], d: dec.estrategico[0].texto, ir: 'estrategico' },
      { t: 'Estratégico: geografía y tendencia', p: [K.zonaTop[0] + ' concentra ' + pct(K.zonaPct(K.zonaTop)) + ' de las ventas y ' + K.zonaMin[0] + ' ' + pct(K.zonaPct(K.zonaMin)) + '.',
        n0(K.nPaises) + ' países; los 10 primeros suman ' + pct(K.top10Paises) + '.',
        'De enero a octubre, ' + K.aU + ' ' + (K.variacion < 0 ? 'cae ' : 'sube ') + pct(Math.abs(K.variacion)) + ' frente a ' + K.aP + ' (' + eurM(K.eoU) + ' contra ' + eurM(K.eoP) + ')' +
          (mismos ? ' con los mismos ' + K.pedU + ' pedidos' + (K.variacion < 0 ? ': baja el importe por pedido.' : '.') : ', con ' + K.pedU + ' pedidos contra ' + K.pedP + '.')],
        c: [['Variación ene-oct', pct(K.variacion)], [K.zonaTop[0], pct(K.zonaPct(K.zonaTop))], ['Países', n0(K.nPaises)]], d: dec.estrategico[1].texto, ir: 'estrategico' },
      { t: 'Estratégico: segmentación de clientes', p: [K.nGrupos + ' grupos (A a E) de ' + K.gMin + ' a ' + K.gMax + ' clientes y edad promedio de ' + n1(K.edad) + ' años.', n0(K.eeuu) + ' clientes en EE. UU. y ' + n0(K.ru) + ' en Reino Unido.'],
        c: [['Grupos', String(K.nGrupos)], ['Edad promedio', n1(K.edad) + ' años']], d: dec.estrategico[2].texto, ir: 'estrategico' },
      { t: 'Decisiones por nivel', niveles: dec, ir: 'decisiones' },
      { t: 'Límites y próximos pasos', p: ['Ventas y clientes no comparten ID: ' + K.enMaestro + ' de ' + n0(K.conCompras) + ' coinciden.', 'Las ventas no traen identificador de proveedor.', 'Hay dos monedas (euros en ventas, dólares en saldos) sin conversión.',
        'Noviembre de 2022 está incompleto (último pedido el ' + fecha(K.hasta) + ').', 'Próximo paso: pedir a la empresa un ID común y la moneda de los saldos para medir ventas por grupo de cliente.'], ir: 'datos' },
    ];
  }

  g.PRESENTACION = { cifras, decisiones, diapositivas };
})(window);
