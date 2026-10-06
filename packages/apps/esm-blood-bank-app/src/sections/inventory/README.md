# Inventario de Banco de Sangre

Base navegable con datos sintéticos. Ruta `/blood-bank/inventory`, protegida
por el privilegio existente de Inventario y por la entrada al ESM. No modifica
login, barra lateral global, privilegios del backend ni tablas de OpenMRS.

## Pantalla y flujos

- Cabecera estándar con `StockManagementPictogram`, ubicación y hora. Fondo
  blanco, métricas, búsqueda por código/origen/componente/ubicación, filtros
  combinados de componente, grupo y estado, y paginación Carbon.
- Selección múltiple y Deseleccionar. Seleccionar resultados filtrados aparece
  solo dentro de los popups, no en el listado principal.
  Sello de calidad y Eliminar unidades abren sin selección o precargan las
  filas seleccionadas. El popup de sello muestra solo tamizaje validado no
  reactivo y solo incluye esas unidades de la selección previa; un texto explica
  este alcance. No modifica la selección del proceso de eliminación.
  La columna Tamizaje resume No reactiva/Reactiva/Indeterminada/Pendiente;
  se retiró la columna explicativa Verificación para sello. Las demás
  restricciones siguen bloqueando la selección y se revalidan en el adaptador.
- Sello de calidad: selección, responsable, fecha/hora y tres comprobaciones
  manuales. Solo admite cuarentena sin sello, identidad/ubicación/vencimiento
  válidos y tamizaje vinculado a la extracción original, validado y no reactivo
  en todas las pruebas. Seguimiento o aféresis sin unidad vinculada no autorizan
  sellos. Los derivados consultan la unidad original.
- Impresión: un sello por unidad en una única solicitud. Se reserva el proceso
  antes de imprimir; no se puede reasignar ni reimprimir desde el historial.
  Las unidades siguen en cuarentena hasta confirmar explícitamente la impresión
  correcta y aceptar el cambio a `APTO`.
- Eliminar unidades: tres pasos, Seleccionar unidades → Causas de eliminación
  (una opción del desplegable por unidad, fecha/hora, personas presentes y
  responsables del servicio/Epidemiología) → Revisión del acta `EG010-FR02`.
  Cada avance guarda el borrador; seleccionar unidades no exige aún los datos
  del segundo paso. Anterior conserva lo ingresado. La revisión permite imprimir
  el acta como borrador, sin eliminar unidades ni simular una firma.
  Solo Registrar acta y su confirmación final ejecutan la salida del stock.
  El lote recibe `ELIMINADAS` y sale del stock activo. Se conservan la instantánea
  original, causas, acta y responsables; no se borran extracciones ni resultados.
- Historial de sellos y actas: búsqueda, filtro de proceso, detalle, reanudación
  y vuelta con flecha. Las actas finalizadas se imprimen con líneas para firmas
  físicas. Solo la X cierra el historial, sin otro Cerrar en el pie.
- Cierre de procesos: Seguir editando / Salir y casilla para guardar antes de
  salir. Guardar un borrador idéntico no escribe ni muestra un éxito ficticio.
- Imprimir acta e Imprimir sellos se presentan como botones azules `ghost` con
  icono en el pie izquierdo. La misma ubicación/variante se aplica al acta del
  historial, sin modificar el navbar, el tema global ni otros módulos.

El helper compartido dentro del ESM prepara el HTML con `createRoot` y `flushSync`
del renderer cliente, desmontando el árbol temporal antes de crear el iframe.
Esto evita el fallo `getCurrentStack` reproducido al combinar el renderer de
servidor en desarrollo con React de producción del host. El CSS de impresión se
renderiza como texto normal, sin `dangerouslySetInnerHTML`; las entradas del
usuario siguen escapadas y los errores visibles no muestran trazas.

## Organización y persistencia

- `inventory-page.component.tsx`: entrada, métricas y acciones.
- `inventory-selector.component.tsx`: tabla, selección y filtros.
- `inventory-workflow.component.tsx`: dos etapas para sello, tres para eliminación
  y sus confirmaciones.
- `inventory-documents.component.tsx`: sellos y acta imprimibles.
- `disposal-causes.ts`: ocho causas del BPMN, con códigos estables y etiquetas
  traducidas; no inventa UUIDs/conceptos clínicos.
- `disposal-act-print.ts`: estilos exclusivos del acta impresa A4, tabla de cinco
  columnas, filas en blanco y dos espacios para firmas físicas. Las tablas largas
  repiten cabecera y la numeración de páginas usa el soporte del navegador.
- `inventory-history.component.tsx`: consulta y reanudación.
- `inventory.types.ts` / `inventory-rules.ts`: contratos y validación.
- `../../api/inventory.api.ts`: interfaz y endpoints OMOD propuestos.
- `../../api/mock-inventory.api.ts`: stock y transiciones.
- `../../api/mock-inventory-store.ts`: almacenamiento y bloqueos compartidos
  con Fraccionamiento.

`getInventory()` comparte la proyección de estos flujos. El campo opcional
`inventory` amplía `sihsalus.blood-bank.processing.mock.v1`, sin reiniciar datos.
Una transición usa un único `setItem`; una escritura fallida no deja movimientos
parciales. Revisiones e identidad canónica rechazan ediciones antiguas o
manipuladas. Repetir la finalización no duplica movimientos.
Los campos de responsables y personas presentes no tienen límites de texto
arbitrarios mientras se define el contrato de persistencia real. Las causas nuevas
se guardan como códigos del catálogo. Las causas de texto libre de actas anteriores
siguen siendo legibles e imprimibles, sin migración destructiva; al retomar un
borrador antiguo se muestra su causa previa y se exige elegir una del catálogo
antes de finalizar. El adaptador mock también rechaza causas desconocidas.

Unidades en laboratorio/reservadas no se eliminan. Sellos pendientes bloquean
Fraccionamiento; las eliminadas no se muestran en su cola y su API rechaza
peticiones antiguas. Un PFC con sello finalizado puede fraccionarse: sus nuevos
componentes entran en cuarentena y no heredan el sello. Un acta puede retirar una
unidad con impresión pendiente; esa unidad ya no puede confirmarse como apta.

Los PFC de demostración preexistentes no tienen tamizaje vinculado y se muestran
como pendientes, fuera del popup de sello, sin inventar resultados. Para nuevas extracciones se completa
Tamizaje y, si corresponde, Fraccionamiento con etiquetas/vencimiento.
`inventory-test-fixtures.ts` se utiliza solo en pruebas sintéticas explícitas;
no se importa en la aplicación ni aprueba registros del usuario.

`../../mocks/inventory.mock.ts` añade cinco unidades sintéticas independientes:
`BB-SELLO-DEMO-001` a `003` tienen siete pruebas no reactivas validadas;
`004` y `005` tienen un resultado reactivo. Se vinculan a sus propias
extracciones y muestras, no se aprueban muestras pendientes del usuario.
La proyección aditiva del inventario también las muestra en pestañas anteriores
sin escribir durante una lectura, y las conserva en la siguiente escritura normal.
No reemplaza resultados, fechas, sellos ni avances existentes y no vuelve a
ingresar unidades eliminadas o fraccionadas. Fechas, caducidad y volúmenes de
esta fixture son ilustrativos, no reglas clínicas de conservación.

## Referencias y límites

- Captura EG010-FR02 aportada: fecha/hora, personas presentes, número de unidad,
  ABO, Rh, hemocomponente, causa y dos firmas/sellos físicos.
- BPMN aportado `EG10-PC01_Eliminación_de_unidades.bpmn`: unidades vencidas,
  circuito abierto, unidades de bajo volumen, bolsas rotas, unidades con serología
  reactiva, unidades con anticuerpos séricos irregulares positivos, hemólisis y
  ruptura de la cadena de frío. No se añade "Otro": no figura en ese listado.
- SQL aportados `DDL_Banco_Sangre.sql` y `DDL_Banco_y_Nucleo.sql`: `banco_unidad`
  separa `estado_actual_concept_id` de `resultado_tamizaje_actual_concept_id`,
  ambos referidos a `concept`. Por decisión del usuario se conserva esa separación
  en la UI; Reactiva/No reactiva son resultados de tamizaje, no sustituyen el estado
  operativo. El DDL no contiene un catálogo completo ni un ENUM de estados:
  sus comentarios mencionan APTO, ELIMINADA, POR_TRANSFERIR, EN_TRANSITO,
  TRANSFERIDA y RESERVADA_PARA_TRANSFUSION. Los nombres/estados del mock no son
  el catálogo clínico definitivo; el backend deberá mapear estados y causas a
  conceptos configurables y validar sus transiciones.
- `criterios_calidad.md`, EG05-CC10 y CC16: inspección final, integridad de bolsas
  y apariencia. CC17 B: revisión de registros y sello de garantía de calidad en
  la liberación. Imprimir o marcar `APTO` no autoriza una transfusión; se
  mantienen las comprobaciones posteriores de compatibilidad y liberación.

El sello es una propuesta de UI, no un formato oficial validado. Los imprimibles
incluyen marca DEMO/no válido para uso clínico y escapan texto del usuario.
No implementan firma electrónica, ISBT 128, impresora validada, archivo PDF
documental ni auditoría clínica. Actas extensas pueden ocupar varias páginas:
no se recortan filas para forzar el “Hoja 1 de 1” de la captura. Se conserva la
distribución del formato, no se afirma aprobación institucional ni equivalencia
documental. Los borradores impresos se identifican como pendientes de registro.

El navegador no verifica impresión física: cancelar y `afterprint` no prueban
éxito. Se controla una solicitud por proceso en esta pestaña; no se impiden
copias adicionales, copias de un PDF ni duplicados en otra sesión. Si falla o
cancela, no confirmar: queda pendiente y se puede retomar su confirmación, no
su impresión. Reimpresión supervisada/cancelación auditada requieren otro
contrato. `sessionStorage` se pierde al cerrar la pestaña; no sustituye la base
de datos ni el archivo clínico.

## Backend y validación pendientes

`useMockData=false`: el nuevo adaptador falla de forma segura, sin escrituras.
El GET legado conserva su contrato pero no habilita estos flujos. Los endpoints
son propuestas, no capacidades desplegadas. El OMOD deberá aplicar autorización
específica, validar calidad/identidad/caducidad/revisión/idempotencia, registrar
estados y movimientos de todo el lote en una transacción y archivar actas/sellos.
React no puede certificar comprobaciones físicas ni sustituir la revisión clínica.
No hay migraciones, datos OpenMRS ni cambios de repositorios backend.

Validación mínima: `lint`, `typescript`, `test` y build del workspace. Si hay
servidor de desarrollo abierto, construir con `--output-path` a un directorio
temporal nuevo para no limpiar su `dist`. Regresiones: filtros/selección,
permisos denegados sin lecturas, guardado parcial, sello único y confirmación,
cancelación/fallo de impresión, acta obligatoria, atomicidad, historial,
laboratorio, concurrencia, errores e idiomas. Smoke local con Carbon/ESM reales,
sesión/RBAC sintéticos y sin PHI ni llamadas OpenMRS.

El gate E2E clínico integrado sigue `BLOCKED` hasta contar con OMOD/content,
DEV/QLTY coordinado y cuentas autorizadas. Rollback: revertir los cambios del
ESM; no borrar historiales ni almacenamiento de otros flujos. No hay datos
OpenMRS que restaurar.

### Evidencia local inicial — 2026-10-06 (anterior al filtro de tamizaje)

Diff sin commit en `bloodBank`, HEAD base
`eae074276`. Windows, Node 24 y Yarn 4.13.0; solo datos sintéticos.
Las validaciones se ejecutaron contra estas fuentes modificadas, no contra
una imagen desplegada ni una sesión clínica de OpenMRS.

| Estado  | Comando / caso                                                                                                              | Resultado y alcance                                                                                                                                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | Workspace `lint`, `typescript`, `test`                                                                                      | Exit 0; lint 133 archivos; 283/283 pruebas en 24 archivos, incluidos los consumidores de impresión, cierre y fraccionamiento.                                                                                               |
| PASSED  | Workspace `build --output-path` a directorio temporal nuevo                                                                 | Exit 0; dos advertencias de tamaño; hash del bundle de desarrollo idéntico antes/después de cada build aislado.                                                                                                             |
| PASSED  | `validate:workspaces`, `validate:critical-route-privileges`, `validate:react-router`, `validate:error-exposure --base HEAD` | Exit 0; comprobaciones de workspaces; 15 apps críticas fail closed; contrato de router; cero exposiciones en 20 fuentes cambiadas.                                                                                          |
| PASSED  | Playwright/Edge headless, 1440×1000, 768×1000 y 375×1000                                                                    | Dos sellos en una solicitud, sin APTO previo a confirmación; segundo sello bloqueado; acta de dos unidades, cancelar/aceptar, salida de stock e historial imprimible; cero errores de página y peticiones externas.         |
| PASSED  | Vista e impresión mock                                                                                                      | Capturas inspeccionadas de inventario, sellos y acta; contenidos reales de iframe con marca DEMO. `window.print` simulado: no se certifica impresión física. Foco confinado/restaurado y sin overflow horizontal de página. |
| PASSED  | Formato Markdown y `git diff --check`                                                                                       | Exit 0; documentos del paquete y del inventario.                                                                                                                                                                            |
| NOT RUN | CI/PR y verificación posterior a commits                                                                                    | No se solicitó crear commits ni abrir un PR en esta tarea.                                                                                                                                                                  |
| BLOCKED | Gate E2E clínico integrado                                                                                                  | Adaptador OMOD deshabilitado; faltan contratos desplegados y entorno DEV/QLTY coordinado con cuentas autorizadas. El smoke mock no lo reemplaza.                                                                            |

Los smokes usaron una fixture temporal fuera de Git con componentes reales del
ESM/Carbon y sesión/RBAC sintéticos, no un standalone del producto. Los
contextos se cerraron y su almacenamiento sintético se descartó; el servidor
temporal se detuvo. No se tocaron Docker, el login ni el servidor del usuario.

Advertencias de build: main 518,464 KiB, vendor 259,555 KiB y chunk 247,465 KiB
superan el umbral recomendado. No se verificaron como preexistentes en
`origin/main`; no se cambian dependencias para resolverlas en este alcance.

### Ajuste de selección por tamizaje — 2026-10-06

Diff actual sin commit en `bloodBank`, misma base `eae074276`, Windows/Node 24/Yarn 4.13.0.
La evidencia inicial anterior no sustituye esta nueva ejecución.

| Estado  | Comando / caso                                                                                                              | Resultado y alcance                                                                                                                                                                                                                                                                                                               |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | Scripts del workspace `lint`, `typescript`, `test`                                                                          | Exit 0; lint 134 archivos; 287/287 pruebas en 24 archivos. Incluye filtro exclusivo no reactivo, selección previa mixta, botón solo en popups, eliminación reactiva, datos aditivos y conservación de resultados/caducidad/stock retirado.                                                                                        |
| PASSED  | `build --output-path` a temporal nuevo                                                                                      | Exit 0; hash del bundle de desarrollo conservado. Dos advertencias de tamaño: main 522,142 KiB, vendor 259,555 KiB y chunk 251,143 KiB; no verificadas como preexistentes.                                                                                                                                                        |
| PASSED  | `validate:workspaces`, `validate:critical-route-privileges`, `validate:react-router`, `validate:error-exposure --base HEAD` | Exit 0; 15 apps críticas fail closed; cero exposiciones en 20 fuentes cambiadas.                                                                                                                                                                                                                                                  |
| PASSED  | Playwright/Edge headless: 1440×1000, 768×1000 y 375×1000                                                                    | 3/3 recorridos: tres no reactivas y dos reactivas nuevas; popup sin pendientes/reactivas ni columna Verificación; selección filtrada solo dentro del popup; sello único de dos unidades con APTO explícito; eliminación e historial conservados. Cero errores de página, peticiones externas y overflow horizontal de página.     |
| PASSED  | Inspección visual e impresión mock                                                                                          | Capturas del selector no reactivo y stock; iframe real con dos sellos y marca DEMO. `window.print` simulado, sin certificar impresión física. Contextos cerrados y datos sintéticos descartados.                                                                                                                                  |
| FAILED  | Intentos iniciales del harness visual temporal                                                                              | Selectores de la prueba asumían nombre exacto de un botón danger y filas fuera de la primera página al añadir fixtures. Se corrigió únicamente el harness fuera de Git, usando texto del botón y búsqueda PFC; se repitió completo el recorrido con las mismas comprobaciones funcionales y pasó. No se atribuye a `origin/main`. |
| BLOCKED | E2E clínico integrado                                                                                                       | Sin OMOD/content implementados ni entorno DEV/QLTY coordinado; el smoke sintético no demuestra integración clínica.                                                                                                                                                                                                               |

No se añadieron servicios standalone, escrituras OpenMRS ni cambios globales.
La sesión sintética usa acceso completo al ESM; los tests del guard mantienen
el caso denegado sin lecturas. Las fixtures y el servidor visual son temporales
fuera de Git; se detuvo ese servidor sin tocar Docker ni el frontend del usuario.

La compilación Sass del harness también avisó de deprecaciones en Carbon;
no se verificaron como preexistentes en `origin/main`. No se modificaron
dependencias ni estilos globales para silenciarlas.

### Eliminación en tres pasos — 2026-10-06

Diff sin commit en `bloodBank`, base `eae074276`; Windows, Node 24, Yarn 4.13.0.
La evidencia anterior es histórica y no sustituye esta ejecución. No se cambió
el contrato separado de estado/tamizaje, de acuerdo con la decisión del usuario.

| Estado  | Comando / caso                                           | Resultado y alcance                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | Workspace `lint`, `typescript`, `test`                   | Exit 0; lint 136 archivos; 291/291 pruebas en 24 archivos. Nuevas regresiones: selección guardada antes de causas, ocho opciones por fila, causa obligatoria, Anterior, impresión sin salida de stock, error de impresora seguro, causas históricas y CSS de impresión SSR con datos escapados.                                                                                                                                                                                  |
| PASSED  | Workspace `build --output-path` a temporal nuevo         | Exit 0; hash del bundle de desarrollo conservado. Dos advertencias de tamaño: main 527,254 KiB, vendor 259,555 KiB y chunk 256,255 KiB. No verificadas como preexistentes en `origin/main`.                                                                                                                                                                                                                                                                                      |
| PASSED  | `validate:error-exposure --base HEAD`                    | Exit 0; 22 fuentes cambiadas, cero exposiciones.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| PASSED  | Playwright/Edge headless, 1440×1000, 768×1000 y 375×1000 | Flujo con dos unidades: selección → causas obligatorias → revisión e impresión como borrador → cancelar/confirmar registro → salida del stock y acta histórica. Continúa cubriendo sello único y transición APTO explícita. Cero errores de página, peticiones externas y overflow horizontal de página.                                                                                                                                                                         |
| PASSED  | Impresión HTML real a PDF y revisión visual con Poppler  | Acta sintética de dos unidades: 1 página A4; caso de estrés visual con 45 filas: 3 páginas, cabeceras repetidas, numeración correcta y firmas sin recortes. No se certifica impresión física ni aprobación del formato institucional.                                                                                                                                                                                                                                            |
| FAILED  | Intentos intermedios locales, corregidos y repetidos     | La prueba nueva esperaba un mapa vacío en lugar de claves con causas vacías; lint detectó filas vacías con aria-hidden y claves por índice. La revisión detectó comillas CSS escapadas por SSR, corregidas con CSS fijo y una excepción Biome documentada exclusivamente para ese estilo, sin datos del usuario. El analizador de errores confundió la variable de causa de eliminación con Error.cause; se aclaró su nombre de dominio. No se atribuyen a fallos preexistentes. |
| FAILED  | Un intento móvil del harness temporal                    | Notificaciones interceptaron un clic y hubo recarga mientras se ajustaba el código. Se repitió el mismo recorrido móvil, sin cambios ni relajación de aserciones, y pasó. No se considera demostrado como fallo de `origin/main`.                                                                                                                                                                                                                                                |
| NOT RUN | CI/PR y verificación posterior a commits                 | No se solicitó crear commits ni publicar un PR.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| BLOCKED | Gate E2E clínico integrado                               | Falta adaptador OMOD/content implementado y entorno DEV/QLTY coordinado con cuentas autorizadas. Los mocks no demuestran persistencia ni autorización clínica del backend.                                                                                                                                                                                                                                                                                                       |

Pruebas sin PHI, con sesión sintética y componentes reales ESM/Carbon; contextos
cerrados y almacenamiento descartado. PDFs/capturas/harness quedaron fuera de Git;
el servidor temporal de QA se detuvo, sin tocar Docker ni el frontend del usuario.
La paginación y su numeración se comprobaron en Edge; otras impresoras/navegadores
requieren su propia validación. No se añadieron dependencias, UUIDs ni migraciones.

### Corrección de impresión y acciones del pie — 2026-10-06

Mismo diff sin commit en `bloodBank`, base `eae074276`.

| Estado  | Validación                                                           | Evidencia                                                                                                                                                                                                                                                                                                                                                  |
| ------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FAILED  | Diagnóstico previo con el bundle de desarrollo y React de producción | Reproducción sintética de `TypeError` al leer `ReactDebugCurrentFrame.getCurrentStack` en `react-dom/server`; no se atribuye a un fallo preexistente de `origin/main`.                                                                                                                                                                                     |
| PASSED  | Mismo diagnóstico con el helper corregido                            | El bundle de desarrollo prepara el acta usando React/ReactDOM compartidos de producción; conserva filas y comillas CSS. Fixture temporal fuera de Git, sin backend.                                                                                                                                                                                        |
| PASSED  | Workspace `test`, `lint`, `typescript`                               | Exit 0; 292/292 pruebas en 24 archivos y lint 136 archivos. Regresión del renderer servidor incompatible, preparación HTML, escape de texto, CSS, foco, acciones del pie y consumidores de procesamiento.                                                                                                                                                  |
| PASSED  | Build aislado                                                        | Exit 0; `dist` del servidor de desarrollo conservado. Dos advertencias de tamaño: main 527,657 KiB, vendor 259,633 KiB y chunk 256,592 KiB, no verificadas como preexistentes.                                                                                                                                                                             |
| PASSED  | Navegador local aislado, componentes reales ESM/Carbon               | Borrador sintético de acta; preparación de iframe y llamada a imprimir capturada sin error visible ni logs de error. Botón `ghost` azul comprobado visualmente y por geometría a 16 px del borde izquierdo del pie. La inspección detectó que Carbon alineaba el pie a la derecha; la corrección se limita a Inventario. No se certifica impresión física. |
| BLOCKED | Integración clínica / impresión física                               | Sin OMOD/content desplegados ni entorno DEV/QLTY coordinado; el smoke mock y la captura de `print` no sustituyen esa validación.                                                                                                                                                                                                                           |

El navegador y servidor de QA son temporales; se cerraron al terminar. No se
reinició el frontend del usuario, no se crearon commits ni se borraron sus datos.
