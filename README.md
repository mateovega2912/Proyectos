# Machine Learning / Data Science — Mateo Vega

Repositorio con los trabajos prácticos de la materia *Introducción a la Inteligencia Artificial* (IES 21), organizados por tipo de problema. Cada dataset está acompañado de su informe técnico correspondiente (mismo nombre base, sufijo `_set.csv` / `_informe.docx`).

## Estructura

```
clasificacion/
  credit_set.csv    + credit_informe.docx     → aprobación de crédito (binaria)
  obesidad_set.csv  + obesidad_informe.docx   → nivel de obesidad (7 clases)
  bank_set.csv      + bank_informe.docx       → suscripción a depósito bancario (binaria, desbalanceada)

regresion/
  maquina_set.csv   + maquina_informe.docx    → predicción de respuesta de una máquina industrial
  Orange_final_maquina.ows

proyecto-integrador/
  abalone_set.csv   + abalone_informe.docx    → estimación de edad de abalones (CRISP-DM completo)
  Orange_final_abalone.ows

tablero-air-transport/
  entrega/ + tablero/ + datos/             → tablero de gestión (Power BI y web) con presentación, ventas/proveedores/clientes
```

## Otros proyectos

**[Tablero Air Transport](tablero-air-transport/)** — análisis de ventas, proveedores y clientes de un caso de consultoría, entregado como presentación (.pptx, versión clara y oscura), proyecto de Power BI y un tablero web interactivo de un solo archivo. Es un trabajo de análisis y visualización de datos (no de modelos predictivos): todas las cifras se verifican contra los datos y los límites de la información están declarados.

## Resumen de resultados

Todos los datasets fueron auditados antes de modelar (nulos, duplicados, fugas de datos) — el detalle de qué se corrigió está en cada informe. Resultados finales sobre conjunto de test, nunca visto durante el entrenamiento:

| Dataset | Problema | Mejor modelo | Métrica principal (test) |
|---|---|---|---|
| credit_set | Clasificación binaria | Random Forest (150 árb.) | Accuracy 85.5% / AUC 0.934 |
| obesidad_set | Clasificación multiclase (7) | Random Forest (200 árb.) | Accuracy 95.2% / F1 macro 0.951 |
| bank_set | Clasificación binaria (desbalanceada) | Regresión Logística balanceada | AUC 0.757 / Recall 0.611 |
| maquina_set | Regresión | Regresión Polinómica grado 2 | R² 98.6% / RMSE 1.15 |
| abalone_set | Regresión | Regresión Polinómica grado 2 | MAE 1.51 anillos / R² 0.564 |

## Nota sobre calidad de datos

Varios datasets originales tenían problemas que se corrigieron antes de modelar (documentados en detalle en cada informe):
- **abalone_set**: el archivo original tenía el 50% de las filas duplicadas exactas.
- **bank_set**: la columna `duration` es una fuga de datos (solo se conoce después de la llamada) y se descartó del modelado.
- **credit_set**: tenía 37 valores faltantes reales sin marcar, imputados antes de entrenar.
- **obesidad_set**: tenía 24 filas duplicadas exactas.

## Reproducibilidad

Los informes de clasificación se generaron con Python + pandas + scikit-learn, usando partición estratificada 60/20/20 (train/validación/test) y semilla fija (`random_state=42`).
