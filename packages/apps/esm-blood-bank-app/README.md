# SIH Salus Banco de Sangre

Microfrontend base para construir los flujos de Banco de Sangre. Incluye Inicio, Donantes, Selección del postulante, Extracción y aféresis, Laboratorio, Transferencias, Inventario y Transfusiones.

## Límites actuales

- Inicio, Donantes e Inventario consumen el contrato `BloodBankApi` con datos sintéticos.
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
- Dependencia declarada: `webservices.rest >= 2.24.0`.
- Endpoints previstos cuando `useMockData=false`:
  - `GET /ws/rest/v1/bloodbank/dashboard`
  - `GET /ws/rest/v1/bloodbank/donors`
  - `GET /ws/rest/v1/bloodbank/inventory`

El backend continúa siendo la autoridad para autorización y persistencia. No se deben usar datos reales ni información identificable en mocks o pruebas.

## Selección del postulante (prototipo navegable)

Ruta integrada: `http://localhost:8080/openmrs/spa/blood-bank/applicant-selection`.
El usuario necesita `app:home.bancoSangre` y `app:home.bancoSangre.seleccionPostulante`.
No cambia el login, el navbar compartido, ni añade un standalone.

Incluye Admisión → Datos personales → Examen físico → Entrevista → Precalificación → Revisión.
Al finalizar el examen físico regresa al listado: **Entrevistar** permite revisar las tres primeras etapas sin editarlas.
La X confirma la salida y ofrece guardar el avance o descartar solo los cambios no guardados.
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
Los contratos de API están en `src/api/blood-bank-processing.api.ts`; los adaptadores reales fallan de forma segura hasta implementar el OMOD.
No se liberan unidades, diagnostican infecciones, envían correos ni archivan PDF en OpenMRS.
Ver [Extracción y Tamizaje](src/sections/collection/README.md) para organización, mapeo y evidencia.

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
