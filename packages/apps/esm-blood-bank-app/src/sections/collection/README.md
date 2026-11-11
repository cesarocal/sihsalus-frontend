# Extracción y Tamizaje - prototipo con mocks

## Alcance

Convierte las rutas existentes `collection` y `laboratory/screening` en pantallas navegables. Solo cambia `esm-blood-bank-app` en `bloodBank`. No añade standalone, OMOD, migraciones ni cambios de login, roles o navbar global.

Se reutilizan Carbon, PageHeader/Pictogram del framework y tokens/layout de `applicant-selection/selection.scss`. Listados, filtros, paginación, errores seguros y confirmación de salida son compartidos dentro del ESM.

## Flujo

El resumen de Inicio enlaza las extracciones pendientes mediante
`/collection?collection=<id>`. La pantalla vuelve a consultar la cola y exige
coincidencia exacta y estado no finalizado antes de abrir el formulario existente.
Una referencia no disponible muestra un aviso y mantiene el listado. Abrir no
guarda ni avanza etapas. La referencia se consume una vez, por lo que cerrar no
reabre el formulario al recargar la cola. Se mantienen el permiso de Extracción, las etapas cerradas
en consulta y la confirmación de salida.

1. Extracción lista solo Seleccionados. **Extraer sangre** abre cuatro etapas: Etiqueta, Cantidad extraída, Registro y Constancia.
2. Etiqueta captura sangre o componente, servicio de recolección y leucocitos reducidos. El responsable se obtiene del nombre de la persona autenticada en OpenMRS. El campo es de solo lectura y, al cerrar la etapa, conserva el nombre registrado. Requiere un anticoagulante del catálogo, una solución de conservación en texto o ambos. El agente sedimentario es opcional. Autóloga habilita receptor, documento, servicio e historia.
3. Solo Etiqueta ofrece las dos impresiones. La de unidad deja un espacio para escribir el volumen en mL. La de tubo usa un recuadro rectangular de 65 mm de ancho. Completar Etiqueta genera una muestra visible en Tamizaje, sin duplicarla.
4. Cantidad extraída exige un número positivo con hasta dos decimales (límite técnico DECIMAL(8,2)). Continuar ingresa la unidad mock en Inventario en cuarentena. Reacción adversa queda deshabilitada y pendiente.
5. Registro propone la fecha de hoy y admite fechas desde la admisión hasta hoy. Guarda el lote de bolsa, las complicaciones y la elección explícita de Completa o Incompleta. Toma el nombre del responsable de la sesión de OpenMRS y lo conserva al completar el paso. La donación efectiva actualiza Donantes.
6. Constancia deriva identidad/edad/grupo/Rh/Hb/Hct, permite decidir correo y fecha de resultados (diez días calendario por defecto). Incluye el tipo de donación, el paciente beneficiario cuando es por reposición y la firma física del donante. Guardar finaliza y retira la postulación del listado activo y la conserva para antecedentes/autocompletado.
7. Tamizaje lista muestras, permite buscar y filtrar por estado/resultado. Recepción muestra el número de postulante cuando corresponde, toma el responsable de la sesión de OpenMRS y exige fecha/hora y confirmación de concordancia de nombre/documento/código entre tubo y registro. Al completar la etapa, conserva el nombre registrado. Los valores de etapas cerradas se pueden seleccionar y copiar en campos de solo lectura.
8. Resultados registra ABO, Rh, hematocrito, hemoglobina, los resultados de las siete pruebas infecciosas requeridas, una prueba adicional opcional y las sugerencias de evaluación por Gastroenterología, Infectología y PROCETS. Al elegir Guardar y continuar se registran la fecha, la hora y el nombre del usuario de la sesión. Si se guardan cambios de resultados como borrador tras haber completado la etapa, se requiere volver a confirmarla.
9. Revisión exige completar las pruebas y obtiene el nombre del validador de la sesión de OpenMRS al confirmar. Resultado global: Reactivo si alguna prueba requerida es reactiva, luego Indeterminado si corresponde, sino No reactivo. Validar bloquea la edición. Revisión e historial usan el formato de impresión EG05 - FR15, con los resultados indeterminados identificados en su fila.
10. Una muestra validada con pruebas indeterminadas sigue en la cola como **Pendiente de repetición** y su informe inicial aparece en el historial. **Registrar repetición** abre únicamente esas pruebas. El avance se puede guardar y retomar. La confirmación registra fecha y responsable, y la validación genera un FR15 con su propio número y referencia al informe de origen.
11. El historial mantiene el informe inicial y cada repetición validada para consulta e impresión por separado. **Ver resultado vigente** consolida los resultados de las rondas validadas. Si una prueba sigue indeterminada, se puede registrar otra ronda solo para las pruebas pendientes. Inventario usa los resultados vigentes y mantiene la unidad en cuarentena mientras haya una repetición pendiente.

La X utiliza la confirmación compartida `../../shared/exit-confirmation.component.tsx`, con **Seguir editando / Salir** y la casilla **Guardar el avance antes de salir** marcada por defecto, también en Tamizaje. Guardar conserva incluso una etapa incompleta, respetando el límite heredado del lote; desmarcar descarta solo cambios no guardados, nunca el registro previo. Un formulario guardado sin nueva edición se cierra sin otra escritura ni aviso de éxito. Un fallo devuelve al formulario sin perder su edición. Durante el envío se bloquea la salida y el guardado duplicado. Etiqueta/volumen/registro cerrados son de consulta; un documento finalizado se cierra sin esta confirmación. Revisiones antiguas no sobrescriben registros actualizados.

El [contrato de texto y guardado](../../../TEXT_AND_SAVE_CONTRACT.md) documenta el contador de lote, el conteo UTF-16, la compatibilidad histórica, los mensajes específicos y los límites backend aún pendientes.

**La validación del tamizaje y de sus repeticiones conserva la cuarentena. Reactivo no confirma diagnóstico.** El rechazo o reemplazo de muestras y la reacción adversa están pendientes. El riesgo biológico autólogo no se infiere automáticamente de un tamizaje único.

El panel proviene de los documentos entregados y necesita validación del protocolo vigente antes de uso clínico. Las etiquetas y la constancia muestran los datos del entorno activo.

## Organización y API futura

- `collection-page.component.tsx`: cola/registro y filtros.
- `collection-workflow.component.tsx`: etapas y guardados.
- `collection-documents.component.tsx`: identidad, etiquetas y constancia.
- `collection.types.ts`, `collection-rules.ts`: DTO y validaciones.
- `../laboratory/screening/*`: listado, formulario, informe, tipos y reglas.
- `../../shared/processing-{page,modal}.component.tsx`, `print-document.ts`: UI e impresión aislada.
- `../../api/blood-bank-processing.api.ts`: `CollectionApi` y `ScreeningApi`; rutas propuestas `/ws/rest/v1/bloodbank/collections` y `/ws/rest/v1/bloodbank/screenings`.
- `../../api/mock-{blood-bank-processing.api,processing-store}.ts`: persistencia y fixtures.

`useMockData=false` muestra error seguro: los adaptadores reales están deshabilitados. Hay que acordar payloads, conceptos/UUIDs configurables, encuentros/órdenes, provider/ubicación y autorización por operación antes de implementar el OMOD.

En Tamizaje, el DDL de referencia aún requiere reactivo, marca y lote por prueba. La integración deberá definir el origen de esos datos. El formulario mock conserva esos valores y las observaciones de registros históricos en el almacenamiento local.

El contrato propuesto para guardar una repetición es `/ws/rest/v1/bloodbank/screenings/:id/repeats`. El adaptador mock guarda las rondas junto a la muestra y verifica la revisión, las pruebas que corresponden y el estado de validación antes de guardar. El OMOD deberá asociar cada ronda a su informe de origen y conservar sus resultados e identidad del responsable de forma independiente.

### Catálogos de etiqueta

En la configuración del microfrontend, `collectionLabelConcepts.bloodBankServiceUuid` y `campaignServiceUuid` apuntan a **UPSS Banco de Sangre** y **Campaña de donación**. `collectionLabelConcepts.anticoagulantSetUuid` apunta al conjunto de anticoagulantes permitidos. La consulta usa `GET /ws/rest/v1/concept/{uuid}` con la sesión de OpenMRS y muestra los miembros activos del conjunto.

Con guardado mock y los tres UUID vacíos, el flujo usa un catálogo de demostración. Al configurar los UUID se consulta OpenMRS y se permite reintentar ante un error. La selección conserva el UUID y el nombre para impresión. Los documentos guardados conservan su etiqueta. En borradores antiguos, el servicio requiere seleccionar un concepto antes de continuar.

La muestra postextracción se genera como **Sangre** en **Tubo** en el mock, conservando los datos de muestras previas. El OMOD deberá asignar los conceptos de tipo y recipiente y acordar dónde persistir el texto de conservación, dado que el DDL propone una referencia a concepto para ese dato.

Los registros históricos conservan el volumen aproximado. Para las nuevas extracciones, Fraccionamiento requiere conocer la capacidad nominal de la bolsa cuando la validación de bajo volumen depende de ese dato. Al integrar el OMOD, el responsable debe identificarse a partir de la sesión autenticada del servidor.

Completa e Incompleta usan valores locales. Su mapeo a conceptos de OpenMRS queda pendiente de la integración del OMOD.

| Datos                   | Mapeo previsto                                                                 |
| ----------------------- | ------------------------------------------------------------------------------ |
| Donación y responsable  | `banco_extraccion`, `banco_donante`, `provider`                                |
| Unidad/estado           | `banco_unidad` + historial en la misma transacción                             |
| Etiquetas/constancia    | `banco_unidad_etiqueta`, `banco_muestra_etiqueta`, `banco_constancia_donacion` |
| Muestra                 | `banco_muestra`, un solo origen: unidad; postulación como contexto derivado    |
| Tamizaje                | `banco_muestra_orden_tamizaje` + `test_order`                                  |
| Resultados/trazabilidad | `obs` + `banco_tamizaje_prueba`; fechas/validador/dictamen                     |

El OMOD debe verificar pertenencia paciente/muestra/unidad/orden, numeración atómica, idempotencia, concurrencia, auditoría y permisos. Los controles frontend no sustituyen esas garantías.
No se reescribe la postulación original: su salida del listado deriva de la extracción completada en el mismo almacén mock. Los códigos `BB-*`, `M-*` y `DON-*` no son identificadores institucionales.

## Datos sintéticos y limpieza

Hay un seleccionado inicial (DNI `90000012`) y una muestra inicial `M-DEMO-001`. Solo datos ficticios, por pestaña, conservados al recargar pero no compartidos ni clínicamente persistidos.

`sihsalus.blood-bank.processing.mock.v1` guarda extracciones, muestras y datos de constancia. Etapa/unidad/muestra usan una única escritura; un fallo no finge éxito. No hay firma digital, envío de correo ni documento PDF archivado. No se modifican cookies ni tokens.

Para reiniciar la demostración, limpie exclusivamente ambas claves desde DevTools:

```js
sessionStorage.removeItem("sihsalus.blood-bank.selection.mock.v1");
sessionStorage.removeItem("sihsalus.blood-bank.processing.mock.v1");
location.reload();
```

## Evidencia local - 2026-10-03

Cambios sin commit en `bloodBank`, base `59e8102087c7614f773eeb9c8c6239fc944fbff5`. No es evidencia de despliegue ni validación clínica integrada.

| Estado  | Comando/caso                                                                   | Resultado                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | Scripts del workspace: lint, typescript, test, build                           | Exit 0; 95 pruebas / 10 archivos; dos advertencias de tamaño en build (main ~402 KiB, vendor ~255 KiB)                                                                                   |
| PASSED  | validate:workspaces, validate:critical-route-privileges, validate:react-router | Exit 0; guards existentes y 15 apps críticas fail closed                                                                                                                                 |
| PASSED  | validate:error-exposure --base HEAD                                            | Exit 0; sin exposición en alcance cambiado                                                                                                                                               |
| PASSED  | Smoke Playwright local con Edge headless, escritorio 1440x1000/tablet 768x1024 | X/cancelar, guardar/recargar, volumen inválido, etiqueta de tubo, constancia, muestra derivada, recepción, siete resultados, validación reactiva y cuarentena; cero errores de navegador |
| NOT RUN | E2E clínico con sesión, OMOD/content y backend OpenMRS                         | Contrato aún no implementado; solo datos sintéticos aislados                                                                                                                             |

La fixture temporal estuvo fuera del repo, con componentes reales y stubs de configuración/traducción, sin login ni peticiones OpenMRS. Se inspeccionaron PNGs de listado, etiqueta, revisión, tablet y constancia; se verificó documento/invocación de impresión, no una impresora física. Se limpió el almacenamiento de prueba.
Los avisos Sass de la fixture señalan archivos Carbon; no se verificó su carácter preexistente en origin/main. No cambiaron dependencias.

Rollback: volver a la versión anterior del ESM; no hay esquema ni datos OpenMRS que revertir.
