# Inicio operativo por permisos

Una sola página compone sus bloques según los privilegios de vista y los de las
secciones operativas. Usa los adaptadores existentes y datos mock actuales;
`getDashboard()` y sus métricas estáticas heredadas no se consultan en esta vista.
No se crea un selector de roles ni una vía para elevar privilegios en el producto.

## Privilegios nuevos que se deben crear en OpenMRS

| Perfil de Inicio       | Privilegio exacto                                 |
| ---------------------- | ------------------------------------------------- |
| Selección y extracción | `app:home.bancoSangre.inicio.seleccionExtraccion` |
| Laboratorio            | `app:home.bancoSangre.inicio.laboratorio`         |
| Inventario             | `app:home.bancoSangre.inicio.inventario`          |
| Responsable del banco  | `app:home.bancoSangre.inicio.responsable`         |

Todos requieren también el privilegio existente `app:home.bancoSangre` para entrar
al módulo. Deben crearse y asignarse a los roles en el backend; declarar las
constantes en TypeScript no los provisiona. No se ejecutaron cambios de servidor.
La asignación debe coordinarse antes de desplegar: usuarios sin ningún permiso
nuevo no ven Inicio en el menú del módulo; al abrir su URL reciben una explicación
sin consultas operativas. Sus secciones previamente autorizadas siguen disponibles.

Los nombres de los roles pueden ajustarse a los del hospital. La implementación
comprueba permisos, sin comparar nombres de roles. Cada persona puede reunir
varios de los perfiles siguientes.

## Asignación recomendada de permisos existentes

Además del permiso de Inicio correspondiente y de `app:home.bancoSangre`:

| Perfil                 | Permisos de destino que habilitan sus tarjetas                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selección y extracción | `app:home.bancoSangre.seleccionPostulante`, `app:home.bancoSangre.extraccionAferesis`                                                                                                             |
| Laboratorio            | `app:home.bancoSangre.laboratorio.tamizaje`, `app:home.bancoSangre.laboratorio.compatibilidad`, `app:home.bancoSangre.laboratorio.fraccionamiento`                                                |
| Inventario             | `app:home.bancoSangre.inventario`                                                                                                                                                                 |
| Responsable            | Los seis permisos anteriores y `app:home.bancoSangre.transferencias`, `app:home.bancoSangre.transfusiones`, `app:home.bancoSangre.seguimientoDonante`, `app:home.bancoSangre.seguimientoReceptor` |

`app:home.bancoSangre.donantes` continúa siendo independiente: asígnese cuando el
usuario deba consultar Donantes y sus detalles. No es necesario para mostrar las
tarjetas de Inicio. Tener el permiso de responsable no otorga automáticamente
ningún permiso operativo; solo muestra los bloques y fuentes para los destinos
autorizados. No usar permisos comodín para suplir asignaciones faltantes.

## Combinaciones

| Permisos de vista asignados                       | Resultado, sujeto a los permisos de destino                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Selección y extracción                            | Entrevistas pendientes, nueva postulación y cola de extracción.                                                   |
| Laboratorio                                       | Muestras de donantes y de seguimientos, grupos de compatibilidad pendientes y unidades elegibles para fraccionar. |
| Inventario                                        | Unidades en estado APTO, pendientes de sello, próximas a vencer y alertas individuales.                           |
| Laboratorio + Inventario                          | Ambos bloques en el mismo Inicio.                                                                                 |
| Selección y extracción + Laboratorio + Inventario | Los tres bloques, sin coordinación general.                                                                       |
| Responsable                                       | Los tres bloques anteriores y coordinación: solicitudes transfusionales, transferencias y seguimientos abiertos.  |
| Responsable + cualquier otro perfil               | La misma composición, sin duplicar bloques ni tarjetas.                                                           |

Los bloques sin ningún destino autorizado se ocultan. Los errores de una fuente
se muestran en su propio bloque con reintento, conservando las otras tarjetas.
No se renderizan trazas técnicas ni información de pacientes en las tarjetas.
Los indicadores se consultan al entrar y al pulsar Actualizar pendientes; el reloj
de cabecera no significa que los datos se refresquen continuamente.

## Acciones y enlaces

### Distribución según perfiles de Inicio

Un único permiso de Inicio de Selección, Laboratorio o Inventario utiliza la
vista amplia: ocupa el área disponible bajo la cabecera, mantiene el menú y
presenta tareas con cantidad, descripción y acceso. Responsable utiliza siempre
el mosaico compacto, incluso si solo tiene acceso operativo a un área. Dos o
más permisos de Inicio distintos también utilizan el mosaico. La regla usa los
privilegios efectivos a través de los guards existentes, sin comparar nombres
de usuarios o roles, contar varias veces un privilegio heredado ni consultar
fuentes adicionales para decidir la distribución.

El mosaico dispone las áreas en dos columnas, con indicadores y flechas en filas
compactas dentro de cada bloque. Un último bloque impar aprovecha todo el ancho.
Solo se incluyen áreas y tareas autorizadas por sus permisos de vista y destino;
las combinaciones no repiten contenido ni reservan bloques vacíos. Se conserva
el orden Selección y extracción, Laboratorio, Inventario y Coordinación del
banco. Nueva postulación sigue junto al título de su área. Ambos modos usan
tipografía y espaciado de Carbon y se apilan en móvil sin recortar contenido.

En el perfil único de Selección y extracción, la vista amplia usa dos resúmenes
compactos y la tabla Pendientes por atender. Cada fuente se consulta una vez,
solo con su permiso operativo, y alimenta su indicador y sus filas. Se incluyen
únicamente postulaciones pendientes de entrevista y extracciones no finalizadas.
La vista previa presenta hasta seis tareas ordenadas por número de postulación;
los indicadores cuentan todos los registros y sus enlaces abren los listados
completos. Los errores tienen reintento independiente y no convierten una fuente
fallida en un contador cero. El mosaico de los perfiles combinados conserva su
distribución.

El perfil único de Laboratorio presenta cuatro resúmenes compactos y la tabla
Pendientes de laboratorio, con código, origen/hemocomponente, proceso y acción.
Todo, Tamizaje, Compatibilidad y Fraccionamiento filtran localmente sin nuevas
consultas. Cada fuente se monta solo bajo su permiso operativo y alimenta tanto
sus indicadores como sus filas. Tamizaje comparte una lectura entre Donantes y
Seguimientos; excluye muestras validadas o de origen no reconocido. Compatibilidad
incluye rondas no completadas, ordenadas por prioridad y antigüedad como su cola.
Fraccionamiento usa el predicado existente `eligibleSource`, sin ampliar la
elegibilidad clínica. Dentro de Tamizaje y Fraccionamiento se priorizan las
fechas más antiguas. Todo agrupa por proceso, sin establecer una prioridad clínica
entre procesos distintos. Se muestran hasta seis filas por filtro; los resúmenes
cuentan todas las tareas actuales y abren las colas completas. Los errores y
reintentos son independientes por fuente y no muestran un cero falso; las otras
fuentes siguen utilizables. La tabla no muestra nombres de pacientes.

Los vencimientos aparecen en un bloque independiente después de todas las
áreas, manteniendo los cinco enlaces individuales y el acceso al listado
completo. Tarjetas y alertas comparten una lectura autorizada de Inventario por
carga o actualización. Un fallo conserva las demás áreas y ofrece reintentar
esa fuente; no muestra alertas antiguas mientras se actualiza o hay un error.

### Destinos

- Entrevistas: `/applicant-selection?status=awaitingInterview`, con ese filtro de estado aplicado.
- Nueva postulación: `/applicant-selection?action=newApplication`, abre una ficha nueva sin admitir ni guardar automáticamente.
- Entrevistar una fila: `/applicant-selection?application=<id>`; busca el ID exacto en la lista actual y exige `awaitingInterview`. Abre el mismo formulario del listado, con Admisión, Datos personales y Examen físico bloqueados para revisión.
- Continuar una extracción: `/collection?collection=<id>`; abre únicamente la extracción pendiente o en curso que coincida exactamente con el ID.
- Extracción: `/collection`, pestaña de cola activa por defecto.
- Tamizaje de donantes/seguimientos: `/laboratory/screening?category=donors` o `category=followUps`; activa la pestaña correspondiente.
- Tamizaje de una fila: `/laboratory/screening?screening=<id>&category=donors|followUps`; revalida ID exacto y estado pendiente/en proceso, abre el formulario habitual y activa la pestaña del origen real.
- Compatibilidad: `/laboratory/compatibility`, cola pendiente habitual.
- Procesar una fila: `/laboratory/compatibility?round=<id>`; abre solo la ronda exacta no completada, sin registrar resultados.
- Fraccionamiento: `/laboratory/fractionation?category=eligible`, muestra solo unidades que cumplen la función existente `eligibleSource`, con opción de quitar el filtro.
- Fraccionar una fila: `/laboratory/fractionation?category=eligible&unit=<id>`; localiza y preselecciona únicamente la unidad exacta todavía elegible. No llama a `start`: crear el lote y cambiar estados requiere pulsar Fraccionar en la cola. Limpiar los filtros permite volver al listado completo.
- Aptas: `/inventory?status=APTO`; cuenta el estado operativo, sin afirmar que un estado por sí solo sustituye las verificaciones del proceso transfusional.
- Pendientes de sello: `/inventory?category=seal`, restringe al estado **Sello pendiente**. El botón habitual inicia la operación; el enlace no asigna sellos ni cambia estados.
- Próximas a vencer: `/inventory?expires=7`; aplica el mismo predicado que cuenta las alertas de Inicio.
- Alerta individual: `/inventory?unit=<identificador codificado>`; coincidencia **exacta**, nunca un prefijo que mezcle unidades. La búsqueda muestra el código; el botón de escoba Limpiar filtros, a la derecha de Estado, devuelve el listado. No selecciona la casilla ni inicia una eliminación.
- Solicitudes y seguimientos: abren sus bandejas pendientes actuales, conservando orden, validaciones, confirmaciones y permisos existentes.

Las consultas de URL se aplican al entrar y se conservan al recargar o abrir el
enlace directamente. No se aceptan destinos externos desde parámetros. Si una
unidad ya salió del inventario, se indica la situación sin buscar otra unidad
parecida ni ejecutar una acción sobre ella. Las rutas mantienen sus guards aunque
se abra un enlace sin pasar por Inicio.

Los accesos a entrevistas, extracciones, muestras y rondas no ejecutan guardados
ni avances. Fraccionamiento solo prepara la selección, sin crear el lote. Una
referencia inexistente o ya no pendiente muestra un aviso y conserva el listado.
La referencia se consume una vez en la pantalla: cerrar el formulario no lo
reabre, ni siquiera al actualizar la cola. Recargar explícitamente la URL vuelve
a consultar y validar el registro. Abrir una URL no concede permisos de destino.

`dashboardExpiryWarningDays` configura de 1 a 365 días, con valor predeterminado 7. Es un recordatorio operativo por fecha de calendario: incluye hoy y el último
día del periodo, excluye fechas anteriores, desconocidas o inválidas. No modifica
caducidad, aptitud, política de almacenamiento ni reglas clínicas. Los controles
de fecha existentes permanecen nativos.

## Integración y límites

Las consultas se montan solo con el permiso de vista y el de destino; no se
recupera un resumen global para luego ocultarlo en el navegador. Cada endpoint
real debe autorizar al usuario y devolver únicamente su ámbito permitido. Los
adaptadores operativos no implementados siguen rechazando las lecturas de forma
segura; no se inventa un endpoint agregado desplegado.

Antes de conectar APIs paginadas, acordar conteos totales por permiso y filtros;
no contar una sola página como si representara todo el servicio. No hay llamadas
nuevas a servicios externos, escrituras automáticas, migraciones ni dependencias
adicionales. El backend y la validación clínica integrada permanecen pendientes.

Rollback: revertir este cambio de Inicio, sus parámetros y los cuatro permisos
de vista. No borrar borradores ni registros del almacenamiento. Las asignaciones
de roles que se hagan en el servidor deben coordinarse con esa reversión.

## Validación

La evidencia de esta entrega está en VALIDATION.md. Incluye perfiles individuales,
combinaciones, permisos denegados, enlaces exactos, recarga directa, pestaña de
seguimientos y ausencia de escrituras al abrir una nueva postulación.

Los resúmenes y vistas previas se calculan sobre las listas completas del contrato
mock. Antes de añadir paginación de servidor habrá que acordar totales, filtros y
orden con la API; no se debe interpretar el tamaño de una página como el total.
Los accesos no reservan ni autorizan unidades y el backend sigue siendo la
autoridad para validar permisos, estado y concurrencia al confirmar operaciones.
