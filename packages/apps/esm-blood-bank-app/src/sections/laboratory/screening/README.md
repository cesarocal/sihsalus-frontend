# Tamizaje: colas e informes por origen

El flujo de Tamizaje de donantes usa muestras y órdenes de laboratorio en OpenMRS
en modo real. El modo de demostración conserva sus datos sintéticos por pestaña.

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
- Recepción, siete pruebas y validación reutilizan el flujo existente. Validar
  mueve el informe al historial de su origen. La liberación de una unidad se
  controla desde su propio flujo de inventario y calidad.
- Resultados y repetición muestran un reloj de solo lectura. Al guardar los
  resultados se fija la fecha y hora de la prueba. Para muestras de extracción,
  los resultados reactivos iniciales pasan a repetición junto con los
  indeterminados. Inventario usa el resultado reactivo de una repetición
  validada para marcar la unidad como **No apta**.

El acceso de Inicio `?screening=<id>` revalida el ID exacto y exige una muestra
pendiente/en proceso de un origen reconocido. Abre el mismo formulario y activa
su pestaña real, sin guardar ni validar automáticamente. Una muestra ya validada
o inexistente muestra un aviso seguro; cerrar consume la referencia y no reabre
el formulario al refrescar la cola. Se conserva el guard de Tamizaje.

## Archivos y contratos

- `screening-page.component.tsx`: pestañas, colas, filtros y acciones.
- `screening-history.component.tsx`: historial y detalle consultable/imprimible.
- `apheresis-sample-workflow.component.tsx`: registro en tres etapas.
- `apheresis-documents.component.tsx`: revisión y etiqueta imprimible.
- `screening-workflow.component.tsx` y `screening-report.component.tsx`: recepción,
  pruebas, validación y documento de resultados existentes.
- `screening.types.ts` y `screening-rules.ts`: procedencia y clasificación.
- `../../../api/blood-bank-processing.api.ts`: contrato `ScreeningApi` y rutas
  del OMOD para recepción, resultados, validación, repetición y preaféresis.
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

## Persistencia en OpenMRS

Con `useMockData=false`, el OMOD vincula la muestra real a una orden nativa
de Tamizaje en la visita del postulante. El registro de preaféresis se vincula
directamente al postulante. El resultado final conserva las observaciones
codificadas por ensayo, la información sanguínea y las recomendaciones de
evaluación. Los borradores versionados permiten completar el trabajo antes de
validarlo. Cada repetición validada conserva su propia orden y resultados, y
la unidad usa el resultado consolidado junto con los controles de inventario.

Las propiedades del OMOD `bloodbank.screening.encounterTypeUuid` y
`bloodbank.screening.encounterRoleUuid` deben apuntar a metadatos activos del
entorno. `bloodbank.screening.panelConceptUuid` y `bloodbank.screening.careSettingUuid`
permiten configurar el panel y el ámbito asistencial. El OMOD instala el
concepto de CMV IgG que consulta el frontend. Al validar, cada resultado de
CMV IgG queda guardado como una observación codificada del propio ensayo y
enlazada a la ronda de la muestra.
El usuario requiere acceso al laboratorio, perfil de proveedor y permisos de
OpenMRS para las escrituras clínicas de su etapa.

## Datos de demostración

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

Se conservan la ruta `/blood-bank/laboratory/screening`, el privilegio de entrada
del módulo y `app:home.bancoSangre.laboratorio.tamizaje`; ambas pestañas usan ese
guard existente. El OMOD vuelve a comprobar el privilegio y la vinculación clínica
antes de guardar.

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

La prueba de navegador con datos sintéticos contra el OMOD requiere registrar una
muestra desde Extracción o preaféresis, confirmar la recepción, validar el panel,
y verificar el resultado tanto en el historial como en las observaciones de la
orden nativa. Un caso con un ensayo indeterminado permite comprobar la orden de
repetición y el vínculo entre ambos informes.
