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
- No gestiona urgencias, consulta externa ni facturación.
- No sustituye el módulo de admisión completa ni el alta hospitalaria global.

## Integraciones

- APIs de ward, camas, ubicaciones y pacientes internados.
- Componentes de vista de sala, header y selector de ubicación.
- Rutas y recursos propios del contexto de hospitalización.

## Validación de presentación

- `yarn workspace @sihsalus/esm-ward-app test`: encabezado, selección inicial, carga, ubicación inválida y cambio de sala; conserva las pruebas de camas y pacientes.
- Verificar en escritorio y móvil que el selector sea accesible y que las camas y acciones de la sala sigan visibles al desplazarse.
