# SIH Salus Banco de Sangre

Microfrontend base para construir los flujos de Banco de Sangre. Incluye Inicio, Donantes, Selección del postulante, Extracción y aféresis, Laboratorio, Transferencias, Inventario y Transfusiones.

El [contrato de texto y confirmaciones de guardado](TEXT_AND_SAVE_CONTRACT.md) documenta el límite heredado del lote de bolsa, los mensajes por operación, la persistencia mock por pestaña y lo pendiente de verificar en el backend.

## Límites actuales

- Inicio, Donantes e Inventario consumen el contrato `BloodBankApi` con datos sintéticos.
- Donantes y Registro de donantes incluyen búsqueda, filtros y paginación. Ver detalle abre una pantalla completa en `/blood-bank/donors/:donorId`, con opción de volver al listado, datos personales de la última donación registrada e Historial de donaciones ordenado por fecha. No permite editar ni muestra respuestas de entrevista/motivos de exclusión.
- El botón Registrar donación, a la derecha del historial, abre Selección con una nueva postulación y datos personales editables. Requiere permisos de Donantes y Selección. Solo copia identidad/datos personales; modalidad, examen, entrevista y calificación requieren una evaluación nueva. Los viajes previos no se copian.
- Selección del postulante incluye listado, filtros, formulario por etapas e impresión. Su avance se conserva en `sessionStorage` de la pestaña, exclusivamente para datos sintéticos.
- Extracción incluye cola de seleccionados, etiquetas de unidad/tubo, volumen, registro y constancia imprimible.
- Laboratorio / Tamizaje incluye recepción, siete pruebas, trazabilidad de reactivos, revisión e impresión.
- Las demás rutas son bases visuales; todavía no guardan información clínica.
- `useMockData` está habilitado por defecto. Desactivarlo requiere una API real compatible.
- Las pantallas se prueban dentro de la SPA de OpenMRS, con su sesión, navegación compartida y controles de privilegios. Los datos mock siguen disponibles mediante `useMockData`.

## Contratos de integración

- Ruta OpenMRS: `/blood-bank`.
- Tras el login estándar, `/home` selecciona el dashboard de Banco de Sangre si es el único autorizado para el usuario. La extensión `homepage-dashboard-slot` redirige `/home/blood-bank` a `/blood-bank` sin requerir `app:home` ni cambiar el ESM de login. El módulo debe estar incluido en el SPA y el rol necesita `app:home.bancoSangre`.
- Privilegio de entrada: `app:home.bancoSangre`, declarado en `src/routes.json` y centralizado para TypeScript en `src/access/blood-bank-privileges.ts`.
- Las secciones tienen privilegios propios en `src/access/blood-bank-privileges.ts`. `src/navigation/blood-bank-navigation.ts` los asocia a los enlaces y `src/blood-bank-app.component.tsx` protege el acceso por URL directa. Seguimiento de donante y de receptor tienen privilegios independientes; la antigua ruta `/laboratory/follow-up` redirige al seguimiento del donante.
- El rol y sus privilegios se crean y asignan en OpenMRS; las constantes TypeScript no los crean en el backend. Se requieren el privilegio de entrada y el de la sección. La API real también debe verificar autorización.
- Las pantallas están bajo `src/sections/`; `src/shared/` contiene componentes reutilizables y `src/api/` separa mocks y acceso futuro a datos reales.
- En OpenMRS, `src/root.component.tsx` registra `blood-bank-nav-slot` mediante `useLeftNav`. `src/navigation/blood-bank-nav.extension.tsx` aporta al slot los enlaces visibles según privilegios. La barra lateral compartida la dibuja `esm-primary-navigation-app`; el ESM no la duplica. El enlace global a Inicio sigue siendo responsabilidad de `esm-home-app`.
- Donantes permanece activo en `/blood-bank/donors` y sus rutas de detalle. Se reconoce el límite de segmento `/donors/`, no prefijos similares como `/donors-other`. Inicio y Selección no quedan activos en el detalle; la visibilidad y los permisos no cambian. La base de la SPA se obtiene de OpenMRS.
- Dependencia declarada: `webservices.rest >= 2.24.0`.
- Endpoints previstos cuando `useMockData=false`:
  - `GET /ws/rest/v1/bloodbank/dashboard`
  - `GET /ws/rest/v1/bloodbank/donors`
  - `GET /ws/rest/v1/bloodbank/inventory`

El backend continúa siendo la autoridad para autorización y persistencia. No se deben usar datos reales ni información identificable en mocks o pruebas.

### Presentación de las pantallas de Banco de Sangre

Donantes, Selección, Extracción y Tamizaje comparten fondo blanco, `PageHeader` de `esm-styleguide`, tarjetas con título/unidad pequeña/valor y tablas Carbon. Los colores de campos y encabezados de tabla se mantienen para distinguir controles. Los cambios están limitados al ESM, sin alterar componentes globales ni privilegios existentes; el detalle añade una ruta interna protegida por el permiso de Donantes.

`src/shared/blood-bank-page-illustration.component.tsx` centraliza las ilustraciones de cabecera: `PatientsPictogram` (Donantes), `UserFollowIcon` ampliado (Selección, mismo símbolo que el navbar), `BloodBankPictogram` (Extracción) y `LaboratoryPictogram` (Tamizaje, igual que Laboratorio).

El detalle no repite el nombre del donante debajo de la cabecera: lo conserva en Datos personales. Volver al listado utiliza la composición `PageHeader`/`PageHeaderContent`. El marco de datos reduce espacios con tokens de Carbon y el título Historial de donaciones utiliza `heading-03`, sin tamaños tipográficos personalizados ni cambios a otros formularios.

Historial de donaciones incluye fechas Desde/Hasta (límites inclusivos), modalidad y búsqueda por código de unidad o número de postulación. Los filtros se combinan, reinician la paginación y pueden limpiarse; no editan registros ni cambian el orden de más reciente a más antiguo. Un rango invertido muestra una advertencia, no un falso historial vacío. El filtrado es local sobre los registros del contrato de lectura; antes de introducir paginación de servidor habrá que acordar filtros y orden con la API.

Debajo aparece Historial de reacciones adversas del donante, con el mismo componente Carbon, paginación y estado vacío, independiente de los filtros de donaciones. Las columnas provisionales son Fecha, Código de unidad, Reacción y Severidad. `DonorDetail.adverseReactions` aporta exclusivamente ejemplos mock (Ana tiene un evento sintético; Luis no tiene registros). No se capturan ni deducen reacciones a partir del campo Complicaciones de Extracción, ni se modifican estados o exclusiones. El modelo, permisos clínicos y API de reacciones quedan pendientes de definir antes de cualquier integración real.

Todas las cabeceras del ESM muestran a la derecha la ubicación activa de `useSession` y la fecha/hora local con `formatDatetime`. `src/shared/blood-bank-page-header.component.tsx` reutiliza `PageHeaderContent` para las pantallas operativas y comparte el contexto con las cabeceras de Inicio, Inventario y las bases de pantalla. El reloj se actualiza mientras la pantalla está abierta; no se fija un hospital en el código.

Los guardados correctos de Selección, Extracción y Tamizaje llaman a `showSnackbar` a través de `src/shared/notify-success.ts`: notificaciones cerrables, con autocierre a los cinco segundos, en el host global existente (abajo a la izquierda). No se crea un host ni un componente de notificaciones propio, ni se modifica su posición global. Los errores de guardado y las advertencias clínicas permanecen dentro del formulario. Los mensajes no incluyen datos personales ni detalles técnicos del backend.

No se muestran avisos de prototipo en la interfaz; esto **no cambia** el uso exclusivo de mocks ni convierte las pantallas en un sistema clínico listo para producción. Las impresiones conservan su marca visible de datos sintéticos/no válidos para uso clínico y se mantienen las advertencias de seguridad clínica.

`BloodBankApi.getDonorDetail` y `getDonorRegistry` son contratos de lectura separados del flujo de extracción. `src/api/donors.api.ts` mapea los endpoints propuestos `GET /ws/rest/v1/bloodbank/donors/:id` y `GET /ws/rest/v1/bloodbank/donations`; los adaptadores reales fallan de forma segura hasta validar el OMOD. Deben autorizarse en el servidor con el acceso correspondiente a Donantes. No exigen ni conceden permisos adicionales de Extracción desde el frontend.

El contrato `DonorDetail` incluye el tipo de documento y una referencia opcional `patientUuid`; no se inventan UUIDs de OpenMRS. La navegación a Selección transporta solo el ID del donante en el estado del router y vuelve a consultar el detalle bajo autorización. La referencia se consume una vez para no reabrir el formulario. Si falla la lectura, se permite reintentar o cancelar sin crear una postulación vacía. La consulta mock de antecedentes comparte las identidades del listado y mantiene las comprobaciones de identidad y exclusión.

## Selección del postulante (prototipo navegable)

Ruta integrada: `http://localhost:8080/openmrs/spa/blood-bank/applicant-selection`.
El usuario necesita `app:home.bancoSangre` y `app:home.bancoSangre.seleccionPostulante`.
No cambia el login, el navbar compartido, ni añade un standalone.

Incluye Admisión → Datos personales → Examen físico → Entrevista → Precalificación → Revisión.
Al finalizar el examen físico regresa al listado: **Entrevistar** permite revisar las tres primeras etapas sin editarlas.
La X abre una confirmación con dos acciones: **Seguir editando** y **Salir**. La casilla **Guardar el avance antes de salir** está marcada por defecto en Selección, Extracción y Tamizaje. Desmarcarla descarta solo los cambios no guardados, sin eliminar el registro previo. Durante el guardado no se permite otra salida ni un segundo envío; un fallo mantiene el formulario y su edición. Los documentos finalizados conservan su cierre de consulta sin guardar. La advertencia del examen físico mantiene sus tres decisiones clínicas independientes.
La revisión incluye el formulario imprimible para firmas físicas.

Los borradores sobreviven a recargas en la misma pestaña, no al cierre de la pestaña.
El navegador no es una base de datos clínica: no use personas reales y no interprete estos controles como autorización del servidor.
La configuración `useMockData=true` (por defecto) habilita este flujo. Si se desactiva, selección muestra un error seguro: todavía no existe su backend.

Casos de prueba:

| Código de donante | DNI ficticio | Caso                                          |
| ----------------- | ------------ | --------------------------------------------- |
| DEMO-001          | 90000001     | Autocompletado editable, sin exclusión previa |
| DEMO-002          | 90000002     | Mujer, exclusión temporal hasta 2099-12-31    |
| DEMO-003          | 90000003     | Exclusión permanente                          |

Deje el documento vacío al introducir el código para cargar su identificación, o introduzca el DNI correspondiente.
Un código y documento que no corresponden bloquean la admisión. El aviso de antecedentes no revela el motivo.
Al guardar la revisión, solo **Apto** pasa a **Seleccionado**; los otros resultados quedan como **No apto temporal/permanente**.
Selección por sí sola no crea un donante ni una unidad, ni habilita transfusiones.
Los seleccionados pasan a Extracción. Completar Etiqueta crea una muestra en Tamizaje; registrar el volumen muestra la unidad en Inventario en cuarentena.
Guardar Registro actualiza Donantes; guardar Constancia retira la postulación del listado activo y conserva sus antecedentes.

El detalle de archivos, mapeo del modelo y límites clínicos está en [Selección del postulante](src/sections/applicant-selection/README.md).

## Extracción y Tamizaje (prototipo navegable)

- [Extracción y aféresis](http://localhost:8080/openmrs/spa/blood-bank/collection): requiere `app:home.bancoSangre.extraccionAferesis`.
- [Laboratorio / Tamizaje](http://localhost:8080/openmrs/spa/blood-bank/laboratory/screening): requiere `app:home.bancoSangre.laboratorio.tamizaje`.

También requieren el privilegio de entrada del módulo; mantienen los enlaces y guards existentes, sin cambiar navbar ni login.
Hay un seleccionado inicial (DNI ficticio `90000012`) y una muestra inicial `M-DEMO-001` para probar ambas pantallas.
Tamizaje separa **Donantes** y **Seguimientos**, con colas e historiales validados
independientes. Solo Donantes registra muestras de aféresis: buscar postulación,
revisar su identificación y confirmar/imprimir la etiqueta. En una sesión mock
nueva también hay `M-SEG-DEMO-001` y la postulación de aféresis `000001`
(DNI ficticio `90000010`); los datos guardados anteriormente no se resetean.
La muestra de aféresis no crea una unidad ni cambia la decisión de selección.
Ver [Tamizaje por origen](src/sections/laboratory/screening/README.md) para contratos,
compatibilidad, permisos, escenarios de prueba y limitaciones del backend pendiente.
Los contratos de API están en `src/api/blood-bank-processing.api.ts`; los adaptadores reales fallan de forma segura hasta implementar el OMOD.
No se liberan unidades, diagnostican infecciones, envían correos ni archivan PDF en OpenMRS.
Ver [Extracción y Tamizaje](src/sections/collection/README.md) para organización, mapeo y evidencia.

## Fraccionamiento (prototipo navegable)

Ruta: `/blood-bank/laboratory/fractionation`, con el privilegio
`app:home.bancoSangre.laboratorio.fraccionamiento` y el acceso al módulo existente.
Incluye cola con selección homogénea en lote, árbol por unidad, etiquetas,
volúmenes, revisión y confirmación para ingresar resultados en cuarentena.
Cada fila elegible también permite fraccionar su unidad sin usar la selección
del lote. Dividir queda bloqueado hasta deshacer esa rama; el avance se guarda
al continuar o, de forma opcional, al salir con la X, sin botón Guardar avance
en este flujo. Los demás formularios conservan sus acciones existentes.
El plasma rico en plaquetas puede ser un resultado final del flujo mock sin
obligar a dividirlo; mantiene etiqueta, volumen y cuarentena. Esta opción no
aprueba su conservación ni su uso clínico.
Los orígenes pasan a En laboratorio al iniciar y a Fraccionados al finalizar;
permanecen trazables en el historial, fuera del inventario activo.
Usa los mocks de procesamiento existentes de forma aditiva y mantiene sus datos.
Ver [Fraccionamiento](src/sections/laboratory/fractionation/README.md) para los
contratos propuestos de API/OMOD, referencias aportadas, límites y validación.

## Desarrollo integrado con OpenMRS

Después de preparar el SPA según el README principal:

```bash
SIHSALUS_DEV_APPS=esm-blood-bank-app yarn start
```

El usuario de pruebas necesita el privilegio `app:home.bancoSangre`.
Tras cambiar `src/routes.json`, vuelve a ejecutar `yarn assemble` y reinicia `yarn start` para registrar el nuevo slot. Prueba la barra compartida en `http://localhost:8080/openmrs/spa/blood-bank` con un usuario de pruebas autorizado.

El cliente HMR de la versión local de Rspack falla al cargar este ESM (`setLogLevel`). Por ahora, `rspack.config.js` desactiva solo ese cliente para Banco de Sangre: el servidor recompila los cambios, pero debes recargar el navegador manualmente. Reinicia `yarn start` después de cambiar esta configuración.

## Verificación

```bash
corepack yarn workspace @sihsalus/esm-blood-bank-app lint
corepack yarn workspace @sihsalus/esm-blood-bank-app typescript
corepack yarn workspace @sihsalus/esm-blood-bank-app test
corepack yarn workspace @sihsalus/esm-blood-bank-app build
```
