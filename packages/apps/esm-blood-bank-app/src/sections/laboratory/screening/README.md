# Tamizaje: colas e informes por origen

Prototipo navegable con datos sintéticos y persistencia por pestaña. No es un
registro clínico ni una calificación biológica de producción.

## Pantalla y flujo

- **Donantes** reúne muestras postextracción y muestras asociadas a postulaciones
  de aféresis. **Seguimientos** reúne muestras de seguimiento al donante o receptor.
- Cada pestaña conserva sus propios filtros de estado/origen y búsqueda por
  muestra, unidad, postulación, documento o nombre. La cola muestra solo muestras
  pendientes/en proceso, ordenadas por fecha de toma ascendente, con paginación.
- **Historial de informes de resultados** abre un modal exclusivo de esa categoría:
  informes validados, más recientes primero, búsqueda y filtro de resultado.
  **Ver resultados** muestra el informe de solo lectura dentro del mismo modal;
  permite imprimir y volver al historial sin perder su búsqueda.
- Solo Donantes permite **Registrar muestra de aféresis**:
  1. Buscar y asociar una postulación de aféresis en curso.
  2. Revisar la identificación autocompletada, sin editarla.
  3. Confirmar el registro y consultar/imprimir la etiqueta del tubo.
     La confirmación guarda la muestra antes de habilitar la impresión. Reimprimir
     no crea otra muestra. Mientras permanezca en la cola, su formulario de tamizaje
     permite volver a imprimir la etiqueta.
- El registro conserva el avance de asociación; al reabrirlo vuelve a la revisión.
  La X utiliza la confirmación compartida **Seguir editando / Salir**, con guardado
  opcional del avance. Un fallo no muestra éxito ni descarta la selección.
- Recepción, siete pruebas con trazabilidad del reactivo y validación reutilizan
  el flujo existente. Validar retira la muestra de la cola y la incorpora al
  historial de su origen, sin liberar una unidad ni diagnosticar una infección.

## Archivos y contratos

- `screening-page.component.tsx`: pestañas, colas, filtros y acciones.
- `screening-history.component.tsx`: historial y detalle consultable/imprimible.
- `apheresis-sample-workflow.component.tsx`: registro en tres etapas.
- `apheresis-documents.component.tsx`: revisión y etiqueta imprimible.
- `screening-workflow.component.tsx` y `screening-report.component.tsx`: recepción,
  pruebas, validación y documento de resultados existentes.
- `screening.types.ts` y `screening-rules.ts`: procedencia y clasificación.
- `../../../api/blood-bank-processing.api.ts`: contratos de `ScreeningApi` y rutas
  propuestas para el OMOD. **No hay endpoints implementados** en este cambio.
- `../../../api/mock-blood-bank-processing.api.ts`: implementación sintética;
  `../../../api/mock-processing-store.ts`: almacenamiento atómico por pestaña.

Cada muestra tiene un origen discriminado, no una asociación múltiple ficticia:

| Origen           | Asociación                                                  | Categoría    |
| ---------------- | ----------------------------------------------------------- | ------------ |
| `postExtraction` | `collectionId`; unidad y código de unidad existentes        | Donantes     |
| `apheresis`      | `applicationId`; sin unidad ni extracción ficticias         | Donantes     |
| `followUp`       | `followUpId` y sujeto donante/receptor; sin unidad ficticia | Seguimientos |

Los registros mock anteriores sin `origin` se consideran postextracción **solo
si conservan colección y unidad**. Se mantiene la clave y versión del storage,
sin resetear borradores ni inyectar fixtures en datos ya guardados. Los orígenes
desconocidos no se incorporan a ninguna cola.

`ApheresisCandidate` es una proyección mínima para laboratorio: identificadores,
revisión, nombre, documento, fecha de admisión, tipo y código de donante. No expone
entrevista, causas de exclusión ni antecedentes sensibles. El mock admite estados
admitido, pendiente de entrevista, en entrevista, pendiente de precalificación y
seleccionado; excluye borrador, diferido/excluido y postulaciones que ya tienen su
muestra de aféresis. Esto permite asociar una muestra; **no declara aptitud**.

El adaptador vuelve a consultar la postulación al guardar/confirmar y comprueba
revisiones; obtiene la identidad canónica en vez de confiar en campos enviados
por la UI. La asociación guardada y la muestra se actualizan en una única escritura
de storage. Una repetición de la confirmación devuelve la misma muestra. Por ahora
se admite una muestra de aféresis por postulación; rechazos, reemplazos y múltiples
tubos requieren un contrato posterior.

## Datos de demostración y backend pendiente

En una sesión mock nueva hay:

- `M-DEMO-001`: muestra postextracción pendiente.
- `M-SEG-DEMO-001`: muestra de seguimiento al donante pendiente; no implica que
  la pantalla de Seguimientos ya genere registros.
- Postulación `000001`, documento ficticio `90000010`: admitida para aféresis y
  disponible para probar el registro. El contador de postulaciones no cambia.

Los historiales empiezan vacíos; se llenan al validar los tamizajes. Si ya existe
storage guardado, se conserva tal cual: pruebe los fixtures en una sesión nueva
sin borrar su avance actual. No utilice personas reales.

La fecha de toma, tipo/recipiente y códigos de la nueva muestra son demostrativos.
La impresión usa el servicio existente, escapa el texto y marca el documento DEMO;
no implementa etiquetas clínicas, códigos de barras normalizados ni archivo PDF.

Antes de habilitar datos reales, el OMOD debe definir persistencia, identificadores,
fecha real de toma, trazabilidad/auditoría, unicidad e idempotencia transaccionales,
borradores por usuario, autorización de lectura/escritura/validación y asociación
al seguimiento o postulación. Debe servir la proyección de laboratorio sin ampliar
la lectura de datos clínicos sensibles. Las rutas propuestas de aféresis están en
`processingEndpoints`; `useMockData=false` continúa fallando de forma segura.

Se conservan la ruta `/blood-bank/laboratory/screening`, el privilegio de entrada
del módulo y `app:home.bancoSangre.laboratorio.tamizaje`; ambas pestañas usan ese
guard existente. No se modifican roles, login, navbar global, visitas, encuentros,
FHIR, tablas ni migraciones. Estos mocks no reemplazan autorización del servidor.

Riesgo local **medio** por los cambios de asociación, borrador y presentación de
resultados; no hay escrituras clínicas. Para revertir el código, recupere el diff
anterior y reconstruya el ESM. No borre storage como parte del rollback: una versión
antigua desconoce los nuevos orígenes y puede mezclar muestras; use una sesión de
pruebas nueva con esa versión. No despliegue estos mocks como flujo asistencial.

## Validación

Ejecutar lint, TypeScript, tests del workspace y build. Las pruebas cubren también
Selección, Extracción, Donantes, guards y el contrato común de salida/guardado.
El smoke local usa el ESM y Carbon reales, pero shell, sesión/RBAC y APIs sintéticos;
no equivale a un smoke clínico integrado contra OpenMRS.

Evidencia local del **2026-10-05**, rama `bloodBank`, base
`05bd13ab71a2f79256b3053c49d146d8cf72dc2b` **más este diff sin commit**.
No se atribuyen estos resultados a un SHA nuevo ni a CI. Comandos ejecutados con
Node 24 y el Yarn 4.13.0 ya instalado (`node .yarn/releases/yarn-4.13.0.cjs`).

| Estado  | Comando o caso                                                    | Resultado                                                                                                                                                                                                                 |
| ------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app lint`                | Exit 0; 107 archivos; sin errores ni warnings de lint                                                                                                                                                                     |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app typescript`          | Exit 0; sin errores                                                                                                                                                                                                       |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test --maxWorkers=2` | Exit 0; 205/205 tests en 19 archivos                                                                                                                                                                                      |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build`               | Exit 0; dos advertencias de tamaño de assets/entrypoint                                                                                                                                                                   |
| PASSED  | `node packages/tooling/scripts/validate-error-exposure.js`        | Exit 0; 13 fuentes modificadas; cero exposiciones en el scope                                                                                                                                                             |
| PASSED  | Smoke Playwright local, Edge headless, viewport 1440/768/375      | Colas/búsquedas independientes; registro en tres etapas; recuperación de borrador tras recarga; etiqueta imprimible; historiales y detalle de solo lectura; sin desbordamiento de página, errores JS ni requests externos |
| PASSED  | `git diff --check`                                                | Exit 0; sin errores de whitespace                                                                                                                                                                                         |
| BLOCKED | Smoke/E2E clínico integrado contra OpenMRS                        | No existen los endpoints OMOD requeridos; no se hicieron escrituras al backend                                                                                                                                            |

Datos del smoke: postulación sintética `000001`, `M-DEMO-001`, `M-SEG-DEMO-001`
y nueva muestra `M-AF-000001`. Se validaron solo registros sintéticos para comprobar
el paso de cola a historial. Limpieza: eliminación de las dos claves mock en el
contexto de prueba y cierre del navegador aislado; no se cambió la sesión del
usuario. Los tests automatizados reinician su storage aislado en cada caso.

Las advertencias del build señalan bundles de aproximadamente 258 y 443 KiB frente
al umbral recomendado de 244 KiB. **No se verificó que fueran preexistentes**;
optimizar esos bundles queda pendiente. No se redujeron gates ni se ampliaron
timeouts para obtener estos resultados.

El gate E2E integrado queda **BLOCKED**: todavía no existe el OMOD de estas APIs,
ni generación real de muestras desde Seguimientos. Se requiere entorno coordinado
no productivo, usuarios autorizados/denegados, datos sintéticos y limpieza antes
de habilitar el flujo clínico.
