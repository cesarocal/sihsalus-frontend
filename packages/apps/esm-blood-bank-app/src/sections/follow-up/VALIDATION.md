# Verificación local de Seguimientos — 2026-10-31

Diff sin commit en `bloodBank`, base `1c481a28bc682ece0c3e389b92a610e29fc1c091`.
Windows, Node 24.22.1 y Yarn local 4.13.0. Datos exclusivamente sintéticos.

Los comandos Yarn siguientes se ejecutaron mediante el Node 24 del runtime y
`.yarn/releases/yarn-4.13.0.cjs`, sin depender del Node 20 presente en el PATH.

| Estado  | Comando o caso                                           | Resultado y alcance                                                                                                                                                                                                        |
| ------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app lint`       | 178 archivos; sin advertencias de lint.                                                                                                                                                                                    |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app typescript` | Exit 0; incluye consumidores internos del contrato ampliado.                                                                                                                                                               |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test`       | 377/377 pruebas, 30 archivos. Incluye 19 nuevas pruebas de Seguimientos y privilegios, respecto de las 358 anteriores del módulo.                                                                                          |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build`      | Exit 0; dos advertencias de tamaño de assets/entrypoint. No se verificaron como preexistentes en origin/main.                                                                                                              |
| PASSED  | `yarn validate:workspaces`                               | Hard checks correctos; inventario de registros heredados mostrado por el script.                                                                                                                                           |
| PASSED  | `yarn validate:critical-route-privileges`                | 15 aplicaciones críticas fail closed.                                                                                                                                                                                      |
| PASSED  | `yarn validate:react-router`                             | Contrato de router correcto; las rutas y privilegios existentes se conservan.                                                                                                                                              |
| PASSED  | `yarn validate:error-exposure --base HEAD`               | 20 fuentes cambiadas inspeccionadas; cero exposiciones detectadas por el script. Los nuevos componentes también cubren errores seguros mediante pruebas.                                                                   |
| PASSED  | Playwright / Edge headless local, 1920×1000              | Ambos tipos: bandeja, historial, detección, trazabilidad completa, notificaciones, muestras, resultados mediante el adaptador real de Tamizaje mock, cierre, salida del listado abierto y detalle cerrado de solo lectura. |
| PASSED  | Playwright: informe A4 y móvil 375×900                   | Estructuras FR13/FR14, firmas y tablas revisadas visualmente. Contenido de impresión bajo el área útil A4; sin desbordamiento horizontal del diálogo móvil.                                                                |
| PASSED  | Privacidad del smoke                                     | Cero errores de página y cero solicitudes externas; contextos cerrados y servidor local detenido.                                                                                                                          |
| NOT RUN | `yarn verify:changed --base origin/main --head HEAD`     | No se crearon commits ni PR. Ese rango no representa el diff local; se ejecutaron explícitamente las verificaciones aplicables arriba.                                                                                     |
| BLOCKED | E2E clínico integrado DEV/QLTY                           | No existe contrato implementado para persistir estos casos en el backend. El adaptador real permanece deshabilitado; el smoke mock no acredita validación clínica.                                                         |

La fixture temporal reside fuera de Git, en `tmp/follow-up-smoke` del directorio
padre del repositorio. Usa los componentes y SCSS reales, Carbon, datos y
adaptadores reales del mock; simula únicamente el marco de sesión/cabecera y
traducción. Las tomas de muestra se activaron por teclado después de desplazar y
enfocar su botón. La automatización de clic rápido en un segundo botón durante
el desplazamiento del modal no activó la acción; no se ocultó mediante un clic
forzado ni se cambió el criterio funcional. El recorrido por teclado completó
las mismas verificaciones y registros. No se añadió un standalone al producto.

La impresión se revisó con medios de impresión en Chromium y capturas A4;
no se validó una impresora física. Las capturas y la fixture no contienen
credenciales, sesiones reales ni datos personales reales.

Se corrigió durante la verificación una expectativa anterior que todavía
buscaba el título del placeholder «Seguimiento del receptor», y se añadieron
regresiones para la identidad canónica y el aislamiento de muestras por tipo.
