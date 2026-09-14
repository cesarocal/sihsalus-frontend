# esm-ward-app

App para la gestión operativa de sala/hospitalización.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo

- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales

- Presenta la sala, camas, pacientes internados y acciones operativas del ward.
- Facilita la navegación por vista de sala, tarjetas de paciente y selección de ubicación.
- Usa el encabezado compartido de Citas (`PageHeader`) con el título Hospitalización y el selector de sala persistente. Antes de seleccionar una sala muestra una indicación; conserva el encabezado durante la carga y ante una ubicación inválida.
- La sala seleccionada se identifica en la URL. Cambiarla mantiene la ruta `/home/ward/:locationUuid`, sin anidar ubicaciones ni usar un iframe. El contenido utiliza el scroll de la página para ajustarse a la altura del encabezado.
- El catálogo del selector lee todas las páginas REST de ubicaciones con la etiqueta `Admission Location`. Distingue carga, catálogo vacío y error; permite reintentar sin cambiar la sala seleccionada y no presenta listas parciales.
- Las vistas y workspaces montados como parcels independientes resuelven la misma sala desde la ruta canónica, incluso fuera del Router de React. La sede de inicio de sesión no sustituye una selección de sala.
- Una ubicación inexistente o sin la etiqueta de admisión muestra un estado inválido. Los fallos de consulta permiten reintentar; una respuesta ausente, malformada o de otra sala no habilita el contenido clínico.
- El nombre de la sala, las métricas y las solicitudes de ingreso se distribuyen en varias filas cuando falta espacio. Un fallo al leer solicitudes se muestra aunque todavía no existan datos.
- No gestiona urgencias, consulta externa ni facturación.
- No sustituye el módulo de admisión completa ni el alta hospitalaria global.

## Integraciones

- APIs de ward, camas, ubicaciones y pacientes internados.
- El catálogo usa `/ws/rest/v1/location` con filtro `tag=Admission Location` y representación `uuid,display,name`; la validación de la sala conserva la consulta individual con sus etiquetas. Reutiliza SWR y la paginación compartida del framework.
- Componentes de vista de sala, header y selector de ubicación.
- Rutas y recursos propios del contexto de hospitalización.

## Validación de presentación

- `yarn workspace @sihsalus/esm-ward-app test`: estados del selector, paginación y reintentos, errores de solicitudes, ubicación inválida o discordante, navegación dentro y fuera del Router; conserva las pruebas de camas y pacientes.
- Verificar en escritorio y móvil que el selector sea accesible, que los nombres largos y las métricas no oculten acciones y que las camas sigan visibles al desplazarse.
- En DEV/QLTY con datos sintéticos, verificar cambio de sala, atrás/adelante, vistas predeterminada y materna, solicitudes y sus workspaces. Las pruebas locales con respuestas simuladas no sustituyen esta comprobación del SPA desplegado y su contenido.
