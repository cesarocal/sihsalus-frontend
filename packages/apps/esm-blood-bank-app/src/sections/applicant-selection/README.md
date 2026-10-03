# Selección del postulante

## Alcance

Primera etapa navegable del Banco de Sangre, con datos mock. Selección termina al guardar la revisión; el flujo posterior vive en [Extracción](../collection/README.md) y Laboratorio / Tamizaje. No modifica roles, login ni componentes globales.

Los mensajes distinguen creación/actualización del borrador y guardado de cada etapa; solo la revisión final anuncia selección o exclusión. Indican **en esta pestaña**, no en OpenMRS. Al salir de una postulación guardada sin nuevas ediciones, no se escribe ni se anuncia un guardado. Un error conserva los cambios en el formulario. Consulte el [contrato de texto y guardado](../../../TEXT_AND_SAVE_CONTRACT.md) para los límites aún pendientes y la evidencia del ajuste.

## Organización

- `applicant-selection-page.component.tsx`: listado, búsqueda por identidad, filtros por estado/modalidad y paginación.
- `selection-workflow.component.tsx`: apertura del formulario, seis etapas, guardados, revisión de antecedentes y confirmación de salida.
- `selection-stage-fields.component.tsx`: campos de cada etapa; preguntas condicionales y bloque para mujeres.
- `selection-fields.ts`: catálogo de preguntas y campos/unidades.
- `selection-rules.ts`: validaciones de captura, fechas, exclusiones y avisos orientativos.
- `selection.types.ts`: DTO del formulario. Los estados en inglés son claves locales, no IDs de conceptos OpenMRS.
- `selection-report.component.tsx`: resumen completo e impresión A4 aislada del shell, sin captura de firmas.
- `selection.scss`: tokens Carbon/styleguide, grillas, tabla y estados UI.
- `../../../translations/{es,en}.json`: textos de UI; `selection-messages.ts` aporta valores de respaldo mientras carga la traducción.
- `../../api/applicant-selection.api.ts`: interfaz y rutas propuestas para la futura integración. Los adaptadores reales están deshabilitados.
- `../../api/mock-applicant-selection.api.ts`: persistencia de prueba por pestaña, secuencia, control de versiones y bloqueo de etapas cerradas.
- `../../mocks/applicant-selection.mock.ts`: perfiles y postulaciones ficticias.
- `*.test.ts(x)` y `../../api/mock-applicant-selection.api.test.ts`: regresiones de formulario, reglas, estados y persistencia.

El privilegio existente `app:home.bancoSangre.seleccionPostulante` protege la ruta, además del privilegio de entrada del módulo.
Se revisó `esm-patient-vitals-app/src/vitals-biometrics-form/vitals-biometrics-form.workspace.tsx`: captura estos signos, pero depende de un paciente/visita, metadatos y persistencia real de encuentros. No se invoca desde el mock. Se reutilizan los controles Carbon, etiquetas/unidades y tokens del styleguide sin alterar ese workspace.
No se introducen permisos por etapa en este cambio. En producción deberán verificarse permisos de lectura/escritura y transiciones en el backend, no solo ocultar controles.

## Flujo y guardado parcial

1. Nueva Postulación abre Admisión. Guardar asigna un número secuencial ficticio; completar Admisión marca Admitido.
2. Datos personales se autocompletan cuando existe identidad de prueba. Son editables hasta cerrar el examen físico.
3. Examen físico captura valores y observaciones. Advertencias permiten revisar valores, continuar la entrevista con justificación, o detener el proceso y registrar una exclusión.
4. Al completar el examen para continuar, la postulación entra en Pendiente de entrevista y se vuelve al listado.
5. Entrevistar abre Admisión en consulta; Siguiente recorre las tres etapas bloqueadas hasta la entrevista editable.
6. Precalificación registra Apto, No apto temporal o No apto permanente, nombres, colegiatura, revisión de jefatura cuando es apto y observaciones. La temporal requiere duración y calcula retorno por días/meses/años calendario.
7. Revisión permite imprimir y guardar el resultado. Solo Apto queda Seleccionado. El formulario detenido omite la entrevista y queda No apto.

Guardar y salir conserva incluso un paso incompleto. La X utiliza `../../shared/exit-confirmation.component.tsx`: **Seguir editando / Salir**, con **Guardar el avance antes de salir** marcado por defecto. Desmarcar la casilla descarta solo la edición pendiente, nunca el registro previo. Si falla el guardado, el formulario conserva sus datos y muestra el error; durante el envío no se permite cerrar ni duplicar el guardado. La confirmación se reinicia con guardado activado cada vez que se abre. Las tres decisiones del aviso clínico del examen físico no cambian.
La finalización no se puede repetir ni editar; los guardados con una revisión antigua fallan sin sobrescribir otra versión.
Las tres primeras secciones se bloquean también en el adaptador mock, no solo en los inputs.
El motivo de exclusión se guarda en el formulario pero no lo devuelve la consulta de antecedentes de admisión.
Un antecedente vigente bloquea la finalización Apto. Una exclusión temporal termina en su fecha de retorno (ese día ya no está vigente).

`sessionStorage` usa la clave `sihsalus.blood-bank.selection.mock.v1`. Solo datos ficticios; persiste al recargar la misma pestaña, no al cerrarla.
Para reiniciar exclusivamente estos datos, ejecute en DevTools:

```js
sessionStorage.removeItem("sihsalus.blood-bank.selection.mock.v1");
sessionStorage.removeItem("sihsalus.blood-bank.processing.mock.v1");
location.reload();
```

Para reiniciar todo el flujo, limpie ambas claves mock juntas: el segundo almacén conserva extracciones y muestras que referencian las postulaciones.
No se modifica el almacenamiento de sesión/login. Un fallo de almacenamiento se muestra como guardado fallido, sin fingir éxito.
Las confirmaciones y resúmenes de error tienen nombres accesibles y foco; los inputs tienen etiquetas y unidades.

## Mapeo futuro al modelo entregado

| Datos del DTO                       | Destino previsto                                                                        | Pendiente de contrato                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Identidad/demografía                | `person`, `person_name`, `person_address`, `patient_identifier` / atributos pertinentes | Resolver identidad y tipo/UUID de identificador sin duplicar personas                             |
| Cabecera de postulación             | `banco_postulante` + `patient_id` / `visit_id`                                          | UUIDs, tipo/modalidad/estado como conceptos, numeración y beneficiario                            |
| Signos, entrevista, precalificación | `encounter` + `form` + `obs`                                                            | Catálogo de conceptos y unidades, grupos de obs, formulario/versionado, proveedores y responsable |
| Exclusión y retorno                 | Estado/fecha de retorno operativa y obs de evaluación                                   | Reglas, revisión médica, trazabilidad y alcance de lectura del motivo                             |
| Donante                             | `banco_donante`, únicamente después de donar                                            | No se crea al seleccionar un postulante                                                           |

El SQL hace autoincremental `banco_postulante_id`, **no** `numero_postulante` (varchar). La numeración visible requiere generación atómica y unicidad en el servicio/DDL; el mock no garantiza secuencias entre pestañas/usuarios.
No asuma que el código de donante es la PK: el DDL no especifica esa columna en `banco_donante`. Hay que acordar el identificador del dominio.
`patientUuid` y `visitUuid` son referencias previstas del DTO; las cadenas `mock-*` no son UUIDs reales.
Los nombres de entrevistador/jefatura se capturan como texto para el prototipo. En el servicio deben vincularse a `provider`/usuario autenticado, conservando auditoría.
No se ejecuta DDL ni se crean conceptos. Las rutas REST propuestas requieren implementación en un OMOD y validación antes de habilitarse:

- GET `/ws/rest/v1/bloodbank/applications`
- GET `/ws/rest/v1/bloodbank/applicants/history`
- Guardados parciales y finales bajo `/ws/rest/v1/bloodbank/applications/:id/{draft,steps,selection}`

El backend deberá cubrir autenticación, autorización por operación, minimización de datos, validación clínica, transacciones, numeración, concurrencia e idempotencia. Los métodos HTTP/cuerpos/errores todavía no son un contrato publicado.

## Fuentes y límites clínicos

Se revisaron `Informe_modelo_Banco_de_Sangre.pdf`, ambos DDL, `criterios_calidad.md` y los formatos aportados.
El formulario toma como base el **Anexo 1 de la RM 241-2018/MINSA** en `formatoSeleccionPostulante.pdf`, páginas PDF 28–29 (impresas 25–26). Se mapearon sus 20 preguntas principales, cinco detalles condicionados por Sí, tipos de ITS y bloque para mujeres.
El `formatos.pdf` de PRONAHEBAS incluye el antiguo EG05-FR01 (página PDF 14); no se mezclan sus preguntas con el Anexo 1 de 2018.

Los avisos de signos usan la sección 6.2 de la guía suministrada: peso 50 kg, presión de referencia 100–140 / 60–90 mmHg, pulso 50–100, temperatura oral 37,5 °C, Hb/Hct por sexo al nivel del mar.
Son **avisos orientativos**, no una evaluación exhaustiva ni una autorización para donar. La guía admite excepciones y criterios específicos que este prototipo no implementa (p. ej. deportistas, altitud, aféresis o autóloga).
Continuar la entrevista requiere justificar una alerta; no convierte un hallazgo en normal. Se impide marcar Apto con sistólica ≥180 mmHg conforme al texto proporcionado.
Las respuestas de entrevista no calculan automáticamente aptitud: la precalificación y validación son explícitas.

Se comprobó la [resolución MINSA](https://www.gob.pe/institucion/minsa/normas-legales/187434-241-2018-minsa), que registra modificaciones posteriores (440-2018, 129-2020, 212-2022).
**Antes de uso clínico**, el equipo del banco debe validar la versión normativa vigente, todas las reglas/umbrales/excepciones y el documento final. La impresión es una adaptación imprimible, no una reproducción oficial pixel a pixel.
Se imprime todo el contenido registrado y espacios para firma/sello/huella en físico, con marca visible de prototipo. No hay firma digital, envío de correo ni PDF archivado en backend.

## Pruebas de aceptación (solo sintéticos, fuera de producción)

- Crear postulación, completar las primeras tres etapas y comprobar que aparece Entrevistar.
- Revisar Admisión/Datos/Examen sin poder editar; responder entrevista y detalles afirmativos.
- Usar DEMO-002 / DNI 90000002: autocompletado editable, bloque de mujer y exclusión hasta 2099-12-31 sin motivo visible en admisión.
- Usar DEMO-003 / DNI 90000003: advertencia permanente e impedir resultado Apto.
- Registrar sistólica 181: advertencia, justificar continuación o detener; no permitir resultado Apto.
- Guardar con X, recargar en la misma pestaña y retomar; comprobar error seguro si falla el almacenamiento.
- Precalificar temporal con duración; revisar retorno, guardar No apto y no enviar a extracción.
- Precalificar apto con validación; imprimir formato y guardar Seleccionado, no Donante.
- Probar la URL con y sin el privilegio de sección.
- Limpiar únicamente la clave mock indicada al terminar.

Rollback: revertir el cambio del ESM y desplegar su versión anterior. No hay migración ni cambio de datos OpenMRS.

## Evidencia local (2026-10-02)

Validaciones sobre los cambios sin commit de `bloodBank`, base `59e8102087c7614f773eeb9c8c6239fc944fbff5`. No son evidencia de despliegue ni de validación clínica en DEV/QLTY.

| Estado  | Comando o caso                                                                                      | Resultado / alcance                                                                                                                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app lint`                                                  | Exit 0, 63 archivos                                                                                                                                                                                                   |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app typescript`                                            | Exit 0                                                                                                                                                                                                                |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test`                                                  | Exit 0, 66/66 pruebas en 8 archivos                                                                                                                                                                                   |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build`                                                 | Exit 0; dos advertencias de tamaño (main ~360 KiB y vendor ~255 KiB). No verificadas como preexistentes                                                                                                               |
| PASSED  | `yarn validate:workspaces`, `yarn validate:critical-route-privileges`, `yarn validate:react-router` | Exit 0; controles del repositorio, sin cambios de registros globales                                                                                                                                                  |
| PASSED  | `yarn validate:error-exposure --base HEAD`                                                          | Exit 0, 15 fuentes cambiadas; cero exposiciones                                                                                                                                                                       |
| PASSED  | `yarn prettier --check` sobre los dos README y `selection.scss`; `git diff --check`                 | Exit 0                                                                                                                                                                                                                |
| PASSED  | Smoke Playwright local con Edge headless, 1440×1000 y 768×1024                                      | Cuatro grupos de casos: borrador/X/cancelación/recarga; revisión bloqueada/entrevista/apto/impresión; autocompletado/exclusión/detención; layout tablet. Cero errores de navegador; almacenamiento sintético limpiado |
| NOT RUN | E2E clínico integrado con sesión, contenido y backend OpenMRS                                       | No hay OMOD/contrato de persistencia de selección implementado; este incremento es exclusivamente mock                                                                                                                |

El smoke utilizó una fixture temporal fuera del repositorio, componentes reales Carbon/PageHeader y stubs de configuración/traducción, sin sesión ni peticiones a OpenMRS. No se añadió un modo standalone al módulo. El servidor temporal se detuvo al terminar.
Se inspeccionó visualmente el listado, admisión, precalificación, tablet y documento imprimible. Se comprobó la invocación de impresión en iframe, no una impresora física ni archivado de un PDF.
