# Atención regular de solicitudes transfusionales

Prototipo navegable con datos sintéticos; no registra órdenes, muestras ni
transfusiones en OpenMRS. La autoridad clínica y las transacciones de servidor
siguen pendientes del OMOD. No utilizar con pacientes reales.

## Alcance y recorrido

- `/blood-bank/transfusions`: bandeja, prioridad y antigüedad, búsqueda, filtros,
  historial y entrega. Mantiene `app:home.bancoSangre.transfusiones` y el acceso
  al módulo. Historial y libro no conceden privilegios nuevos.
- `/blood-bank/laboratory/compatibility`: rondas pendientes, prioridad y fecha
  de registro, etiquetas, resultados e historial. Mantiene
  `app:home.bancoSangre.laboratorio.compatibilidad` y el acceso al módulo.
- Atender → revisar FR08 y antecedentes → registrar muestra del receptor →
  seleccionar unidades → Procesar pruebas en Laboratorio → reemplazar las no
  compatibles si corresponde → revisar resultados → identificar a quien recoge
  → confirmar entrega → historial y egresos del libro.

La generación de solicitudes, el usuario médico y su integración con Órdenes
no forman parte de este cambio. Una solicitud urgente sintética permite comprobar
el orden de prioridad, pero su acción está deshabilitada. Ambos tipos urgentes
también se rechazan en el adaptador; no existe una excepción sin prueba cruzada.

## Estados, muestras y stock

| Operación confirmada                        | Solicitud                                                   | Unidades                                                                    |
| ------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| Revisar identificación y documentación      | Revisada                                                    | Sin reserva                                                                 |
| Continuar desde muestra del receptor        | Muestra registrada                                          | Sin reserva                                                                 |
| Asignar cantidades completas por componente | En pruebas de compatibilidad                                | Sangre total/paquete globular en pruebas; otros componentes reservados      |
| Registrar todos los resultados de una ronda | Compatible si todos aprueban; No compatible si alguno falla | Compatibles reservadas; incompatibles desasignadas y APTO                   |
| Reasignar faltantes                         | En pruebas de compatibilidad                                | Solo unidades nuevas en pruebas; aprobadas anteriores permanecen reservadas |
| Confirmar entrega                           | Entregada; solicitante ATENDIDA                             | Entregadas y fuera del inventario activo                                    |

Guardar al salir conserva únicamente borradores: imprimir la etiqueta no crea
la muestra canónica y solo Continuar desde su etapa la registra. Mover filas entre
los dos bloques tampoco reserva stock hasta confirmar la asignación. Guardar un
resultado parcial no libera ni reserva unidades. La X permite Seguir editando o
Salir, con guardado opcional marcado por defecto; los errores conservan la edición.

Solo sangre total y paquete globular generan muestras de unidad/rondas cruzadas.
Plasma y los demás componentes no reciben un resultado ficticio Compatible:
se registra No requiere prueba cruzada en este flujo. Para solicitudes sin estos
dos componentes, Compatible significa selección completada, no una prueba hecha.
Las asignaciones aprobadas aparecen bloqueadas al reemplazar las rechazadas.
Todos los intentos y resultados anteriores permanecen trazables y ninguna unidad
ya probada para esa solicitud se ofrece nuevamente.

El selector usa tablas Carbon con todas las filas, sin paginación, dentro de dos
bloques de igual altura y scroll independiente. Sus cabeceras permanecen visibles
al desplazarse; la región puede enfocarse y recorrerse con teclado. Las flechas
son botones pequeños solo con icono, con nombres accesibles y tooltip. El progreso
y título se compactan en todas las etapas de atención, reemplazo y entrega, y en
el procesamiento de Compatibilidad. La opción del modal propio permanece
desactivada por defecto para los demás flujos del ESM.

Los títulos identifican el contexto: `Solicitud transfusional · TX-DEMO-0001`,
`Entrega de unidades · TX-DEMO-0001` y `Pruebas de compatibilidad · TX-DEMO-0001`.
Compatibilidad reutiliza en la cabecera el símbolo `IbmDevopsTest` del menú.
Los pares receptor–unidad muestran tubos de ensayo SVG decorativos en rojo.

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
- El filtro DEMO exige mismo ABO/Rh, componente pedido, APTO, sello confirmado,
  siete resultados no reactivos, ausencia de incidencias y fecha de caducidad
  válida. **No es una matriz clínica completa ni una prueba cruzada electrónica**.
  No ofrece sustituciones ABO/Rh; la política definitiva necesita validación
  por componente, paciente y servidor. Autólogas quedan fuera del flujo regular.
- La muestra expira conservadoramente a los tres días en todos los casos mock.
  Los criterios reales dependen de antecedentes/embarazo/transfusiones; esa regla
  y un flujo de nueva muestra, caducidad, cancelación y liberación excepcional
  necesitan definición clínica antes de integrar el backend.
- El profesional confirma grupo/Rh, anticuerpos y estudios pretransfusionales;
  el mock no ejecuta pruebas ni sustituye su validación de laboratorio. Aféresis,
  componentes especiales, selección pediátrica y autorizaciones urgentes se difieren.
- Impresos de tubo y resultados llevan marca sintética. Imprimir no confirma
  impresión física, firma ni entrega. Los botones azules permanecen abajo a la
  izquierda; no se fuerza otro formato de fecha nativo del navegador.
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
`src/mocks/transfusions.mock.ts` aporta cuatro órdenes recibidas sintéticas sin
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

## Integración futura y Órdenes

El DDL aportado relaciona `banco_solicitud_transfusional.order_id` con `orders`,
además de encuentro, detalles, muestras, órdenes/pruebas de compatibilidad,
reservas y entrega. La solicitud clínica puede basarse en Order, mientras estos
registros de dominio conservan la atención y trazabilidad del banco. No se
modifica el esquema SQL ni se crea un Order desde este prototipo.

El contrato propone `GET /ws/rest/v1/bloodbank/transfusion-requests` y operaciones
de borrador, revisión, muestra, asignación, compatibilidad y entrega, documentadas
en `transfusions.api.ts`. **No hay un endpoint servidor desplegado**. Al desactivar
`useMockData`, todas las operaciones nuevas fallan de forma segura sin enviar
peticiones. Antes de habilitarlas: acordar payload/UUIDs, permisos de servidor,
transacciones y bloqueos entre operadores, auditoría, idempotencia, identidad,
consentimiento, reglas clínicas y política de datos sensibles.

Para la futura generación médica, reutilizar las extensiones existentes de
`esm-patient-orders-app` (`patient-chart-orders-dashboard-slot`,
`order-item-additional-info-slot` y workspaces `order-basket` /
`patient-orders-form-workspace`) con una extensión propia vinculada a paciente y
encuentro. El tipo/conceptos de orden y su relación con el OMOD requieren acuerdo
de backend; no duplicar una barra global ni crear usuarios desde este ESM.

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
