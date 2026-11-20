# Atención de solicitudes transfusionales

El módulo ofrece emisión y recepción de solicitudes transfusionales con órdenes de
OpenMRS bajo configuración explícita. Las rondas, el inventario y la entrega
del circuito de prueba operan con datos sintéticos.

## Alcance y recorrido

- `/blood-bank/transfusions`: bandeja, prioridad y antigüedad, búsqueda, filtros,
  historial y entrega. Mantiene `app:home.bancoSangre.transfusiones` y el acceso
  al módulo. Historial y libro no conceden privilegios nuevos.
  Las tres tarjetas de estado filtran la bandeja y comparten la selección con
  el desplegable Estado. Pulsar la tarjeta activa limpia ese filtro. Los
  recuentos incluyen las solicitudes FR08 de la bandeja y se calculan antes
  de aplicar la búsqueda y la prioridad.
- `/blood-bank/laboratory/compatibility`: rondas pendientes, prioridad y fecha
  de registro, etiquetas, resultados e historial. Mantiene
  `app:home.bancoSangre.laboratorio.compatibilidad` y el acceso al módulo.
- Atender → revisar FR08 y antecedentes → registrar muestra del receptor →
  seleccionar unidades → Procesar pruebas en Laboratorio → reemplazar las no
  compatibles si corresponde → revisar resultados → identificar a quien recoge
  → confirmar entrega → historial y egresos del libro.

Urgente mantiene el circuito regular y se distingue por su etiqueta de prioridad.
Muy urgente usa el circuito PC13 en las mismas pantallas. La verificación registra
quién constató la autorización firmada y sellada del FR08 y en qué momento.
La pantalla de muestra genera dos etiquetas para el receptor, con y sin
anticoagulante. La selección exige las cantidades completas y aplica el filtro
ABO/Rh por componente en las tres prioridades.

En Muy urgente, la selección reserva las unidades y habilita Entregar. La revisión
de la entrega puede imprimir los rótulos de compatibilidad pendiente para las
unidades que requieren prueba cruzada. Al confirmar la entrega se registra un
egreso por unidad y se habilitan las pruebas pendientes en Compatibilidad. Su
resultado posterior queda registrado en el egreso y se registra por separado
la comunicación al médico solicitante. Una discordancia posterior se destaca
en Compatibilidad y conserva el egreso y la salida de inventario.

El acceso de Inicio de Laboratorio `?round=<id>` en Compatibilidad revalida
una ronda exacta disponible y abre el formulario existente, bajo su guard.
Abrir o cerrar sin guardar no registra resultados ni cambia estados. Una ronda
completada que carece de acciones pendientes, o una inexistente, muestra un aviso seguro. La referencia se consume una
vez para evitar reapertura al refrescar; recargar la URL vuelve a validarla.

## Solicitudes desde Órdenes

La canasta de Órdenes permite emitir el FR08. La ficha muestra la orden en
su lista habitual. En Banco de Sangre las solicitudes del tipo
configurado aparecen en la misma bandeja que usa el flujo de atención.
**Atender** abre el paso correspondiente al estado de la solicitud. En
**Verificación de la solicitud** está **Registrar recepción**. **Ver solicitud**
abre las solicitudes disponibles para consulta. El médico puede imprimir el
FR08 desde Órdenes.

La acción de la canasta requiere una visita activa, un proveedor asociado a la
sesión y el número de historia clínica configurado. Un POST a `/encounter`
guarda el encuentro y su orden en la misma operación. La orden conserva una
versión estructurada del FR08 en `instructions`; el número de acceso identifica
el intento para recuperar una respuesta de guardado perdida. Las solicitudes
programadas guardan la fecha y hora de programación con `ON_SCHEDULED_DATE`.
Urgente y Muy urgente usan `STAT` y conservan la prioridad específica en el
FR08. Para Muy urgente, el médico imprime, firma y sella la autorización existente
en el FR08. La impresión coloca bajo **Otro (especifique)** los componentes del
catálogo que quedan fuera de los siete del formato. La recepción usa
`/order/{uuid}/fulfillerdetails/` y registra `RECEIVED`.

Configure `transfusionOrders` en `@sihsalus/esm-blood-bank-app` con un tipo
de orden activo de clase `org.openmrs.Order`, su concepto, el tipo de encuentro
y el tipo de identificador de historia clínica. El FR08 se guarda con el ámbito
de atención que usa la lista nativa de Órdenes. Confirme
estos UUID en el servidor de destino. Para probar en local, use la configuración
temporal del navegador en las herramientas de implementación de OpenMRS y
agregue únicamente el bloque del módulo. Esta configuración se conserva para el
origen local del navegador. Las extensiones de Órdenes se habilitan cuando
están presentes los UUID requeridos.

La canasta requiere sus permisos de la ficha, `Get Orders`, `Add Orders`
y `Add Encounters`. El Banco necesita sus permisos de módulo y Transfusiones
junto con `Get Orders`, `Get Concepts`, `Get Patients`, `Get Encounters` y
`Get Providers` para resolver las referencias de la orden, y `Edit Orders`
para registrar la recepción. El REST de OpenMRS valida los permisos al ejecutar
cada operación. Con `useMockData`, **Atender** abre el flujo de la prioridad
correspondiente con componentes del catálogo y guarda su avance en el
almacenamiento de la pestaña. La selección, las
rondas y la entrega usan las unidades de prueba. Para una orden nueva, la
verificación habilita el registro de recepción y la recepción confirmada
habilita el avance hacia la muestra. Al avanzar se guarda una fecha y hora
en el registro local de atención.

Para pacientes sintéticos de hemovigilancia, la bandeja consulta los encuentros
de entrega de OpenMRS. Si existe una entrega, muestra la orden como **Atendida**
en el historial incluso al abrir otra sesión. Vuelve a comprobar el registro
antes de abrir la atención y antes de entregar. **Recibida** es el estado que
OpenMRS guarda al registrar la recepción de la orden.

EG05-PC10 ubica la revisión de la integridad y legibilidad de la solicitud y
el registro de fecha y hora de recepción antes de la toma de muestra. La API
de órdenes usada en este módulo persiste el estado de recepción. El campo
dedicado a la fecha y hora de recepción en el backend de Banco de Sangre
queda pendiente.

## Estados, muestras y stock

| Operación confirmada                        | Solicitud                                                  | Unidades                                                                    |
| ------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Revisar identificación y documentación      | Revisada                                                   | Sin reserva                                                                 |
| Continuar desde muestra del receptor        | Muestra registrada                                         | Sin reserva                                                                 |
| Asignar cantidades completas por componente | En pruebas de compatibilidad                               | Sangre total/paquete globular en pruebas; otros componentes reservados      |
| Registrar todos los resultados de una ronda | Compatible si todos aprueban; Incompatible si alguno falla | Compatibles reservadas; incompatibles desasignadas y APTO                   |
| Reasignar faltantes                         | En pruebas de compatibilidad                               | Solo unidades nuevas en pruebas; aprobadas anteriores permanecen reservadas |
| Confirmar entrega                           | Entregada; solicitante ATENDIDA                            | Entregadas y fuera del inventario activo                                    |

El responsable de la atención y quien registra una toma nueva se obtienen de la
persona vinculada a la sesión al abrir Atender. Las revisiones y muestras guardadas
conservan su autor. **Imprimir y extraer muestra** toma la fecha y hora y habilita
Continuar al solicitar la impresión. Continuar registra la muestra y salir con
guardado conserva el borrador. Reimprimir conserva el instante de la toma.
El autorrelleno depende de `user.person.display` en la sesión de OpenMRS, incluso
para cuentas sin acceso general a fichas de personas.
**Entregar** toma el nombre de la sesión al abrir la entrega. El responsable
se guarda al confirmar junto con el DNI de ocho dígitos de quien recibe.
**Libro de transfusiones** abre por separado y permite buscar por hemocomponente
y filtrar por fecha de entrega. El historial y su impresión muestran quién
atendió y quién entregó, con sus fechas respectivas.
Mover filas entre los dos bloques tampoco reserva stock hasta confirmar la asignación. Guardar un
resultado parcial no libera ni reserva unidades. La X permite Seguir editando o
Salir, con guardado opcional marcado por defecto; los errores conservan la edición.

Sangre total, glóbulos rojos y la fracción pediátrica de sangre total generan
muestras de unidad y rondas cruzadas.
Plasma y los demás componentes no reciben un resultado ficticio Compatible:
se registra No requiere prueba cruzada en este flujo. Para solicitudes sin
componentes que requieran prueba cruzada, Compatible significa selección completada.
Las asignaciones aprobadas aparecen bloqueadas al reemplazar las rechazadas.
Todos los intentos y resultados anteriores permanecen trazables y ninguna unidad
ya probada para esa solicitud se ofrece nuevamente.

Los hemocomponentes solicitados se muestran entre el detalle y los antecedentes
en Atención, Ver pruebas y Entrega, con la bolsa ilustrada de Fraccionamiento
y la cantidad requerida. El selector
usa dos tablas Carbon de igual altura, con scroll independiente y sin paginación.
Cada fila tiene una flecha con nombre accesible para asignar o devolver la unidad.
Los indicadores cuentan las unidades faltantes por hemocomponente, consideran
las unidades ya aprobadas y cambian a verde al completar la cantidad exacta.
En selección funcionan como opciones excluyentes para filtrar la lista de
candidatas. Limpiar filtros restablece el hemocomponente y la búsqueda. Las
tablas conservan el desplazamiento con teclado, rueda o gestos táctiles.
El checkbox de verificación está en el pie izquierdo.
El progreso y título se compactan en todas las etapas de atención, reemplazo y entrega, y en
el procesamiento de Compatibilidad. La opción del modal propio permanece
desactivada por defecto para los demás flujos del ESM.

Los títulos identifican el contexto: `Atención de la Solicitud transfusional · TX-DEMO-0001`,
`Entrega de unidades · TX-DEMO-0001` y `Pruebas de compatibilidad: PC-ORDER-TX-DEMO-0001-1`.
Compatibilidad reutiliza en la cabecera el símbolo `IbmDevopsTest` del menú.
El procesamiento muestra la muestra del receptor una sola vez, enlazada con
las muestras de las unidades y sus opciones de resultado. Al guardar se registra
el nombre de la persona de la sesión que abrió el procesamiento.
La impresión de etiquetas desde Compatibilidad incluye solo las muestras de las
unidades de la ronda. Solicitar la impresión habilita los resultados. La fecha
de la solicitud de impresión se conserva al guardar la ronda o su borrador.
El informe se habilita cuando se completan todas las rondas
de la solicitud. Las etiquetas y el informe de compatibilidad suprimen los
encabezados y pies automáticos de impresión.

`src/shared/warning-confirmation.component.tsx` reutiliza Carbon para las tres
confirmaciones operativas de este flujo. Incluye triángulo, descripción accesible,
efectos separados, nota de seguridad y dos acciones pequeñas. El foco inicial
va a Seguir editando y el formulario subyacente permite que solo esta advertencia
controle el foco mientras está abierta, mediante la opción pública de Carbon.
La asignación
explica solo las ramas presentes (con/sin prueba cruzada); los resultados muestran
su efecto real, incluyendo devolución a APTO de las no compatibles. La entrega
explicita salida de inventario, egresos del libro y estado del solicitante, sin
confundir entrega con administración. Se mantienen guardas de guardado, validación
y escrituras atómicas; abrir o cerrar estas advertencias no modifica stock.

Las reservas se proyectan en el mismo inventario mock usado por Transferencias,
Fraccionamiento y Eliminación, que bloquean su reutilización. La entrega vuelve a
verificar cantidades, identidad, sello, tamizaje, caducidad y muestra. Una única
escritura en `sessionStorage` confirma estado, salida de stock y libro; fallos de
almacenamiento no producen transiciones parciales. Revisiones obsoletas se
rechazan y repetir una entrega completada no duplica egresos.

## Criterios y límites clínicos

Referencias aportadas: EG05-PC10 TO-BE, flujograma PC10 y formato EG05-FR08;
`criterios_calidad.md`, identificación de muestras 6.1–6.4, CC12
(muestras/estudios pretransfusionales), CC13 (compatibilidad), CC14 (selección
por componente) y CC17 (verificaciones y entrega).

- Receptor: nombre y HC, fecha de toma y profesional; confirmación de concordancia
  del tubo y registro. FR08 conserva antecedentes desconocidos, no los interpreta
  como negativos. El encargado confirma la documentación/consentimiento aplicable.
- El filtro común del prototipo usa EG05-CC14 A, B y D y las tablas de
  [Lifeblood](https://www.lifeblood.com.au/health-professionals/products/component-compatibility).
  Aplica las tablas ABO de glóbulos rojos y plasma en sus sentidos respectivos,
  admite ambos RhD para plasma y crioprecipitado, y exige ABO idéntico en
  sangre total y su fracción pediátrica. Las plaquetas y el plasma rico en
  plaquetas se limitan a ABO idéntico y RhD compatible en el flujo regular.
  Admitir sustituciones de plaquetas requiere datos y políticas de laboratorio
  sobre el producto y la situación clínica. La selección, asignación y entrega
  usan la misma regla junto con componente solicitado, APTO, sello, tamizaje,
  ausencia de incidencias y vigencia. La prueba cruzada se registra por separado.
  La política definitiva requiere validación clínica y aplicación en el servidor.
- La muestra expira conservadoramente a los tres días en todos los casos mock.
  Los criterios reales dependen de antecedentes/embarazo/transfusiones; esa regla
  y un flujo de nueva muestra, caducidad, cancelación y liberación excepcional
  necesitan definición clínica antes de integrar el backend.
- El profesional confirma grupo/Rh, anticuerpos y estudios pretransfusionales;
  el mock no ejecuta pruebas ni sustituye su validación de laboratorio. Aféresis,
  componentes especiales y selección pediátrica se difieren. El prototipo exige
  ABO/Rh conocido para los tres niveles. La emisión clínica de emergencia con
  grupo desconocido requiere la política institucional y la API operativa.
- Las etiquetas de muestra llevan el logo de Santa Clotilde e identifican el
  receptor por nombre, historia clínica y ABO/Rh. Imprimir abre el diálogo del
  navegador. Los botones azules permanecen abajo a la
  izquierda; no se fuerza otro formato de fecha nativo del navegador.
- El informe de compatibilidad identifica al paciente y sus muestras, conserva
  los intentos anteriores y separa resultados de trazabilidad. La impresión lleva
  el logo del hospital y se habilita en la solicitud y los historiales cuando
  todas las pruebas requeridas tienen un resultado definitivo.
- El libro registra **egresos para transfusión** por unidad: solicitud, sello,
  componente, receptor/HC, servicio, médico/CMP, responsable de atención, persona
  que recoge/documento y fecha/hora. No equivale a administración clínica ni crea
  una fila de `banco_transfusion`; aplicación, monitorización y complicaciones
  del receptor son otro flujo pendiente.

## Datos y arquitectura

`transfusions.types.ts` define solicitud, borrador, muestra, asignación, ronda y
egreso. `transfusions-rules.ts` contiene reglas sin acceso al almacenamiento.
Las pantallas usan `src/api/transfusions.api.ts`; los adaptadores están en
`src/api/mock-transfusions.api.ts` y `mock-transfusions-store.ts`.
`src/mocks/transfusions.mock.ts` aporta diez solicitudes sintéticas sin
inventar UUIDs de OpenMRS. Textos ES/EN, Carbon, cabecera compartida, notificaciones
cerrables existentes y errores seguros: no se cambia login ni componentes globales.

Se agregan veinte unidades `BB-TX-DEMO-001..020`: seis paquetes globulares,
cuatro sangres totales, cuatro PFC, tres plaquetas y tres crioprecipitados.
Su caducidad DEMO no representa una vida útil clínica por componente. Estas veinte
unidades comienzan **APTO**, no reactivas y con sellos sintéticos únicos
`Q-TX-DEMO-001..020`, listos para las solicitudes. `fixtureQualitySeals` conserva
esas aprobaciones iniciales en el estado mock: no crea eventos de impresión ni
elimina las verificaciones del flujo normal de Sello de calidad. Las otras cinco
unidades de prueba mantienen sus estados y su proceso de sellado.

Las pestañas anteriores reciben esta metadata de forma aditiva solo para unidades
originales válidas: se conservan sellos y borradores existentes, resultados,
caducidad, reservas, entregas, eliminaciones y fraccionamientos. No se aprueban
fixtures incompletas, reactivas o vencidas ni se heredan sellos a componentes
derivados. Las lecturas no escriben ni reinician almacenamiento; la metadata
añadida se conserva con la siguiente escritura normal en la pestaña.

Caso sugerido: TX-DEMO-0001 requiere dos paquetes globulares O+ y un PFC O+.
Seleccionar 001, 002 y 011; registrar 001 compatible y 002 incompatible; reemplazar
002 con 003 conservando 001/011; aprobar 003; imprimir y entregar. TX-DEMO-0002
requiere una sangre total A+ (007/008); TX-DEMO-0003 un PFC AB+ (013), sin ronda
cruzada. Solo se admiten cantidades completas, no atención parcial.

TX-DEMO-0005 y TX-DEMO-0006 prueban el filtro para receptor A+ en glóbulos rojos
y PFC. TX-DEMO-0008 recorre el flujo regular con etiqueta Urgente.
TX-DEMO-0009 permite seleccionar 001, 006 y 013, entregar las tres juntas
y procesar y comunicar las pruebas de 001 y 006. TX-DEMO-0007 y TX-DEMO-0010
solicitan dos glóbulos rojos O−. El inventario inicial tiene uno y bloquea
el avance en Programada y Muy urgente, respectivamente.

## Integración futura y Órdenes

El DDL aportado relaciona `banco_solicitud_transfusional.order_id` con `orders`,
además de encuentro, detalles, muestras, órdenes/pruebas de compatibilidad,
reservas y entrega. La solicitud clínica puede basarse en Order, mientras estos
registros de dominio conservan la atención y trazabilidad del banco.

El contrato propone `GET /ws/rest/v1/bloodbank/transfusion-requests` y operaciones
de borrador, revisión, muestra, asignación, compatibilidad, comunicación y entrega, documentadas
en `transfusions.api.ts`. **No hay un endpoint servidor desplegado**. Al desactivar
`useMockData`, las órdenes configuradas admiten emisión, consulta y recepción.
Antes de habilitar la atención con stock operativo: acordar payload/UUIDs, permisos de servidor,
transacciones y bloqueos entre operadores, auditoría, idempotencia, identidad,
consentimiento, reglas clínicas y política de datos sensibles.

La emisión médica usa la extensión `order-basket-slot` vinculada al paciente y
su visita. La relación entre la orden de OpenMRS y el OMOD de Banco de Sangre
requiere la integración de backend.

## Hemovigilancia de prueba

En el frontend local con `useMockData`, la entrega de inventario simulado
vinculada a un FR08 crea un encuentro de entrega para el paciente marcado con
el atributo **Paciente sintético de hemovigilancia**. La ficha consulta los
encuentros de ese paciente y abre el FR08 por su UUID. El código de la unidad
y el UUID de la orden identifican cada hoja y reporte.

- Enfermería consulta las unidades entregadas y registra conducción y reporte
  FR02. El médico registra su revisión y Banco de Sangre la investigación.
- Cada paso guarda un encuentro local con el tipo y el privilegio de edición
  correspondiente. Las observaciones conservan el registro y la revisión
  anterior cuando se actualiza la conducción.
- La hoja identifica la solicitud y la unidad con el código estable
  `HC-<número de orden>-<código de unidad>`. Enfermería ve el médico y el CMP
  del FR08. El historial automático se construye con hojas de conducción previas
  del paciente y muestra la ubicación guardada al entregar sus unidades. Las
  transfusiones previas que se añaden a mano se guardan en la hoja actual.
- El control empieza con una columna y admite hasta seis. Cada columna
  requiere una hora y la siguiente debe ser igual o posterior a la anterior.
  La impresión de la hoja siempre reserva las seis columnas y se habilita
  solo para el médico después de guardar la hora de término. Enfermería
  confirma el envío al médico. El guardado deja la hoja abierta en solo lectura.
- La ficha muestra el estado de transfusión por unidad. El inicio guardado
  indica una transfusión en curso y la hora de término indica que se completó.
  La hora de suspensión guardada en la hoja o en un FR02 anterior indica una
  interrupción y tiene prioridad sobre la hora de término. Si todavía no hay datos de administración,
  la celda queda con un guion.
- El FR02 nuevo toma las horas de inicio y suspensión guardadas en la hoja.
  El encuentro de reporte registra la notificación al médico y el encuentro
  de revisión registra la notificación a Banco de Sangre. La revisión habilita
  la impresión del informe. El CEP y el CMP se toman del atributo activo
  `Número de Colegiatura` del proveedor vinculado a cada cuenta.
- Los documentos A4 usan el formato institucional de conducción y el FR02,
  con espacio para firmas físicas. Este circuito trabaja con el inventario y
  los pacientes de prueba. La entrega clínica requiere el OMOD de Banco de Sangre.

La preparación local requiere los tipos de encuentro, el concepto de texto y
el atributo de paciente definidos en `hemovigilance.ts`, junto con los
privilegios de ficha, registro, revisión e investigación del módulo. Los
tipos de encuentro deben usar esos privilegios de edición en OpenMRS.

## Validación y reversión

Ver [evidencia de validación](VALIDATION.md). Las pruebas mock no demuestran
funcionamiento del OMOD ni seguridad clínica de producción. El gate clínico
integrado queda BLOCKED mientras no existan estas APIs/contenidos y un entorno
no productivo con datos sintéticos y limpieza documentada.

Despliegue limitado al prototipo mock. Detener ante duplicación de egresos,
reutilización de reservas, cambios al imprimir o exposición de datos técnicos.
Revertir el lote de cambios de este ESM/restaurar su artefacto previo. Conservar
una copia de datos sintéticos de la pestaña si se desea recuperar borradores;
no borrar toda la sesión. No hay migración de servidor ni cambios de OMOD.
