# Transferencias de unidades

Prototipo integrado en `/blood-bank/transfers`, protegido por
`app:home.bancoSangre.transferencias` y el permiso de entrada del módulo.
No modifica login, navegación global ni el backend. Los registros sintéticos
se conservan en la misma clave de `sessionStorage` de los demás procesos.

## Alcance navegable

- Pestañas Carbon `contained` bajo la cabecera, siguiendo la composición de
  Interconsultas: **Recibidas / Pendientes** y **Solicitadas**. La primera atiende
  solicitudes de otras instituciones; la segunda genera solicitudes de unidades
  para remitir a otro banco. Cada una conserva su búsqueda, filtros, métricas e
  historial independientes. Historial de solicitudes y Registrar solicitud usan
  el mismo tamaño Carbon y ancho compartido, también al apilarse en móvil.
- La bandeja de recibidas conserva sus tres solicitudes sintéticas y el registro
  manual de documentos recibidos por correo o en físico.
- Solicitadas permite guardar borradores, revisar, generar e imprimir FR09,
  consultar documentos generados y volver a imprimirlos. El estado Generada
  significa que el documento está preparado, no que se haya enviado o recibido.
  No reserva unidades locales ni genera constancia de entrega o entradas del libro.
- Registro parcial y revisión imprimible EG05-FR09. Oficio de solicitud manual.
  La historia clínica externa se conserva junto con la institución solicitante;
  no se inventa un `patientUuid` ni se registra automáticamente un paciente local.
- Atención en dos pasos: revisar solicitud y seleccionar cantidades completas
  por componente/grupo, confirmar reserva y consultar EG05-FR11. El oficio de
  la constancia se ingresa manualmente, antes de reservar. La evaluación requiere
  identificación del profesional y verificación explícita.
- Las candidatas requieren estado APTO, sello, panel original validado no
  reactivo, caducidad vigente y coincidencia con componente/grupo solicitado.
  Se respeta la antigüedad de extracción indicada por la solicitud. El valor
  inicial de cinco días procede del FR09 aportado y es editable; no es una regla
  general de conservación de todos los componentes.
- La coincidencia por grupo/componente no demuestra compatibilidad clínica.
  La revisión profesional y documentación aplicable siguen siendo necesarias.
- Una reserva cambia la proyección de inventario a `Por transferir`. Bloquea
  otras transferencias, eliminación y fraccionamiento de esas bolsas.
- Rechazar exige un motivo y libera todas las reservas anteriores a la entrega.
  Cerrar una constancia preparada conserva la reserva y la acción Entregar.
- Entrega en dos pasos: datos de quien recoge, DNI, profesional que entrega y
  verificación de conservación/documentación; luego constancia y confirmación.
  Registrar el recojo o imprimir no ejecuta la entrega. La fecha de registro del
  recojo y la de entrega confirmada se conservan por separado y automáticamente.
- Por decisión del usuario, el frontend omite En tránsito: al confirmar el
  recojo, las unidades pasan directamente a Transferido, salen del stock activo
  y la solicitud queda Atendida. Este cierre acredita el despacho al transportista,
  no una confirmación independiente de recepción en la institución destinataria.
- El historial incluye búsqueda, fechas, estados, detalle y reimpresión, sin
  repetir la entrega. Los documentos impresos conservan la marca sintética.

## Libro de Transfusiones: registros de transferencia

Referencia visual: EG05-FR10, Libro de Transfusiones, página 24 del PDF de formatos
aportado (folio impreso 41). Sus campos son unidad, sello, receptor, servicio,
historia clínica, médico solicitante, CMP, atendido por y fecha/hora de egreso.
El componente conserva además institución, oficio, hemocomponente, grupo/Rh,
lote, extracción, tamizaje y persona que recoge para permitir trazabilidad.

El historial ofrece una pestaña **Libro de Transfusiones — transferencias**.
Cada entrega genera una entrada administrativa por unidad, con `kind: transfer`.
Médico y CMP se capturan solo si constan en el documento; se muestran como
No consignado si faltan. No se deducen del director ni se crean resultados,
administración al receptor o eventos clínicos de `banco_transfusion`.

El BPMN EG05-PC12 incluye el registro en este libro. El SQL aportado, en cambio,
separa transferencias y transfusiones clínicas. Esta proyección administrativa
atiende el flujo solicitado sin insertar una transfusión ficticia. Su inclusión
en el libro clínico definitivo requiere acordar el contrato del backend.

## Contrato API propuesto

`src/api/transfers.api.ts` define `TransfersApi`, `IncomingTransferPayload`
y `OutgoingTransferPayload`. La generación utiliza `saveRequest` con
`direction: outgoing`; su transición es Borrador → Generada (`issued`).
Las recibidas utilizan `direction: incoming` y conservan sus transiciones.
Los mocks guardados sin `direction` siguen leyéndose como recibidas, sin borrar
datos ni reescribirlos al consultar. No se puede cambiar la dirección de un
registro guardado ni atender/reservar/entregar una solicitud generada localmente.
El canal de recepción solo aplica a recibidas y no acredita el envío de generadas.

El archivo también define las rutas propuestas.
`BloodBankApi.transfers` conecta el proveedor mock o real.
El adaptador real permanece deshabilitado con un fallo seguro. Estos archivos
no crean un servidor HTTP ni reciben solicitudes de otras instituciones.

| Método    | Ruta relativa a `/openmrs`                                  | Propósito                                                                               |
| --------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| POST      | `/ws/rest/v1/bloodbank/transfer-requests`                   | Recibir una solicitud autenticada o generar una local según su dirección y autorización |
| GET       | `/ws/rest/v1/bloodbank/transfer-requests`                   | Bandeja, históricos y proyecciones autorizadas                                          |
| GET/PATCH | `/ws/rest/v1/bloodbank/transfer-requests/:uuid`             | Consultar o guardar borrador                                                            |
| POST      | `/ws/rest/v1/bloodbank/transfer-requests/:uuid/preparation` | Guardar avance de atención                                                              |
| POST      | `/ws/rest/v1/bloodbank/transfer-requests/:uuid/reserve`     | Validar y comprometer todas las unidades                                                |
| POST      | `/ws/rest/v1/bloodbank/transfer-requests/:uuid/delivery`    | Guardar datos de recojo sin despachar                                                   |
| POST      | `/ws/rest/v1/bloodbank/transfer-requests/:uuid/deliver`     | Confirmar despacho, salida y registro administrativo                                    |
| POST      | `/ws/rest/v1/bloodbank/transfer-requests/:uuid/reject`      | Rechazar y liberar reservas                                                             |

El OMOD deberá implementar recepción autenticada por institución, validación de
esquema y catálogos, referencias externas, deduplicación por origen/referencia,
autorización por operación, control de versiones y bloqueo transaccional del stock.
Un reintento no debe duplicar solicitudes, reservas, salidas o entradas del libro.
Las instituciones sin integración seguirán usando registro manual y documentos;
no se envían correos ni se cambia automáticamente el estado de un sistema externo.
El envío por correo, la confirmación remota y la recepción de unidades para una
solicitud emitida quedan para otra entrega; el estado no se actualiza ficticiamente.

## Relación con el modelo aportado

- Solicitud e ítems: operaciones e ítems nativos de Stock Management, extendidos
  por `banco_solicitud_transferencia` y `banco_solicitud_transferencia_item`.
- Atención: transferencia hija vinculada a la requisición y a sus unidades mediante
  `banco_transferencia_unidad_detalle`; la constancia referencia esa transferencia.
- Oficios y constancia: `external_reference` y `banco_constancia_transferencia`,
  manteniendo separados el oficio recibido y el emitido.
- Historial de estados: `banco_unidad_estado_historial`. En este prototipo el
  estado Transferido se conserva en la solicitud/registro; no aparece en stock activo.
- Brechas pendientes: beneficiario externo frente al `patient_id` local obligatorio,
  datos de procedencia y motivos, semántica de entrega/recepción, obligatoriedad
  de impresión del esquema y proyección del libro. No se ejecuta ni modifica el SQL.

## Comprobación local

Para atender la primera solicitud, asigne primero sellos de calidad a las unidades
mock `BB-SELLO-DEMO-001` y `BB-SELLO-DEMO-003` desde Inventario y confirme su impresión.
Ambas quedarán APTO y coincidirán con las dos unidades O+ solicitadas. No se crean
aprobaciones al visitar Transferencias ni se sustituyen paneles previos.
La tercera solicitud no tiene stock coincidente y permite probar el rechazo.

Casos automatizados: cantidades exactas, datos requeridos, grupos/componentes,
deduplicación, conflictos, vigencia al reservar/despachar, reserva exclusiva,
rechazo/liberación, salida y libro idempotentes, fallo atómico de almacenamiento,
impresión sin entrega, cierre/descarte, error seguro, permisos y traducciones.

El gate clínico integrado está BLOCKED: no existe aún el receptor OMOD ni el
contrato definitivo de persistencia. Los smokes mock no acreditan integración,
conservación física, compatibilidad clínica, impresión física ni recepción externa.

### Evidencia anterior a la separación de pestañas

Ejecutado el 14 de octubre de 2026, antes de añadir Solicitadas, en Windows,
con Node 24.19.0 y Yarn 4.13.0. Esta tabla es histórica y no valida el ajuste posterior.
Rama `bloodBank`; cambios sin commit sobre
`f7b8b55f502a1815769b35b621f7955c3177a99d`. Los comandos siguientes corresponden
al diff local, no acreditan un SHA publicado ni la aprobación del PR.

| Estado  | Comando o caso                                                                 | Resultado exacto y alcance                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app lint`                             | Exit 0; 149 archivos; sin diagnósticos.                                                                                                                                                                                                        |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app typescript`                       | Exit 0; comprobación del paquete completo.                                                                                                                                                                                                     |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test` con `TZ=UTC`                | Exit 0; 318/318 pruebas y 26/26 archivos; 111,38 s. Incluye inventario, fraccionamiento y protección de rutas.                                                                                                                                 |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build`                            | Exit 0; compilación de producción; dos advertencias de tamaño de assets/entrypoint.                                                                                                                                                            |
| PASSED  | `yarn validate:workspaces`                                                     | Exit 0; hard checks; inventario de 68 archivos de rutas.                                                                                                                                                                                       |
| PASSED  | `yarn validate:critical-route-privileges`                                      | Exit 0; 15 aplicaciones críticas protegidas y 3 exenciones documentadas.                                                                                                                                                                       |
| PASSED  | `yarn validate:react-router`                                                   | Exit 0; contrato de runtime 7.18.2.                                                                                                                                                                                                            |
| PASSED  | `yarn validate:error-exposure --base HEAD`                                     | Exit 0; 21 fuentes cambiadas; 0 exposiciones detectadas.                                                                                                                                                                                       |
| PASSED  | Smoke técnico en Edge headless, con componentes y APIs mock reales del paquete | 6/6 casos: cantidades/reserva, impresión sin entrega, entrega/stock/libro, recarga, móvil y borrador manual/recarga. 2 documentos preparados para impresión; 2 registros en el libro; 0 errores de página y 0 solicitudes a orígenes externos. |
| BLOCKED | Gate `e2e` clínico contra OpenMRS y verificación del rol real                  | Faltan el OMOD receptor, la API persistente y el contrato definitivo del libro. El smoke anterior usa un shell y sesión sintéticos aislados; no sustituye este gate.                                                                           |

El smoke usa tamaños 1920 × 1080 y 375 × 900. Verifica ausencia de desbordamiento
horizontal de la página en móvil y preparación del documento imprimible; no abre
una impresora física. Se revisaron visualmente la atención, la constancia y el
formulario móvil. La reserva preparada continúa visible como Por transferir; la
impresión no genera egreso; la entrega confirmada retira las dos unidades y crea
solo dos entradas, conservadas después de recargar.

Los datos y permisos del smoke son sintéticos y su almacenamiento queda limitado
a contextos temporales del navegador, cerrados al finalizar. No se usaron cuentas
reales ni se escribieron registros en OpenMRS. El fixture técnico y sus capturas
no forman parte del repositorio ni agregan un modo standalone al producto.

Las dos advertencias del build corresponden al límite recomendado de tamaño
(main 580,600 KiB; chunks 260,107 y 309,060 KiB). No se han verificado como
preexistentes comparando con `origin/main`. Quedan pendientes la integración,
prueba del rol en el shell OpenMRS y validación clínica antes de un despliegue real.

### Evidencia del ajuste de pestañas y solicitudes generadas

14 de octubre de 2026 (hora de Lima), Windows, Node 24.19.0, Yarn 4.13.0.
Diff local sin commit en `bloodBank`, sobre la misma base
`f7b8b55f502a1815769b35b621f7955c3177a99d`. No se modifican login,
componentes globales, privilegios ni backend. `ProcessingPage`, dentro de este
ESM, incorpora una entrada opcional para pestañas bajo la cabecera; los demás
consumidores conservan su composición y se incluyen en las pruebas del paquete.

| Estado  | Comando o caso                                                                                                                                                                                 | Resultado y alcance                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app lint` y `typescript`                                                                                                                              | Exit 0 en ambos; lint 149 archivos sin diagnósticos.                                                                                                                                                                                                                                                                                                                        |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test src/api/mock-transfers.api.test.ts src/sections/transfers/transfers.component.test.tsx src/blood-bank-app.component.test.tsx --maxWorkers=2` | Exit 0; 49/49 pruebas en 3 archivos.                                                                                                                                                                                                                                                                                                                                        |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test --maxWorkers=2`, `TZ=UTC`                                                                                                                    | Exit 0; 324/324 pruebas en 26 archivos; 58,19 s.                                                                                                                                                                                                                                                                                                                            |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build`                                                                                                                                            | Exit 0; 2 advertencias de tamaño: main 584,409 KiB y chunks 260,107 / 312,869 KiB. No verificadas como preexistentes frente a `origin/main`.                                                                                                                                                                                                                                |
| PASSED  | `validate:workspaces`, `validate:critical-route-privileges`, `validate:react-router`                                                                                                           | Exit 0; hard checks de workspaces, 15 apps críticas protegidas y runtime 7.18.2.                                                                                                                                                                                                                                                                                            |
| PASSED  | `yarn validate:error-exposure --base HEAD`                                                                                                                                                     | Exit 0; 22 fuentes cambiadas; 0 exposiciones.                                                                                                                                                                                                                                                                                                                               |
| PASSED  | Smoke técnico Edge headless con componentes, Carbon y APIs mock del paquete                                                                                                                    | 10/10 casos: reserva completa, imprimir sin entregar, entrega/stock/libro, recarga, móvil, borrador de recibida/recarga, botones de igual ancho/alto, generar/imprimir/recargar solicitud, historiales independientes y borrador de solicitada en móvil. 3 documentos preparados; 2 entradas del libro únicamente por entrega; 0 errores de página y 0 peticiones externas. |
| BLOCKED | Gate clínico `e2e`, sesión/rol real e interoperabilidad                                                                                                                                        | Faltan API/OMOD de transferencias y generación, contrato de persistencia y entorno integrado coordinado. El smoke técnico usa shell/sesión sintéticos, no acredita envío de correo, impresión física ni recepción por otra institución.                                                                                                                                     |

Regresiones añadidas: historial y filtros por dirección, generación idempotente,
rechazo de cambios de dirección y de operaciones de stock sobre solicitudes
generadas, lectura aditiva de mocks antiguos, revisión/impresión sin entrega,
paridad EN/ES y continuidad de la autorización existente. El documento generado
es de consulta; no se anuncia Enviada ni Atendida sin evidencia remota.
Los contextos temporales se cerraron al finalizar, sin escrituras OpenMRS ni
datos reales. El fixture de QA y las capturas siguen fuera de Git.
