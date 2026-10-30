/* Logo de Air Transport en vectores, con el avión dando vueltas en círculo (sin quedarse nunca "de costado").
   Se usa en el encabezado (#marca) y arriba a la derecha de cada diapositiva de la Presentación.
   En Node solo expone svg() y css, para las pruebas. La geometría está calcada del recorte original: si llega el logo completo, se cambian solo los trazados. */
(function (g) {
  'use strict';
  const NARANJA = '#E84818', AZUL = '#185890';
  const ANCHO = 284, ALTO = 90; /* viewBox */
  const INCLINACION = -56, RADIO = 5, PERIODO = 3.6; /* grados del avión, unidades del viewBox, segundos por vuelta */
  const CENTRO = '49.6 30.8'; /* centro de la órbita: el medio del avión */

  /* avión en coordenadas locales: nariz hacia +x, centrado en el eje del fuselaje; se inclina con rotate(INCLINACION) */
  const CUERPO = 'M24.4 -1.8C26.6 -0.9 27.1 2.4 24.4 3.8L20.8 4.5L15.7 4.9L10.4 5.1L5.8 4.8L1.2 4.7L-3.5 4.3L-7.4 3.3L-12.2 2.1L-16.1 0.7L-19.1 -0.3L-22.5 -1.6L-24.5 -4.8L-24.7 -7.1L-25.7 -11L-24.4 -11.5L-22.7 -10.5L-17.8 -4.1L-15.5 -4.3L-12.7 -4.6L-9.7 -4.6L-6 -5.1L-4 -5L-1.6 -5.1L-5.1 -10.3L-7.7 -14.6L-9 -17.1L-8.7 -18.5L-7.4 -19L-4.5 -17.7L-0.2 -14.6L4.2 -11L9 -7.2L12.8 -5.4L17.1 -3.7L20 -3.2L22.3 -2.8Z';
  const ALA_LEJANA = 'M6.4 6L5.8 8L-6.6 16.3L-11.1 16.2L-7 9.8L-3.9 5.5L-0.5 5.2L3.5 5.5Z';
  /* estela curva que viene desde abajo a la izquierda (en coordenadas del viewBox) */
  const ESTELA = 'M45.3 44.3C33.9 53.3 21.8 59.9 9.7 65Q4.5 67.5 .7 75.4Q8 73 14.5 70.1C23.5 65.6 31.3 61.2 36.8 53.3C40 49.5 42.6 47.4 45.3 44.3Z';

  const PALABRAS = ['azul', 'blanco', 'tinta']; /* colores de la palabra: azul de marca, blanco (sobre fondo oscuro) y tinta */

  /* svg({ alto: 40, palabra: 'azul' | 'blanco' | 'tinta', decorativo: true }) -> texto del <svg> */
  function svg(op) {
    const o = op || {};
    const alto = o.alto > 0 ? +o.alto : 40, ancho = Math.round((alto * ANCHO / ALTO) * 10) / 10;
    const palabra = PALABRAS.includes(o.palabra) ? o.palabra : 'azul';
    const nombre = o.decorativo ? 'aria-hidden="true"' : 'role="img" aria-label="Air Transport"';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="logo logo-' + palabra + '" viewBox="0 0 ' + ANCHO + ' ' + ALTO + '" width="' + ancho + '" height="' + alto + '" ' + nombre + '>'
      + '<path class="logo-estela" fill="' + NARANJA + '" d="' + ESTELA + '"/>'
      + '<g transform="translate(' + CENTRO + ')"><g class="orbita"><g class="logo-avion" fill="' + NARANJA + '" transform="rotate(' + INCLINACION + ')">'
      + '<path d="' + CUERPO + '"/><path d="' + ALA_LEJANA + '"/></g></g></g>'
      + '<text class="logo-palabra" x="32.9" y="86.6" fill="' + AZUL + '" font-family="\'Segoe UI\', \'Helvetica Neue\', Arial, sans-serif" font-weight="700" font-style="italic" font-size="36" textLength="248" lengthAdjust="spacingAndGlyphs">AIR TRANSPORT</text>'
      + '</svg>';
  }

  /* Solo variables que ya define estilos.css (la palabra de la diapositiva usa var(--azul): en modo oscuro se aclara sola). */
  const CSS = [
    '.logo { display: block; flex: none; overflow: visible; letter-spacing: 0; text-transform: none; }',
    '.logo-estela, .logo-avion { fill: var(--naranja, ' + NARANJA + '); }',
    '.logo-palabra { fill: var(--azul, ' + AZUL + '); }',
    '.logo-blanco .logo-palabra { fill: #fff; }',
    '.logo-tinta .logo-palabra { fill: var(--tinta, #1F2933); }',
    /* el avión recorre un círculo sin girar: gira el brazo (rotate) y se contragira el avión (rotate inverso) */
    '.logo .orbita { transform-box: view-box; transform-origin: 0 0; animation: logo-orbita ' + PERIODO + 's linear infinite; }',
    '@keyframes logo-orbita { from { transform: rotate(0deg) translateX(' + RADIO + 'px) rotate(0deg); } to { transform: rotate(360deg) translateX(' + RADIO + 'px) rotate(-360deg); } }',
    '.slide { position: relative; }',
    '.slide-marca { position: absolute; top: 4px; right: 4px; line-height: 0; pointer-events: none; }',
    '.slide > small, .slide > h2 { padding-right: 112px; }', /* lugar para que el logo (30 px de alto, ~95 de ancho) no tape el título */
    '@media (prefers-reduced-motion: reduce) { .logo .orbita { animation: none; } }',
    /* al imprimir el encabezado queda sobre fondo blanco: la palabra pasa a azul y el avión se queda quieto */
    '@media print { .logo .orbita { animation: none; } .cab .logo-blanco .logo-palabra { fill: var(--azul, ' + AZUL + '); } .slide-marca { top: 0; } }',
  ].join('\n');

  function marcarDiapositivas(pagina) {
    pagina.querySelectorAll('.slide').forEach((s) => {
      if (s.querySelector(':scope > .slide-marca')) return;
      const m = document.createElement('div');
      m.className = 'slide-marca';
      m.innerHTML = svg({ alto: 30, palabra: 'azul', decorativo: true });
      s.append(m);
    });
  }

  function montar() {
    if (!document.getElementById('logo-css')) {
      const st = document.createElement('style');
      st.id = 'logo-css';
      st.textContent = CSS;
      document.head.append(st);
    }
    const marca = document.getElementById('marca');
    if (marca) marca.innerHTML = svg({ alto: 40, palabra: 'blanco' });
    const pagina = document.getElementById('pagina');
    if (pagina) {
      marcarDiapositivas(pagina);
      /* cada vez que cambia la diapositiva se crea un .slide nuevo: se le agrega el logo */
      new MutationObserver(() => marcarDiapositivas(pagina)).observe(pagina, { childList: true, subtree: true });
    }
  }

  g.LOGO = { svg, css: CSS };
  if (typeof module !== 'undefined') module.exports = g.LOGO;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
    else montar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
