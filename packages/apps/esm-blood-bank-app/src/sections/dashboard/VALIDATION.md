# Verificación de Inicio operativo — 2026-10-31

Diff local sin commit en `bloodBank`, HEAD inicial
`1c481a28bc682ece0c3e389b92a610e29fc1c091`.
Se preservaron los cambios previos de Seguimientos y sus archivos nuevos; no se
movió el checkout, no se restauraron archivos ni se crearon commits o PR.

Entorno: Windows, Node 24.22.1 del runtime y Yarn local 4.13.0, ejecutado mediante
`.yarn/releases/yarn-4.13.0.cjs`. Datos exclusivamente sintéticos.

| Estado  | Comando/caso                                             | Resultado y alcance                                                                                                                                                                                 |
| ------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app lint`       | 180 fuentes; sin errores ni advertencias.                                                                                                                                                           |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app typescript` | Comprobación del ESM y los consumidores internos del contrato de rutas.                                                                                                                             |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test`       | 390/390 pruebas, 31 archivos. Incluye perfiles, permisos, combinaciones, errores seguros, enlaces y las regresiones previas.                                                                        |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build`      | Compilación correcta, con dos advertencias de tamaño de assets/entrypoint; no se verificaron como preexistentes en origin/main.                                                                     |
| PASSED  | `yarn validate:workspaces`                               | Hard checks correctos; no se cambian registros de workspaces o slots.                                                                                                                               |
| PASSED  | `yarn validate:critical-route-privileges`                | Las 15 aplicaciones críticas mantienen fail closed.                                                                                                                                                 |
| PASSED  | `yarn validate:react-router`                             | Contrato de router válido.                                                                                                                                                                          |
| PASSED  | `yarn validate:error-exposure --base HEAD`               | Cero exposiciones detectadas en 32 fuentes modificadas; el alcance incluye los cambios previos aún sin commit.                                                                                      |
| PASSED  | Paridad de traducciones Inicio EN/ES                     | Claves del nuevo grupo `dashboard` presentes en ambos idiomas.                                                                                                                                      |
| PASSED  | Playwright / Edge headless: 1920×1080 y 375×900          | Los cuatro perfiles, selección + laboratorio + inventario, responsable + inventario, enlaces a entrevistas/Tamizaje, alerta a unidad exacta, recarga directa y móvil sin desbordamiento horizontal. |
| PASSED  | Privacidad de la prueba de navegador                     | Cero errores de página y cero solicitudes externas. Contextos cerrados y servidor HTTP local detenido.                                                                                              |
| NOT RUN | `verify:changed --base origin/main --head HEAD`          | No se crearon commits y ese rango no representa el diff de trabajo. Se ejecutaron explícitamente los controles aplicables.                                                                          |
| BLOCKED | Validación clínica integrada DEV/QLTY                    | Los adaptadores reales de las operaciones permanecen deshabilitados; faltan contratos backend. La prueba mock no acredita persistencia ni autorización clínica del servidor.                        |

La fixture temporal está fuera de Git, en `tmp/dashboard-smoke` del directorio
padre del repositorio. Usa componentes, estilos, rutas y adaptadores mock reales;
simula sesión, contexto de cabecera y privilegios. El perfil se elige solo en esa
fixture, no en el producto. Las capturas de los perfiles son demostraciones con
sesión simulada y datos sintéticos, guardadas en `outputs/inicio-banco-sangre`
del directorio padre.

Las pruebas denegadas verifican ausencia de consultas: el acceso al módulo o a
una sección no concede por sí mismo una vista de Inicio, y el permiso de
responsable no concede acceso operativo. Las combinaciones no duplican bloques.

Las comprobaciones de enlaces verifican coincidencia exacta de unidad, cambios
de parámetros en una vista ya montada, recarga directa, retirada de filtros,
unidad no disponible, pestaña de seguimiento y apertura de nueva postulación
sin guardar. La ventana de vencimientos se prueba en sus límites y con fechas
inválidas/desconocidas. No hay creación de pacientes, asignación de sellos,
reservas, entregas o eliminación por hacer clic en las tarjetas de Inicio.

## Revisión de filas por área — 2026-11-02

Mismo checkout y HEAD inicial, con cambios locales previos preservados. Se aplica
la distribución elegida a todos los perfiles: filas completas, tarjetas compactas,
Nueva postulación junto al título y vencimientos después de todas las áreas.
El orden visual coincide con el del documento y de navegación por teclado.
Las tarjetas y las alertas comparten una lectura autorizada de Inventario, sin
consultas duplicadas ni permisos adicionales. Las pruebas usan exclusivamente
datos sintéticos y privilegios simulados; no se modificaron cuentas del backend.

- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app test src/sections/dashboard/dashboard.component.test.tsx src/blood-bank-app.component.test.tsx src/navigation/blood-bank-nav.extension.test.tsx`.
  51/51 pruebas en tres archivos. Se corrigió después una advertencia de `act`
  en la prueba de acceso parcial; la revalidación final del archivo de Inicio
  ejecutó 18/18 pruebas sin esa advertencia.
- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app typescript` tras corregir
  la inferencia de tipos de la tabla de permisos de la nueva prueba. No se
  relajaron tipos ni se cambió la autorización para resolverlo.
- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app lint`: 180 fuentes,
  sin errores. `build` compiló con dos advertencias de tamaño de assets y
  entrypoint, no verificadas como preexistentes en `origin/main`.
- **PASSED:** `tmp/dashboard-smoke/area-rows.cjs`, con componentes y estilos
  reales: siete composiciones de permisos a 1920, 1280 y 375 píxeles, 21 casos.
  Incluye Selección, Laboratorio, Inventario, Laboratorio + Inventario,
  Operativo, Responsable y Responsable + Inventario. Se comprueban filas de
  igual ancho, orden sin solapamientos, tarjetas compactas, enlaces existentes,
  cinco alertas al final, ausencia de duplicados y de desbordamiento horizontal.
  Cero errores de navegador o solicitudes externas; contextos y servidor cerrados.
  Capturas revisadas en `outputs/inicio-banco-sangre/filas-por-area`, fuera de Git.
- **PASSED:** formato Markdown de los README afectados y revisión de espacios
  del diff local mediante `git diff --check`.
- **NOT RUN:** suite completa del ESM en esta revisión; se ejecutaron las tres
  suites afectadas. El resultado anterior de 390 pruebas corresponde a la
  revisión previa y no se presenta como una nueva ejecución.
- **NOT RUN:** acceso con las cuentas reales del servidor, validación clínica
  integrada y despliegue. La prueba visual simula sesión y permisos localmente;
  no acredita autorización ni persistencia del backend.

## Revisión de mosaico y vista amplia — 2026-11-02

Sustituye la distribución de filas de la revisión anterior, conservando sus
destinos, lecturas autorizadas, estado de carga, reintento y alertas al final.
Un perfil de Inicio usa la vista amplia; Responsable o dos perfiles distintos
usan el mosaico. Los privilegios se evalúan con los guards existentes. El número
de roles de OpenMRS y los nombres de usuario no intervienen. Se mantienen los
cambios locales anteriores, sin commits, cambios de servidor o despliegue.

- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app test src/sections/dashboard/dashboard.component.test.tsx src/blood-bank-app.component.test.tsx src/navigation/blood-bank-nav.extension.test.tsx`:
  60/60 pruebas en tres archivos. Nueve casos adicionales verifican las tres
  vistas individuales, combinaciones, Responsable con un solo destino
  operativo, dos permisos de Inicio con una sola área autorizada y un
  privilegio repetido. Se conserva la ausencia de consultas no autorizadas.
- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app lint`: 180 archivos sin
  errores; `typescript` sin errores; `build` correcto, con dos advertencias de
  tamaño de assets/entrypoint no verificadas como preexistentes en `origin/main`.
- **PASSED:** paridad de las 44 claves de Inicio EN/ES, sin valores vacíos.
  Las descripciones de las tareas también están traducidas.
- **PASSED:** Playwright/Edge, `tmp/dashboard-smoke/adaptive-modes.cjs`: ocho
  composiciones de permisos a 1920×1080, 1280×900 y 375×900, 24 casos.
  Verifica modo elegido, áreas y cantidad de accesos, columnas del mosaico,
  bloque impar de ancho completo, altura disponible de la vista amplia,
  descripciones, cinco alertas, enlaces y ausencia de desbordamiento horizontal.
  A 1920×1080 los ocho casos permanecen dentro de la altura del viewport.
  Cero errores de página o solicitudes externas; contextos y servidor cerrados.
  Se revisaron capturas en `outputs/inicio-banco-sangre/inicio-adaptable`, fuera
  del repositorio, con sesión y privilegios simulados y datos sintéticos.
- **NOT RUN:** suite completa del ESM y login con las cuentas reales del
  servidor. Los casos de navegador son validación local de componentes y
  adaptación visual; no acreditan autorización o persistencia del backend.

## Resumen y pendientes de Selección — 2026-11-02

La vista de un único perfil de Selección y extracción incorpora dos resúmenes
compactos y hasta seis pendientes obtenidos de las fuentes operativas actuales.
Los resúmenes y filas comparten las lecturas autorizadas. El mosaico y la vista
actual de Laboratorio se conservan. Los accesos directos usan IDs exactos y
verifican el estado antes de abrir los formularios existentes. Una referencia
desactualizada muestra un aviso; cerrar no reabre la ficha ni guarda datos.

- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app test src/sections/dashboard/dashboard.component.test.tsx`:
  34/34 pruebas. Incluye lecturas compartidas, destinos restringidos, apertura
  de entrevista con Admisión bloqueada, apertura de extracción sin guardar,
  cierre sin reapertura al refrescar, referencias desactualizadas y rutas
  denegadas sin consultas. Se ajustaron selectores de prueba al nombre real de
  la confirmación y al prefijo accesible de Carbon en el botón de descarte.
- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app test src/sections/applicant-selection/selection.component.test.tsx src/sections/collection/collection.component.test.tsx src/blood-bank-app.component.test.tsx src/navigation/blood-bank-nav.extension.test.tsx --maxWorkers=1`:
  75/75 pruebas en cuatro archivos. Total ejecutado en esta revisión: 109 pruebas
  en cinco archivos; no es la suite completa del módulo.
- **PASSED:** `lint`, 181 archivos; `typescript`; `build` del workspace. La
  compilación mantiene dos advertencias de tamaño de assets/entrypoint, no
  verificadas como preexistentes en `origin/main`.
- **PASSED:** `yarn validate:critical-route-privileges` y
  `yarn validate:react-router`. Se mantienen las rutas y sus guards existentes.
- **PASSED:** paridad de claves EN/ES de Selección, Procesamiento e Inicio.
- **PASSED:** `tmp/dashboard-smoke/selection-summary.cjs`, Edge headless con
  sesión simulada y datos sintéticos. A 1920, 1280 y 375 píxeles: resumen y filas
  actuales, ambas acciones, Admisión bloqueada, cierre sin reapertura ni
  escritura de datos al abrir. Se comprueban además las vistas de Operativo,
  Responsable y Laboratorio sin la tabla nueva. Cero errores de navegador o
  solicitudes externas; contextos y servidor cerrados. En móvil, el scroll
  horizontal se limita a la tabla y no desborda el viewport.
  El clic inicial de la prueba sobre el input de Carbon quedó interceptado por
  su etiqueta; se corrigió la automatización para pulsar esa etiqueta visible,
  sin clic forzado ni cambios al control del producto.
- **NOT RUN:** login con las cuentas reales, suite completa del ESM y validación
  clínica integrada. Los adaptadores reales siguen pendientes de integración.

Capturas locales revisadas en `outputs/inicio-banco-sangre/resumen-pendientes`,
fuera de Git. La propuesta visual de Laboratorio se entrega solo para evaluación
en el chat; no se ha implementado su tabla ni sus filtros en el producto.

## Resumen y pendientes de Laboratorio — 2026-11-03

Revisión sobre el árbol local con HEAD `1c481a28b` y los cambios previos de
Seguimientos, Inicio e Inventario conservados. El usuario solicitó únicamente
el título y descripción del commit; no se crearon commits ni se modificó el
backend. Node 24, Yarn 4.13.0, Windows y datos sintéticos.

El perfil único de Laboratorio incorpora cuatro resúmenes y hasta seis filas por
filtro, desde las mismas lecturas autorizadas. Los enlaces abren la muestra o
ronda exacta; Fraccionamiento filtra y preselecciona una unidad elegible sin
iniciar el lote. Los resúmenes de Selección reutilizan la misma presentación y
montaje autorizado de fuentes. Los perfiles combinados conservan el mosaico.

- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app test src/sections/dashboard/dashboard.component.test.tsx src/sections/laboratory/screening/screening-queues.component.test.tsx src/sections/laboratory/fractionation/fractionation.component.test.tsx src/sections/transfusions/transfusions.component.test.tsx src/blood-bank-app.component.test.tsx src/navigation/blood-bank-nav.extension.test.tsx --maxWorkers=1`:
  116/116 pruebas ejecutadas en seis archivos; 48 corresponden a Inicio. Se
  verifican lecturas compartidas, filtros sin consultas nuevas, totales completos
  frente a vista previa de seis filas, fuentes restringidas, errores/reintentos,
  apertura exacta sin escrituras, salida sin reapertura y URLs denegadas sin
  consultas. La preparación de compatibilidad reserva unidades y modifica el
  total elegible: la expectativa usa ese estado actual, sin alterar las reglas.
  Se ajustó la prueba de cierre a la confirmación existente y se retiró una
  opción no admitida por los tipos de Testing Library.
- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app lint`: 183 archivos;
  `typescript` sin errores; `build` correcto, con dos advertencias de tamaño de
  assets/entrypoint no verificadas como preexistentes en `origin/main`.
- **PASSED:** `yarn validate:critical-route-privileges`, 15 aplicaciones críticas
  con cierre por defecto; `yarn validate:react-router`, contrato 7.18.2 correcto.
  `yarn validate:error-exposure --base HEAD` revisó 37 fuentes modificadas,
  incluidos archivos sin seguimiento, sin exposiciones detectadas.
- **PASSED:** paridad EN/ES sin valores vacíos: Inicio 81 claves,
  Procesamiento 463 y Transfusiones 157.
- **PASSED:** `node ../tmp/dashboard-smoke/laboratory-summary.cjs`, Edge headless,
  sesión y permisos simulados. A 1920×1080, 1280×900 y 375×900 se comprobaron
  resúmenes, filtros, ambas categorías de muestras, apertura/cierre sin guardar
  ni reabrir, preselección exacta sin crear lote y ausencia de desbordamiento del
  viewport. El scroll horizontal móvil queda en la tabla. Un grupo de
  compatibilidad preparado con las APIs mock abre sus pruebas sin registrar
  resultados. Selección, Operativo, Responsable y Laboratorio + Inventario
  mantienen sus distribuciones. Cero errores de navegador o solicitudes
  externas; contextos y servidor cerrados. Se revisaron capturas de escritorio
  y móvil en `outputs/inicio-banco-sangre/laboratorio-resumen-pendientes`, fuera
  de Git. La cabecera/sesión del harness está simulada; no acredita el shell
  desplegado ni la autorización real de OpenMRS.
- **PASSED:** `yarn prettier --check` sobre los seis Markdown modificados en esta revisión y `dashboard.scss`; `git diff --check` sin errores.
- **NOT RUN:** suite completa del ESM, login con cuentas reales, integración
  clínica/backend, CI y `verify:changed` entre commits. No hay un commit nuevo
  y los adaptadores reales siguen pendientes; la evidencia corresponde al árbol
  local y a los componentes con mocks, no a persistencia de producción.

## Recuperación de pantalla en blanco — 2026-11-03

La sesión local de Laboratorio quedaba en `/home/blood-bank` con cabecera y sin
contenido ni menú del ESM. La consola real mostró `ChunkLoadError` y HTTP 404
al solicitar un vendor chunk del servidor de Banco de Sangre. El entry servido
también referenciaba ese archivo inexistente, por lo que no era un problema de
privilegios. El build de producción ejecutado durante la validación anterior
había limpiado `dist`, compartido con la salida del servidor de desarrollo.
Las pruebas aisladas de componentes no cubrían esta colisión de compilaciones.

Se separó únicamente la salida de desarrollo del ESM en
`node_modules/.cache/blood-bank-dev`, fuera de `dist`, y se añadió `no-store` a
sus respuestas de desarrollo. Se conservaron la entrada y salida de producción,
CORS, los guards y el workaround del cliente HMR. Se reemplazó únicamente el
servidor local de este ESM en su mismo puerto, manteniendo el proxy, sesión,
roles y datos mock. Tras recargar, la sesión existente redirigió a `/blood-bank`
y mostró el menú, los cuatro resúmenes y Pendientes de laboratorio. La revisión
visual se realizó con el skill Computer Use; no se modificó la cuenta ni se
hicieron registros clínicos o guardados en el backend.

- **PASSED:** `yarn workspace @sihsalus/esm-blood-bank-app test src/build-output.test.ts --maxWorkers=1`,
  2/2 pruebas contra la configuración real: directorios independientes,
  entrada/publicPath de producción conservados, CORS, no-store y workaround HMR.
- **PASSED:** `node ../tmp/dashboard-smoke/check-build-isolation.cjs` ejecutó
  `yarn workspace @sihsalus/esm-blood-bank-app build` mientras el servidor del
  ESM seguía activo. Los 11 JavaScript de desarrollo devolvieron HTTP 200 antes
  y después, con los mismos hashes SHA-256 y `Cache-Control: no-store`.
  El build conserva dos advertencias de tamaño, no verificadas como
  preexistentes en `origin/main`.
- **PASSED:** `typescript` sin errores y `lint`, 184 archivos. No se cambiaron
  dependencias, import maps, rutas, permisos o componentes globales.
- **PASSED:** comprobación en Edge con la sesión local de Laboratorio ya
  autenticada: Inicio, cabecera, menú lateral, cuatro indicadores y cinco
  pendientes visibles. No se borró almacenamiento del navegador. Permanecen
  avisos de versiones compartidas de otros módulos; esta revisión no los
  declara resueltos ni verificados como preexistentes en `origin/main`.
- **NOT RUN:** suite completa, recompilación/ensamblado de toda la SPA, login de
  las otras cuentas, CI o validación clínica. La salida de producción del ESM
  conserva su contrato y se comprobó su build local; no hay despliegue ni commit.
