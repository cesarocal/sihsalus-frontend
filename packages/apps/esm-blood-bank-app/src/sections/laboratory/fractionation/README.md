# Fraccionamiento

Ruta: `/blood-bank/laboratory/fractionation`. Requiere
`app:home.bancoSangre.laboratorio.fraccionamiento`, además del acceso al módulo
en el shell. El guard existente impide consultar datos sin el privilegio.
No se cambia login, menú global, permisos del backend ni otros ESM.

El acceso de Inicio `?category=eligible&unit=<id>` revalida el ID exacto y
`eligibleSource`, filtra y preselecciona esa unidad. Abrir el enlace no llama a
`api.start` ni crea un lote o cambia estados. El usuario inicia Fraccionar desde
la cola. Una referencia no disponible no selecciona unidades parecidas; muestra
un aviso y permite quitar los filtros. El guard existente sigue siendo necesario.

## Flujo navegable

- Cola de sangre total extraída y PFC en inventario, con búsqueda, filtros,
  paginación y selección por fila. Un lote admite un único tipo de origen;
  no mezcla grupos, unidades ni códigos en un pool.
  **Fraccionar** en Acciones inicia solo esa fila, independientemente de la
  selección del lote; **Deseleccionar** limpia la selección, no los filtros.
- Al iniciar se guarda el proceso y sus orígenes pasan a **En laboratorio**.
  Cerrar no devuelve automáticamente esas unidades al almacén: **Retomar
  fraccionamiento** conserva el proceso y evita iniciar otro sobre el mismo origen.
- **Fraccionamiento**. El responsable se toma de la sesión al abrir el flujo
  y se conserva al continuar. El servicio modificador se obtiene de la
  localidad configurada de OpenMRS. Si no se configuró, se compone con el
  nombre de la ubicación activa de la sesión. Sangre total produce glóbulos
  rojos y plasma líquido o una fracción pediátrica y el remanente con el código
  original. PFC produce factor antihemofílico crioprecipitado y plasma con
  crioprecipitado reducido.
  Para sangre total de 300 a 400 mL se confirma por unidad que el
  anticoagulante se calculó para 450 ± 45 mL. La única división disponible
  produce glóbulos rojos de bajo volumen.
  Una división bloquea todas las opciones de ese nodo hasta **Deshacer división**;
  al deshacer se eliminan sus descendientes y desaparece ese botón.
- **Imprimir etiquetas**. Incluye temperatura, vencimiento editable, ABO y Rh
  destacados y una línea para rotular el volumen. Usa el resultado validado de
  CMV IgG de la extracción de origen, incluida la última ronda validada.
  Reactivo imprime «No», no reactivo «Sí» e indeterminado «Indeterminado».
  Si el resultado cambia antes de finalizar, al retomar se verifica la
  etiqueta nuevamente. Los informes de procesos finalizados son históricos.
- **Completar datos (mL)**: volumen final positivo por componente. Se controla
  el balance por origen. Inventario muestra el volumen registrado y las
  etiquetas impresas desde Etiquetas, Revisión o Historial conservan la línea
  para rotularlo a mano. En glóbulos rojos de bajo volumen se usa la expresión
  del ítem 17 de EG05-TB01.
- **Revisión**: árbol, datos del proceso, resultados y confirmación de integridad,
  aspecto y etiquetas actualizadas. La advertencia final exige aceptación antes
  de registrar la salida de los orígenes como **Fraccionados** y el ingreso de
  los resultados en **Cuarentena**. En la división pediátrica se actualiza
  el volumen de la unidad original sin crear un segundo registro con su código.
  El remanente conserva su estado previo y la fracción entra en **Cuarentena**.
- Historial consultable con búsqueda, estado, detalle y reimpresión final.
  El detalle vuelve al listado con **Volver al historial** y flecha a la izquierda,
  conservando búsqueda y filtro.
  Solo la X superior cierra el historial; no hay otro botón Cerrar en su pie.

## Organización y datos

- `fractionation-page.component.tsx`: cola, selección y acciones.
- `fractionation-workflow.component.tsx`: cuatro etapas y confirmación final.
- `fractionation-tree.component.tsx`: árbol y pictogramas SVG locales de bolsas;
  colores y llenados son ilustrativos, nunca rendimientos o mediciones.
- `fractionation-documents.component.tsx`: revisión y etiquetas imprimibles.
- `fractionation-history.component.tsx`: consulta sin modificación.
- `fractionation-content.component.tsx`: estabiliza el foco por puntero dentro
  de estos modales, evitando que el centrado automático de Carbon pierda el clic;
  mantiene navegación por teclado y el confinamiento de foco del modal.
- `fractionation-format.ts`: formato de fecha/hora compartido de OpenMRS para
  datos de consulta; no cambia los controles nativos de ingreso de fechas.
- `fractionation.types.ts` / `fractionation-rules.ts`: contratos y restricciones.
- `../../../api/fractionation.api.ts`: interfaz y endpoints propuestos para OMOD.
- `../../../api/mock-fractionation.api.ts`: adaptador sintético, concurrencia
  por revisión y actualización atómica del inventario.

Se amplía de forma aditiva el almacenamiento de procesamiento existente,
`sihsalus.blood-bank.processing.mock.v1`, sin borrar extracciones, muestras,
resultados ni borradores anteriores. `sessionStorage` conserva avances al
recargar esa pestaña; no es una base de datos clínica ni un archivo documental.
Dos PFC sintéticos (`PFC-2026-002`, `PFC-2026-003`) permiten probar el lote.
Las extracciones de sangre total guardadas también alimentan la cola.

Un único `setItem` guarda salida, genealogía, entradas y finalización. Un error
de almacenamiento no deja movimientos parciales. Se rechazan lotes mezclados,
orígenes ocupados, identidades alteradas, revisiones antiguas, árboles ilegales,
etapas fuera de orden y volúmenes incompatibles. Repetir Finalizar no duplica
componentes. Cambiar árbol, etiqueta o volumen invalida las etapas posteriores.
El cierre usa **Seguir editando / Salir** y guardado opcional del avance.
El pie del proceso usa **Anterior / Guardar y continuar**, y **Finalizar** en
Revisión; no muestra **Guardar avance**. La impresión sigue disponible desde
Etiquetas. Ocultar esa acción no cambia el guardado opcional al cerrar con la X
ni los botones de otros flujos del ESM.

## Referencias aportadas y límites clínicos

Mapeo de `criterios_calidad.md` y capturas facilitadas por el usuario:

| Referencia                          | Aplicación en este frontend                                                                                                                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EG05-PC06, pasos 01–04              | Registro de componentes previstos, separación, verificación de etiquetas y datos del proceso.                                                                                             |
| EG05-CC07 E12                       | Dos resultados del PFC: crioprecipitado y plasma con crioprecipitado reducido.                                                                                                            |
| EG05-TB01, columna Componente Final | Nombre, código, soluciones, agente si aplica, volumen, servicios, temperatura, caducidad, ABO/Rh, anticuerpos salvo crioprecipitado, instrucciones y expresiones condicionales heredadas. |
| EG05-CC07 A/B y EG05-TB02           | Caducidad editable, sugerida para condiciones conocidas y circuito cerrado. El personal registra la caducidad aplicable si hubo apertura u otras condiciones.                             |
| EG05-CC07 E7                        | Sangre total de 300 a 400 mL con anticoagulante verificado para 450 ± 45 mL produce exclusivamente glóbulos rojos de bajo volumen.                                                        |
| EG05-CC09                           | Revisión manual de bolsas/etiquetas y cuarentena; no equivale a liberación transfusional ni sello de calidad.                                                                             |

Este mapeo **no demuestra cumplimiento normativo ni valida indicaciones
clínicas**. La vigencia del protocolo, métodos, tiempos desde extracción,
congelación/descongelación, condiciones de almacenamiento y criterios de cada
producto requieren revisión del responsable del banco de sangre antes de uso
real. No se certifica automáticamente que una unidad sea PFC por elegirlo en el
árbol. El color no codifica aptitud ni resultados de tamizaje.
El balance mock compara volúmenes contra el origen sin modelar adiciones de
soluciones; su registro y efecto sobre el balance deben acordarse con el OMOD
antes de usar este control en un procedimiento real.
Los árboles históricos con PRP conservan sus nombres, componentes y códigos.
La fecha sugerida se calcula cuando la tabla define un plazo y se dispone de los
datos necesarios. Los registros con fecha sin hora usan el inicio de ese día.
El plasma líquido toma como referencia la caducidad de los glóbulos rojos de la
misma división. Una fecha ingresada manualmente se conserva al cambiar campos.

Se heredan las expresiones de donante voluntario, leucocitos reducidos y uso
autólogo con receptor cuando constan en el origen. No se inventan resultados
CMV, anticuerpos, riesgos biológicos, remuneración, reducciones de leucocitos o
sellos a partir de un tamizaje pendiente. Casos especiales sin información
verificada, pools, componentes industriales, descartes,
cancelación formal, distribución y liberación necesitan flujos posteriores.
Las etiquetas llevan marca de datos ficticios y no implementan códigos ISBT 128,
impresoras validadas, archivo PDF ni recuento/auditoría real de impresión.

## Backend pendiente

`useMockData=false` falla de forma segura: el adaptador no emite solicitudes
de fraccionamiento hasta implementar y validar su capacidad. Endpoints en
`fractionation.api.ts` son propuestas, no contratos desplegados.

La lectura de catálogos usa REST de OpenMRS, con la sesión autenticada, incluso
cuando el flujo guarda por pestaña. Configurar en `@sihsalus/esm-blood-bank-app`:

- `collectionLabelConcepts.anticoagulantSetUuid`: conjunto de anticoagulantes.
- `laboratoryCatalogs.storageTemperatureSetUuid`: conjunto de temperaturas.
- `laboratoryCatalogs.irregularAntibodySetUuid`: conjunto de especificidades.
- `laboratoryCatalogs.modifierLocationUuid`: localidad del servicio modificador.
- `laboratoryCatalogs.cmvIgGConceptUuid`: concepto de CMV IgG. Con el UUID vacío
  se busca el nombre exacto «Anticuerpos IgG contra citomegalovirus (CMV)».

Los conjuntos se consultan mediante `GET /ws/rest/v1/concept/{uuid}` y solo se
muestran miembros activos. La ubicación configurada usa
`GET /ws/rest/v1/location/{uuid}`. Un catálogo ausente o una sesión sin acceso
muestran un aviso en el campo y permiten reintentar la lectura.

Mapeo propuesto de `DDL_Banco_Sangre.sql` / `DDL_Banco_y_Nucleo.sql`:

- `banco_unidad`: identidad, componente, volumen, caducidad y unidad padre.
- `banco_unidad_proceso`: procedimiento de fraccionamiento y su responsable.
- `banco_unidad_proceso_detalle`: orígenes y resultados asociados al proceso.
- `banco_unidad_estado_historial`: cambios de estado y ubicación auditables.
- `banco_unidad_etiqueta`: etiquetas finales y registro de impresiones.

El OMOD deberá resolver conceptos mediante configuración, aplicar RBAC
autoritativo y transacciones sobre todo el lote, controlar revisiones,
idempotencia, inventario/ubicación, calidad y trazabilidad. No hay migraciones
SQL, nuevas tablas ni modificaciones al backend en este cambio.

## Validación mínima

Ejecutar `lint`, `typescript`, `test` y `build` del workspace. Las regresiones
cubren selección homogénea, árbol, balance, reanudación, concurrencia,
fallo de almacenamiento, finalización idempotente, inventario, contenido de
etiquetas, historial, error seguro e idiomas. Los tests de rutas comprueban
acceso permitido y denegado sin lecturas de API.

Prueba visual con datos sintéticos: cola → selección → árbol → etiquetas →
volúmenes → revisión → cancelar/aceptar → inventario/historial, también en
pantalla estrecha. Una prueba local con mocks no reemplaza el gate E2E contra
OMOD/content y entorno DEV/QLTY coordinado; ese gate sigue pendiente hasta
disponer del backend y cuentas de prueba autorizadas. Cerrar la pestaña/contexto
aislado elimina los datos sintéticos; no borrar almacenamiento de otros flujos.

### Evidencia local — 2026-10-05, antes de permitir PRP final

Diff sin commit en `bloodBank`, HEAD base
`05bd13ab71a2f79256b3053c49d146d8cf72dc2b`. Windows, Node 24 y Yarn 4.13.0.
Solo datos sintéticos; ninguna escritura OpenMRS ni acceso a producción.
Evidencia repetida después del ajuste de acciones por fila, deselección,
bloqueo/deshacer, vuelta al historial y guardado desde la X.

| Estado  | Comando / caso                                                                       | Resultado y alcance                                                                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | Scripts del workspace `lint`, `typescript`, `test --maxWorkers=2`, `build`           | Exit 0; lint 120 archivos; 248/248 pruebas en 21 archivos, incluidos consumidores del modal compartido dentro del ESM.                                                                                                                                                     |
| PASSED  | `validate:workspaces`, `validate:critical-route-privileges`, `validate:react-router` | Exit 0; inventario de workspaces válido; 15 apps críticas fail closed; contrato React Router válido.                                                                                                                                                                       |
| PASSED  | `validate:error-exposure --base HEAD`                                                | Exit 0; cero exposiciones de errores técnicos en el alcance cambiado.                                                                                                                                                                                                      |
| PASSED  | Playwright / Edge headless, 1440×1000, 768×1000 y 375×1000                           | Acción por fila, deselección, bloqueo/deshacer de ramas, flecha a la izquierda, ausencia de Guardar avance y guardado con X; lote PFC, árbol anidado, etapas, confirmación, inventario, historial, impresión y recarga. Cero errores de página y cero peticiones externas. |
| BLOCKED | Gate E2E clínico integrado con backend/OMOD/content                                  | No existe el contrato de fraccionamiento desplegado; adaptador real deshabilitado. Coordinar DEV/QLTY y cuenta autorizada cuando se implemente.                                                                                                                            |

La fixture visual temporal usa componentes reales del ESM, Carbon y styleguide,
pero simula sesión, RBAC y traducción. La acción de imprimir genera el documento
real en iframe; el diálogo/driver de impresión se sustituye en headless, por lo
que no valida una impresora física ni una etiqueta clínica. Se inspeccionaron
capturas de árbol e historial. Los contextos se cerraron al terminar, eliminando
sus datos sintéticos; no se añadió un standalone al producto.

El build emite dos advertencias de tamaño: main ~488 KiB y vendor ~258 KiB.
No se presentan como preexistentes sin evidencia sobre `origin/main`.
El baseline `verify:changed` posterior a commits/CI queda NOT RUN: no se pidió
crear commits ni un PR. Estos resultados validan el diff local, no un despliegue.

### Actualización: PRP final — 2026-10-05

Misma rama y HEAD base, con el diff local ampliado. Las regresiones nuevas
verifican que Guardar y continuar admita GR y PRP sin otra división, que las
etiquetas y volúmenes sigan siendo obligatorios y que el PRP entre en cuarentena.
También se conserva el bloqueo de orígenes sin dividir y la exclusividad de las
ramas opcionales PFC/plasma de 24 h. No se cambia el protocolo clínico ni se
habilita una API real.

| Estado  | Comando / caso                                                          | Resultado y alcance                                                                                                                                                                                                     |
| ------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | Workspace `lint`, `typescript`, `test --maxWorkers=2`                   | Exit 0; lint 120 archivos; 250/250 pruebas en 21 archivos.                                                                                                                                                              |
| PASSED  | Build del workspace con `--output-path` en una carpeta temporal aislada | Exit 0; dos avisos de tamaño, main ~487 KiB y vendor ~258 KiB. El hash SHA-256 del bundle de desarrollo se mantuvo idéntico antes/después; no se reemplazó su `dist`.                                                   |
| PASSED  | Playwright / Edge headless, 1440×1000 y 375×1000                        | Una división de sangre total; GR y PRP finales; guardado por etapas; dos etiquetas imprimibles; volumen; revisión; salida del origen e ingreso de PRP en cuarentena. Cero errores de página y cero peticiones externas. |
| BLOCKED | Gate E2E clínico integrado con backend/OMOD/content                     | Adaptador real deshabilitado y contrato no desplegado; requiere coordinación DEV/QLTY y revisión clínica antes del uso real.                                                                                            |

La fixture temporal mantiene componentes/Carbon reales y sesión/RBAC/API
sintéticos. El driver de impresión se sustituye en headless. Cada contexto se
cerró, eliminando sus datos de prueba; no se tocó la sesión del frontend local
del usuario ni se añadió un standalone. La evidencia anterior queda como
histórico del ajuste previo, no como validación de esta ampliación.

Rollback: revertir los cambios de fraccionamiento del ESM y su proyección mock.
No hay migración ni datos OpenMRS que restaurar; no borrar los avances anteriores
del almacenamiento como procedimiento de rollback.
