# Welcomex

[← Todos los proyectos](../README.md)

**Guía en lenguaje simple para pymes que empiezan en comercio exterior.** Es un producto propio, en desarrollo: sin usuarios reales todavía.

> ▶ **[Abrir la demo en vivo](https://welcomex-web.vercel.app)**
>
> El código de este proyecto es privado: en esta carpeta solo está su descripción. La demo muestra el sitio funcionando.

## Qué problema resuelve

Importar o exportar por primera vez en Argentina frena a muchas pymes antes de empezar: ¿qué posición arancelaria tiene mi producto?, ¿cuánto me cuesta de verdad traerlo?, ¿qué norma cambió esta semana?, ¿quién me ayuda a hacerlo? Welcomex junta las respuestas en un solo recorrido.

## Qué hace hoy

| Función | Qué es |
|---|---|
| **Tu primera operación** | Recorrido de 6 pasos: elegís importar, exportar o un servicio; buscás tu producto, calculás costos, mirás las normas y ves quién puede ayudarte, con enlaces a fuentes oficiales. |
| **Buscador de posiciones (NCM)** | 10.437 posiciones del Anexo I del Decreto 557/2023, con equivalencias coloquiales: «campera» encuentra «anorak». |
| **Calculadora de costos** | Estima el costo de importar o el ingreso neto de exportar. Solo sugiere dos valores estables, con norma, enlace y fecha de revisión: la tasa de estadística (3 %) y el IVA general (21 %). Si pasan 90 días sin revisarlos, deja de sugerirlos. |
| **Novedades normativas** | Resumen de las ediciones del Boletín Oficial de organismos de comercio exterior, siempre con enlace a la fuente oficial. |
| **Mercado «necesito / ofrezco»** | Etapa inicial. La demo muestra ejemplos rotulados como tales; todavía no hay cuentas ni contacto entre usuarios en la versión pública. |

## Decisiones de diseño

- **No inventar números.** Las alícuotas cambian por decreto: un dato viejo hace calcular mal con plata de verdad. Por eso solo se precargan dos y el resto lo carga cada persona.
- **No afirmar lo que no se puede respaldar.** La clasificación arancelaria definitiva es responsabilidad del importador y del despachante, y el sitio lo dice.
- **Todo lo que declara un usuario figura como «sin verificar».** No hay sellos de verificación hasta que exista una revisión real.
- **Investigar antes de construir.** Estudié nueve plataformas existentes (entre ellas Argentina Trade Net, del Estado, gratuita): competir por «más contactos» no tiene sentido. El hueco está en la guía para quien nunca operó.

## Cómo está hecho

Next.js 16, React 19, TypeScript y Tailwind 4. Datos locales con SQLite; cuentas sin contraseña, por enlace de un solo uso. Pruebas automáticas de la calculadora, el mercado y los formularios, y verificación en un navegador real.

Trabajé junto a un asistente de IA (Claude Code): tareas chicas en paralelo, cada una con pruebas y revisión mía.

## Código público

El código completo es privado, pero publiqué un extracto con pruebas: el [buscador de posiciones NCM](https://github.com/mateovega2912/buscador-ncm) (TypeScript, sin dependencias, 10 pruebas automáticas).

## Límites

- Es una demo: no guarda datos ni permite crear cuentas.
- Falta, antes de un lanzamiento real: base de datos en la nube, avisos por correo, verificación manual de empresas y publicaciones reales de un rubro.
- Los datos del NCM y las normas son públicos y oficiales; lo propio es cómo se presentan y se guía a la persona.

## Herramientas

Next.js · React · TypeScript · Tailwind · SQLite · Vercel · Claude Code
