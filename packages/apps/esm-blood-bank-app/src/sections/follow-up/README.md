# Seguimientos al donante y al receptor

Flujos navegables EG05-PC15 y EG05-PC16 con datos sintéticos y adaptadores mock.

## Alcance

- Las rutas existentes `/follow-up/donor` y `/follow-up/recipient` conservan sus privilegios independientes. Las cabeceras utilizan los iconos de su barra lateral y el contexto común de ubicación/hora.
- Cada bandeja muestra únicamente casos abiertos; incluye búsqueda, filtro de etapa, historial de todos sus casos (abiertos y cerrados), fechas y estado. El historial de cada tipo es independiente y su modal se cierra con la X.
- El detalle tiene cinco etapas: detección, investigación/trazabilidad, notificación, muestras/resultados e información/informe. Guardar y continuar confirma una etapa; las anteriores se consultan sin edición. La X reutiliza Seguir editando / Salir y la casilla para guardar antes de salir.
- PC15 parte de un receptor con tamizaje reactivo e investiga a los donantes de sus transfusiones. PC16 parte de un donante con resultado reactivo confirmado e identifica a los receptores de sus unidades y componentes. Se conserva el sentido de los informes: FR13 identifica al receptor de origen y FR14 al donante de origen.
- La investigación utiliza vínculos sintéticos de **administración confirmada**, no deduce transfusiones de un despacho o de una prueba cruzada. Se requiere revisar todas las transfusiones encontradas. FR13 incluye además otros componentes/receptores de los donantes identificados; FR14 recoge antecedentes previos en la institución y fuera de ella. Desconocido deja ambas casillas sin marcar al imprimir; no se convierte en No.
- Las notificaciones documentan contactos ya realizados, con fecha, responsable y medio; no envían correos, mensajes ni notificaciones externas.
- Registrar muestra conserva colector, fecha, identificación verificada y dos identificadores de la persona; crea una muestra pendiente con origen `followUp`, caso y tipo de persona, sin unidad de inventario. Su recepción, etiqueta, siete pruebas y validación se gestionan en Tamizaje / Seguimientos. Actualizar resultados vuelve a consultar los datos del caso.
- Los resultados se muestran de solo lectura. Un resultado reactivo o dudoso requiere referencia del segundo informe, fecha, responsable y resultado de confirmación antes de avanzar. Este registro documental no ejecuta una prueba ni modifica el resultado original del laboratorio.
- Cerrar exige resultados validados, confirmaciones cuando procedan, información a cada persona y al médico tratante, responsable, fecha y conclusiones. PC15 registra también la información al director. El caso cerrado es de consulta y permanece imprimible.
- La impresión reproduce las tablas, identificación, fecha y espacio de firma del FR13/FR14 aportados. El botón azul de impresión con icono se ubica a la izquierda del pie. Imprimir no guarda, informa personas ni cierra el caso; los documentos llevan la marca de datos sintéticos.

## Datos y API

`FollowUpApi` en `src/api/follow-up.api.ts` separa lista, guardado/avance, toma de muestra y cierre. `BloodBankApi.followUp` selecciona el adaptador mock o el real deshabilitado.

Contratos propuestos: `GET/POST /ws/rest/v1/bloodbank/follow-ups`, actualización del caso, consulta de trazabilidad `/follow-ups/:id/tracing`, `POST /follow-ups/:id/samples` y `POST /follow-ups/:id/close`. No representan endpoints desplegados. El adaptador OpenMRS rechaza todas las operaciones hasta acordar DTO, permisos, revisiones, auditoría, idempotencia y persistencia con el backend.

Los casos y las muestras comparten la clave existente `sihsalus.blood-bank.processing.mock.v1` de `sessionStorage`. Cada escritura se realiza en una sola operación; errores de almacenamiento no anuncian éxito. Se detectan revisiones obsoletas, etapas fuera de orden y cambios a datos bloqueados. Registrar la misma muestra tras un reintento devuelve la referencia existente. No se borran claves históricas ni se migran datos del usuario.

La lectura limita las muestras a las asociadas a los casos del tipo consultado. El backend deberá autorizar cada operación y filtrar también candidatos y trazabilidad por el contexto permitido. No se cambian los permisos existentes ni se crean usuarios o roles.

## Referencias y límites

Se revisaron los BPMN TO-BE PC15/PC16 y las imágenes normativas/FR13/FR14 aportadas. Los criterios de calidad EG05-CC01 F.6 (identificación de muestras; página impresa 26) y EG05-CC02 B, D y E (notificación, identificación retrospectiva e investigación; página impresa 27 de criteriosCalidad.pdf) orientan identificación y documentación. Estos registros no determinan causalidad clínica.

La trazabilidad usa un conjunto sintético explícito; conectar administraciones reales, donaciones históricas, confirmaciones de laboratorio, exclusiones, cuarentena de otros componentes, reportes de hemovigilancia e interoperabilidad requiere contratos adicionales. El flujo no modifica automáticamente inventario ni el estado de un donante. No constituye una integración clínica validada.

Rollback: revertir los cambios de Seguimientos y su conexión con `BloodBankApi`; no borrar el almacenamiento ni registros OpenMRS. No hay migración de servidor.

## Verificación

Pruebas del adaptador y componentes: ambos recorridos, resultados pendientes/reactivos/dudosos, evidencia confirmatoria, persistencia de borradores, conflictos, cierre inmutable, filtrado, impresión, salida y errores seguros. Las pruebas de la aplicación verifican acceso permitido/denegado de ambas rutas.

La evidencia ejecutada de esta entrega se registra en VALIDATION.md. Las pruebas locales con mocks no sustituyen una prueba clínica integrada en DEV/QLTY.
