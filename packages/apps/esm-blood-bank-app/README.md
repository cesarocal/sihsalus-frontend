# esm-blood-bank-app

Microfrontend prototipo para los procesos de Banco de Sangre de SIH Salus.

## Alcance actual

El paquete ofrece una demostración navegable con datos exclusivamente sintéticos para:

- panel operativo;
- registro de donantes con datos personales y trazabilidad de donaciones;
- selección del postulante;
- extracción de sangre total y aféresis;
- fraccionamiento y trazabilidad de hemocomponentes;
- inventario de unidades;
- solicitud, compatibilidad, reserva y entrega transfusional;
- registro inicial de reacciones transfusionales;
- historial de eventos de auditoría.

La selección sigue la estructura del Anexo 1 de la Guía Técnica aprobada por la
R.M. N.° 241-2018-MINSA. La referencia normativa se muestra en la interfaz y se
mantiene como configuración del módulo. Este prototipo no sustituye una revisión
clínica, legal o de contenido vigente.

## Límites funcionales

- No persiste datos ni invoca servicios clínicos.
- No debe usarse con pacientes, donantes o unidades reales.
- Los botones representan transiciones de interfaz, no operaciones clínicas.
- No implementa firma digital, huella digital, integración LIS, impresión oficial
  ni decisiones automáticas de elegibilidad.
- La calificación final siempre debe depender de un profesional autorizado y del
  backend clínico correspondiente.

## Integración futura

El módulo deberá conectarse a un backend OpenMRS/OMOD que modele episodios de
donación, muestras, unidades, hemocomponentes, resultados, reservas, entregas,
transfusiones, descartes y reacciones como recursos trazables. Los conceptos,
formularios, tipos y reglas clínicas deberán entrar por `config-schema`; no deben
quedar codificados en componentes.

Dependencias previstas:

- OpenMRS Web Services REST para sesión, personas, pacientes, ubicaciones y
  proveedores;
- FHIR R4 cuando exista un recurso y perfil acordado;
- un OMOD de Banco de Sangre para el dominio que OpenMRS/FHIR estándar no cubra;
- privilegios backend para lectura, registro, validación, reserva, entrega,
  descarte y auditoría;
- integración LIS opcional para resultados validados.

## Desarrollo y validación

```sh
SIHSALUS_DEV_APPS=esm-blood-bank-app yarn start
yarn workspace @sihsalus/esm-blood-bank-app standalone
yarn workspace @sihsalus/esm-blood-bank-app lint
yarn workspace @sihsalus/esm-blood-bank-app typescript
yarn workspace @sihsalus/esm-blood-bank-app test
yarn workspace @sihsalus/esm-blood-bank-app build
```

`standalone` abre el prototipo en `http://localhost:8090` sin backend ni login.
Es exclusivamente local, usa datos sintéticos y no modifica la autenticación del SPA.

La validación clínica posterior debe realizarse con datos sintéticos en DEV/QLTY
coordinado. Nunca usar producción, PHI, donantes ni pacientes reales.

Para probar el módulo dentro del shell real de OpenMRS sin una cuenta backend,
inicie el servidor raíz con `SIHSALUS_DEV_MOCK_LOGIN=true` y use
`usuario123` / `usuario123`. Este bypass existe solo en el proxy local.
