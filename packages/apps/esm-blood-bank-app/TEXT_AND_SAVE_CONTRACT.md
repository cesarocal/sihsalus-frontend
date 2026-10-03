# Texto y confirmaciones de guardado

## Alcance

Aplicación al ESM del contrato upstream
[text-input-and-save-feedback](https://github.com/sihsalus/sihsalus-frontend/blob/4e4fb34d4b836767e629841e99582eb424a78559/docs/clinical/text-input-and-save-feedback.md),
referenciado por `CONTRIBUTING.md` actualizado el 29 de septiembre de 2026.
Solo cambia `esm-blood-bank-app`: no actualiza Yarn, componentes globales,
roles, login ni backend. Los datos siguen siendo sintéticos.

## Contrato del lote de bolsa

| Aspecto                        | Definición actual                                                                                                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Campo y destino mock           | `CollectionRecord.registry.bagLot`, clave `sihsalus.blood-bank.processing.mock.v1` en `sessionStorage`                                                                                                                                                                |
| Definición compartida          | `src/shared/text-field-contracts.ts`: máximo heredado de 50 unidades UTF-16                                                                                                                                                                                           |
| Conteo                         | `String.length`, sin recortar espacios ni normalizar Unicode. Un emoji suplementario cuenta como dos unidades; CRLF cuenta como dos                                                                                                                                   |
| Motivo                         | Conservar el límite técnico que ya tenía el registro y corregir su omisión en borradores; no es un umbral clínico nuevo                                                                                                                                               |
| Referencia de modelo propuesta | Los DDL entregados, `DDL_Banco_Sangre.sql` y `DDL_Banco_y_Nucleo.sql`, declaran `lote_bolsa varchar(50)`. No acreditan un OMOD desplegado ni su unidad de conteo                                                                                                      |
| Garantías frontend y mock      | Contador y error accesibles; validación antes de guardar borrador o etapa y en el adaptador; sin `maxLength`, recorte ni sustitución silenciosa                                                                                                                       |
| Compatibilidad histórica       | Leer/reabrir conserva el valor completo. Un intento de escritura incompatible se rechaza sin cambiar la copia guardada; un borrador editable admite corrección explícita. Un registro cerrado sigue siendo de consulta, sin desbloquearlo ni migrarlo automáticamente |
| Pendiente backend              | Confirmar endpoint, DTO, esquema desplegado, charset, límite y unidad de conteo; acordar compatibilidad/migración antes de conectar el adaptador real                                                                                                                 |

El límite heredado UTF-16 puede ser más conservador que un `varchar(50)` que
cuente caracteres Unicode. No se declara equivalencia ni se cambia esa política
sin confirmar el backend. Los borradores permiten campos obligatorios vacíos,
pero no texto que exceda este límite. El texto pegado permanece visible y
editable, incluso si no puede guardarse.

## Campos sin un máximo backend confirmado

No se añaden máximos genéricos. Quedan pendientes de contrato funcional y
backend los siguientes grupos de texto libre:

| Grupo       | Campos representativos / destino previsto                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Postulación | Nombres, domicilio/contacto, detalles de entrevista, observaciones, motivo y responsables; API de selección propuesta |
| Extracción  | Textos de etiqueta, receptor, servicio/responsable y observaciones del registro; API de extracción propuesta          |
| Tamizaje    | Responsables, reactivo, marca, lote de reactivo y observaciones; API de tamizaje propuesta                            |

Antes de limitar esos campos deben verificarse su destino concreto, capacidad,
necesidad funcional, unidad de conteo y datos históricos. Las validaciones
estructuradas preexistentes (documentos, fechas, signos vitales y volúmenes)
no se cambian en este ajuste.

## Mensajes y salida

- Cada aviso identifica la operación: creación/actualización de borrador,
  admisión, datos personales, examen físico, entrevista, precalificación,
  etiquetas, volumen, registro, constancia, recepción, resultados o validación.
- Solo se anuncia éxito después de resolver la escritura mock. Las etapas
  intermedias no anuncian selección, extracción o tamizaje finalizados.
- Los avisos dicen **en esta pestaña**: no implican una escritura en OpenMRS,
  persistencia clínica, sincronización, uso offline durable ni envío de correo.
  Recargar la misma pestaña conserva el mock; cerrar la pestaña puede perderlo.
- La salida distingue `saved`, `unchanged`, `failed` y descarte. Un formulario
  guardado sin nueva edición se cierra sin escribir, incrementar su revisión
  ni emitir un aviso de éxito. Una ficha nueva todavía puede crear un borrador.
- Se conserva **Seguir editando / Salir** y la casilla marcada por defecto.
  Un fallo mantiene la edición; el usuario puede corregir o decidir descartar
  solamente sus cambios no guardados. El error no muestra trazas ni datos personales.
- Se reutiliza el snackbar global existente, cerrable y con duración de cinco
  segundos. No se crea un sistema paralelo de notificaciones.
- Tamizaje nunca anuncia liberación de la unidad: sigue en cuarentena.

Los adaptadores OpenMRS continúan deshabilitados. Antes de conectarlos deberán
distinguir conflicto, rechazo e incertidumbre de un timeout, reconciliar el
estado confirmado y garantizar idempotencia; no copiar una política de reintento
ciego desde el mock.

## Regresiones y verificación

Las pruebas del ESM cubren N−1/N/N+1, tildes, Unicode compuesto/descompuesto,
emoji, CRLF, conservación y lectura de históricos, rechazo atómico,
contador/descripción accesible, texto completo tras entrada excesiva,
guardado al salir, errores seguros, creación/edición, cierre sin cambios y
éxito de etapa frente a finalización.

La evidencia de este ajuste debe ejecutarse contra el diff actual; las tablas
históricas en otros README no lo validan. El E2E clínico integrado permanece
pendiente: no hay contrato OMOD implementado para estas escrituras.

### Evidencia local — 2026-10-03

Diff sin commit en `bloodBank`, base
`96fb82f8b1b538f67b10ad14e6c6fbc42943708f`. Windows, Node 24 y Yarn local
4.13.0; sin acceso a producción ni escrituras OpenMRS.

| Estado  | Comando/caso                                                                                                                | Resultado y alcance                                                                                                                                                                                                                      |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | Scripts del workspace `lint`, `typescript`, `test`                                                                          | Exit 0; lint 101 archivos; 189/189 pruebas en 17 archivos; consumidores internos de la confirmación incluidos                                                                                                                            |
| PASSED  | `yarn turbo run lint typescript test --filter=@sihsalus/esm-blood-bank-app --concurrency=2 --force` con `TZ=UTC`            | Exit 0; 46/46 tareas, cero cacheadas; incluye builds/typechecks de dependencias, sin modificar sus fuentes                                                                                                                               |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build`                                                                         | Exit 0; dos avisos de tamaño, main ~428 KiB y vendor ~258 KiB                                                                                                                                                                            |
| PASSED  | `validate:workspaces`, `validate:critical-route-privileges`, `validate:react-router`, `validate:error-exposure --base HEAD` | Exit 0; 15 apps críticas fail closed; cero exposiciones en 10 fuentes cambiadas                                                                                                                                                          |
| PASSED  | Paridad de claves EN/ES de `processing` y `selection`                                                                       | Exit 0; no hay claves faltantes ni sobrantes                                                                                                                                                                                             |
| PASSED  | Playwright/Edge headless: contrato de texto y guardado, 1440×1000 y 375×900                                                 | Creación/edición/cierre sin cambios; pegado real de 51 unidades con emoji; contador y error accesibles; bloqueo de borrador/salida sin escritura; recarga, histórico completo y corrección explícita                                     |
| PASSED  | Playwright/Edge headless: regresión de navegación, salida, cabeceras, filtros y snackbar                                    | Donantes activo en detalle/recarga/volver; cancelación y descarte conservan borradores; dos acciones; 12 cabeceras; cierre manual y automático del snackbar; escritorio/tablet/móvil                                                     |
| PASSED  | `prettier --check` de los cuatro documentos afectados; `git diff --check`                                                   | Exit 0                                                                                                                                                                                                                                   |
| FAILED  | `yarn verify:changed --base HEAD`                                                                                           | Exit 1 después de identificar únicamente el ESM; diagnóstico reproducido: `spawnSync yarn.cmd` devuelve `EINVAL` en Windows/Node 24. Se ejecutó arriba el equivalente Turbo directamente con el Yarn local, sin modificar tooling global |
| BLOCKED | Gate E2E clínico integrado con OpenMRS/OMOD                                                                                 | No ejecutado: adaptadores reales deshabilitados y contrato de persistencia aún no implementado; el smoke mock no valida integración clínica                                                                                              |

Los tres smokes usaron una fixture temporal fuera de Git, con componentes reales
del ESM, Carbon y snackbar, pero sesión/RBAC/traducción simulados. Cada ejecución
terminó con cero errores de página y cero peticiones externas; los contextos
se cerraron y el caso de texto limpió ambas claves sintéticas. Se inspeccionaron
las capturas de lote excesivo en escritorio y de histórico en móvil. No se
añadió un standalone al producto.

El rebuild de dependencias regeneró tres archivos compilados de tooling. Se
restauraron al contenido inicial de Git, sin cambios globales en el diff; después
se repitieron las 189 pruebas con `TZ=UTC` y el typecheck del ESM, ambos con exit 0.

El build de `esm-styleguide` como dependencia también produjo tres advertencias
de tamaño, y la fixture mostró avisos Sass de Carbon. No se verificaron como
preexistentes en `origin/main`; no se modifican dependencias ni estilos globales
para resolverlos. La actualización monorepo a Yarn 4.18.1 sigue fuera del alcance.

Rollback: revertir este ajuste del ESM. No hay migración ni datos OpenMRS que
restaurar; no borrar los borradores históricos como procedimiento de rollback.
