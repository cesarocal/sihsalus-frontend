# Evidencia local: atención transfusional regular

La sección del 16 de octubre conserva la evidencia histórica del flujo inicial.
Para los ajustes de stock, selector y presentación, consultar las secciones
del 17 de octubre al final de este documento.

Fecha: 16 de octubre de 2026, America/Lima. Rama `bloodBank`, cambios locales sin
commit sobre `9716de694c27c6a5c8fdea8fc42263b892520dc2`. Esta evidencia corresponde
al diff de este lote, no a un despliegue, CI de PR ni a validación clínica.
Se utilizó Node 24.19.0, Yarn 4.13.0 y `TZ=UTC` para Vitest. No se instalaron
dependencias ni se modificaron manifiestos, lockfile, SQL o componentes globales.

Los comandos Yarn se ejecutaron con el runtime Node 24 disponible y
`node .yarn/releases/yarn-4.13.0.cjs` (equivalente a `yarn`). No se usaron resultados
de caché de Turbo como evidencia de pruebas ejecutadas.

## Matriz

| Estado  | Comando o caso                                                                 | Resultado y alcance                                                                                                                                                                                                                                             |
| ------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app lint`                             | Exit 0; 164 archivos, sin advertencias de lint.                                                                                                                                                                                                                 |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app typescript`                       | Exit 0; contrato y consumidores dentro del ESM.                                                                                                                                                                                                                 |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test --maxWorkers=2`              | Exit 0; 351/351 pruebas en 28 archivos; incluye Inventario, Transferencias, Fraccionamiento y guards de rutas. Duración final: 62,80 s.                                                                                                                         |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build`                            | Exit 0; Rspack 1.7.11, con dos avisos de tamaño de asset/entrypoint; no es validación clínica.                                                                                                                                                                  |
| PASSED  | `yarn validate:workspaces`                                                     | Exit 0; hard checks; 68 archivos de rutas, 102 workspace2, 45 workspaceWindow2. El inventario enumera también 36 registros legacy, sin modificarlos.                                                                                                            |
| PASSED  | `yarn validate:critical-route-privileges`                                      | Exit 0; 15 aplicaciones críticas fail-closed, tres excepciones documentadas.                                                                                                                                                                                    |
| PASSED  | `yarn validate:react-router`                                                   | Exit 0; runtime 7.18.2, peers compatibles; sin flags v6 ni APIs RSC.                                                                                                                                                                                            |
| PASSED  | `yarn validate:error-exposure --base HEAD`                                     | Exit 0; 24 fuentes modificadas; cero exposiciones en el alcance cambiado. Se usa HEAD como base del lote sin commit.                                                                                                                                            |
| PASSED  | `yarn prettier --check` sobre Markdown/SCSS modificados y `git diff --check`   | Exit 0 en ambos; cuatro archivos de documentación/SCSS conformes y diff sin errores de espacios.                                                                                                                                                                |
| NOT RUN | `yarn verify:changed --base origin/main --head HEAD`                           | No hay commits nuevos ni PR: ese rango no representa este diff local. Se ejecutan directamente los scripts aplicables; no se crea un commit para activar el gate.                                                                                               |
| BLOCKED | Gate Playwright clínico integrado (`e2e`)                                      | No existe OMOD/API de atención transfusional conectado ni entorno DEV/QLTY coordinado con esos contratos, contenido clínico y sesión de pruebas. Requiere implementación y validación de responsables de backend/QA/clínica; no se sustituye por el smoke mock. |
| NOT RUN | `yarn validate:concepts`                                                       | No se añaden conceptos ni UUIDs clínicos/defaults. Ningún valor DEMO representa metadata OpenMRS.                                                                                                                                                               |
| NOT RUN | `yarn install --immutable`, auditoría de dependencias, build/assemble completo | No cambian dependencias, Rspack, shell, import map ni empaquetado SPA. Se verifica el build del ESM afectado; no se publica/despliega.                                                                                                                          |

## Regresión funcional

`mock-transfusions.api.test.ts` añade dieciséis casos: veinte unidades sin aprobación
implícita; urgencias bloqueadas; prioridad/antigüedad; filtro por día local (UTC−5);
borrador frente a muestra
canónica; identidad/fechas; cantidades por componente; exclusión de autólogas,
fechas inválidas/futuras y caducidad; reservas compartidas; resultados parciales;
liberación de incompatibles; reemplazo conservando aprobadas; plasma sin ronda
ficticia; entrega/idempotencia/libro; revisiones y muestra vencida; atomicidad al
fallar almacenamiento; preservación de datos y adaptador real deshabilitado.

`transfusions.component.test.tsx` añade nueve casos: filtros y acciones;
revisión/muestra/impresión; selección de ida y vuelta; pares y confirmación de
resultados; impresión frente a entrega; guardado al salir; errores seguros con
reintento en ambas pantallas; distinción entre egreso y administración; textos
ES/EN y escape de contenido imprimible. Se añaden dos casos parametrizados de
permisos para verificar que una URL sin privilegio no lee la API.

Las pruebas de Inventario se actualizan a las veinte filas nuevas: búsqueda y
paginación reales antes de seleccionar una fila. No se eliminan validaciones,
no se omiten pruebas y no se usa `--passWithNoTests` como evidencia funcional.

## Smoke aislado de navegador

PASSED en Edge headless con componentes reales, adaptadores mock y shell de
prueba sintético: nueve casos desktop 1920×1080 / móvil 375×900. No es el shell
desplegado de OpenMRS, ni prueba permisos del servidor. El harness temporal queda
fuera de Git en la carpeta `blood-bank-transfusion-smoke-20261016` del directorio
temporal del usuario; no se añade un standalone al proyecto.

1. Revisión y etiqueta: imprimir no crea muestra canónica; Continuar sí.
2. Dos bloques: asignar 001/002/011 según cantidades.
3. Etiquetas de receptor y dos unidades eritrocitarias.
4. Resultado mixto: 001 compatible, 002 incompatible; esta última vuelve a APTO.
5. Reemplazar con 003, conservando bloqueadas 001/011 y excluyendo 002.
6. Imprimir resultados sin generar egresos.
7. Entregar: 001/003/011 salen del stock, solicitante ATENDIDA y tres egresos.
8. Recargar conserva datos sin duplicados; historial permite consultar el libro y
   filtrar sus entregas por el día local mostrado, aun cuando sea otro día en UTC.
9. Móvil: sin desbordamiento horizontal del documento, apertura y salida con X.

Resultado: tres documentos HTML preparados para impresión, tres egresos, cero
errores de página y cero peticiones externas. La solicitud de impresión se
intercepta: **no acredita impresión física ni firma**. El sello de las veinte
unidades se confirma únicamente en el fixture QA, por el adaptador de Inventario;
en el prototipo normal debe realizarlo el operador. Se inspeccionan las capturas
de dos bloques, pares receptor–unidad y móvil. Los contextos aislados se cierran
al terminar; no hay recursos backend que limpiar ni datos de pacientes reales.

## Fallos, advertencias y límites

- Los primeros tests detectaron IDs divergentes entre colección y unidades
  nuevas y supuestos de paginación/conteo antiguos. Corregidos en este lote y
  reejecutados; no se califican como fallos preexistentes.
- El primer arranque del smoke excedió el timeout de navegación. El siguiente
  encontró dos botones Entregar con el mismo nombre: se acotó el selector al
  diálogo, sin cambiar la aceptación. La repetición completa pasó.
- El build advierte tamaño de asset/entrypoint. No se ha verificado su origen en
  `origin/main`, por lo que **not verified as pre-existing**. No demuestra un
  presupuesto de rendimiento cumplido; requiere medición posterior.
- Riesgo del prototipo: medio por coordinación de reservas/egresos. Riesgo clínico
  de uso real: alto; bloqueado hasta validar matriz ABO/Rh por componente,
  muestras, consentimientos, autorizaciones, urgencias, concurrencia real y OMOD.
- No se crea usuario médico, Order real, transfusión administrada, reporte de
  complicaciones, migración, envío de correos, commit, PR ni merge.

Rollout y rollback del prototipo se describen en el README del flujo. Antes de
integración real, coordinar smoke clínico con datos sintéticos, permisos y
contenido autorizados, SHA desplegado y limpieza verificada.

## Ajustes de stock y selector — 2026-10-17

Diff local sobre la misma base `9716de694c27c6a5c8fdea8fc42263b892520dc2`, rama
`bloodBank`, Windows/Node 24.19.0/Yarn 4.13.0. Se preservan los cambios anteriores
sin commit. No hay escrituras OpenMRS, cambios de permisos, dependencias, SQL,
login ni componentes globales.

Las veinte unidades `BB-TX-DEMO-001..020` se precargan APTO con sellos únicos.
`fixtureQualitySeals` registra metadata inicial sintética, no eventos de impresión
ni aprobaciones ejecutadas por el operador. La lectura en pestañas anteriores
es aditiva y no escribe almacenamiento; no reinicia resultados, caducidades,
borradores de sellado, reservas, entregas, eliminaciones o fraccionamientos.
Fixtures inseguras/vencidas y otros componentes mantienen su validación normal.

Los dos bloques de selección tienen altura uniforme, tablas Carbon sin
paginación, regiones enfocables con scroll independiente y cabeceras fijas.
Las acciones usan flechas de 32 px con nombres accesibles/tooltip y sin texto
visible. El encabezado compacto se activa solo en Selección de unidades mediante
una opción del `ProcessingModal` propio del ESM, desactivada por defecto para
los demás consumidores. Texto explicativo actualizado en ES/EN.

| Estado  | Comando/caso                                                                  | Resultado y alcance                                                                                                                                                                                              |
| ------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app lint`                            | Exit 0; 164 archivos, sin advertencias de lint.                                                                                                                                                                  |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app typescript`                      | Exit 0; incluye consumidores del parámetro opcional de modal y metadata mock.                                                                                                                                    |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test --maxWorkers=2`             | Exit 0; 355/355 pruebas en 28 archivos; duración final 41,50 s, sin caché Turbo.                                                                                                                                 |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build` — selector final          | Exit 0; Rspack 1.7.11, dos avisos de tamaño de asset/entrypoint. Origen en origin/main no verificado; not verified as pre-existing.                                                                              |
| PASSED  | Playwright/Edge headless — selector final                                     | Once casos; tres documentos preparados, tres egresos; cero errores de página y peticiones externas. Incluye cinco cabeceras sticky, 19 candidatas, scroll de teclado, altura uniforme, flechas de 32 px y móvil. |
| PASSED  | `prettier --check`, `git diff --check`, `validate:error-exposure --base HEAD` | Exit 0 en los tres; cinco Markdown/SCSS conformes, diff sin errores de espacios, 25 fuentes modificadas y cero exposiciones.                                                                                     |
| BLOCKED | Gate clínico integrado `e2e`                                                  | Se mantiene el bloqueo: adaptador real deshabilitado y contrato OMOD/API aún sin implementar; estas pruebas sintéticas no acreditan aprobación clínica.                                                          |

Regresiones nuevas: tres casos de Inventario cubren enriquecimiento de pestañas
anteriores sin escrituras, exclusión de fixtures inseguras/vencidas o con sello
pendiente, conservación de salidas/bloqueos y componentes derivados sin heredar
sellos. Un caso UI comprueba 17 candidatas simultáneas, ausencia de paginación,
flechas sin texto y nombres accesibles. Los casos de stock de Transfusiones y
Transferencias verifican sellos únicos y que las cinco unidades anteriores no
se aprueben. Se conservan los criterios de impresión/confirmación del flujo
normal, probados con unidades independientes de esta precarga.

La primera suite completa detectó un caso de Transferencias que esperaba cero
candidatas cuando el stock estaba en cuarentena: ahora se comprueba exactamente
la unidad nueva elegible y su sello, además de la cuarentena del stock anterior.
La repetición completa pasó; no se atribuye a un fallo preexistente. El primer
smoke de esta sesión quedó detenido al arrancar el servidor de prueba; se cerró
únicamente ese proceso aislado y se repitió sin contención, sin ampliar timeouts
ni debilitar criterios. No se alteraron el navegador ni los servidores del usuario.

Las comprobaciones de navegador usan un shell, ubicación y personas sintéticas;
los sellos ya proceden de la fixture del producto, sin confirmación artificial en
el harness. Para comprobar scroll largo se añaden catorce filas solo a la lectura
del harness, nunca al almacenamiento del producto. Se verifican igual altura
(mínimo 400 px), flechas compactas sin texto, 19 candidatas sin paginación,
PageDown en la región y cabeceras fijas; también escritorio y móvil sin
desbordamiento del documento. Se conserva el recorrido funcional de muestra,
compatibilidad/reemplazo, impresión, entrega, egresos y recarga. Los contextos se
cierran; no hay recursos backend que limpiar ni impresiones físicas acreditadas.

El riesgo y rollback clínico permanecen como en el README: cambios de datos de
prueba y presentación, sin liberar unidades reales. Conservar almacenamiento de
la pestaña al revertir; no borrar registros como procedimiento de actualización.

Se inspeccionaron las capturas del selector y su desplazamiento: se corrigió la
interferencia de una regla Carbon en la última cabecera mediante especificidad
local, sin cambiar el styleguide. El bloque de selección no usa paginación; las
tablas de bandejas e historiales mantienen su comportamiento anterior.

## Ajustes de presentación y confirmaciones — 2026-10-17

Se mantiene la base, rama y entorno del lote anterior. El alcance nuevo es de
presentación: cabecera de Compatibilidad con `IbmDevopsTest`, igual al menú;
tubos de ensayo SVG rojos; títulos descriptivos y progreso compacto en todas
las etapas de Transfusiones y en Procesar pruebas. No cambia el inventario,
el contrato API, la matriz de selección, permisos ni transiciones clínicas.

Las tres confirmaciones operativas (asignar, registrar resultados, entregar)
comparten triángulo de advertencia, efectos resumidos según la operación real,
descripción accesible y botones pequeños. La acción inicial enfocada es Seguir
editando, no Confirmar. Se mantiene la X y su bloqueo durante el guardado. Los
resultados incompatibles anuncian devolución a APTO y reemplazo; la entrega
informa estado, egreso, libro e historial sin registrar administración al paciente.

Las pruebas de componentes suman trece casos: los nuevos verifican el símbolo
de cabecera, semántica y guardas de la advertencia, y asignación de solo plasma
sin anunciar pruebas cruzadas ni reservar antes de confirmar. Los casos
existentes verifican tubos, títulos y efectos de resultados mixtos/entrega.

| Estado  | Comando/caso                                                                  | Resultado y alcance                                                                                                                 |
| ------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app lint`                            | Exit 0; 166 archivos, sin advertencias de lint.                                                                                     |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app typescript`                      | Exit 0; incluye las opciones públicas de foco y consumidores del nuevo componente local.                                            |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app test --maxWorkers=2`             | Exit 0; 358/358 pruebas, 28 archivos, 48,57 s; ejecutadas sin caché Turbo.                                                          |
| PASSED  | `yarn workspace @sihsalus/esm-blood-bank-app build`                           | Exit 0; Rspack 1.7.11, dos avisos de tamaño de asset/entrypoint. Origen en origin/main no verificado; not verified as pre-existing. |
| PASSED  | Edge headless, componentes y adaptadores mock                                 | Quince casos, escritorio/móvil; incluye geometría, foco, botones, tubos y recorrido completo con reemplazo/entrega.                 |
| PASSED  | `prettier --check`, `git diff --check`, `validate:error-exposure --base HEAD` | Formato conforme, diff sin errores de espacios; 27 fuentes modificadas, cero exposiciones.                                          |
| BLOCKED | Gate clínico integrado `e2e`                                                  | Sin OMOD/API conectado; no se sustituye por evidencia de mocks.                                                                     |

El smoke aislado de Edge añade cuatro casos y conserva el recorrido previo:
quince casos en total, con tres documentos preparados, tres egresos, cero
errores de página y cero peticiones externas. Comprueba la separación real
entre etiquetas del progreso y el primer título (0–24 px) en revisión, muestra,
selección, reemplazo, resultados, entrega y laboratorio. Comprueba triángulo,
descripción, foco inicial seguro, acciones de hasta 36 px de alto y sin salto
de línea, tanto en escritorio como en móvil. Las cuatro muestras de dos pares
usan tubos y conservan el rojo. Se inspeccionan las capturas de pares y las
tres advertencias, incluida la asignación móvil de 375 px.

Durante la comprobación se corrigió el reenvío de `aria-describedby` al diálogo
de Carbon mediante su ref pública local. Se descartaron aserciones de clases
CSS mockeadas como evidencia de geometría: el espacio se mide en navegador.
La primera ampliación del smoke móvil omitía el PFC solicitado y no podía
continuar; se completó la selección, sin relajar cantidades ni modificar reglas.
La inspección móvil detectó un botón en dos líneas y el tooltip de la X sobre
el título: se corrigieron padding local y foco inicial. La comprobación de foco
detectó que el formulario inferior lo capturaba al abrir la advertencia; se
permite el diálogo anidado únicamente mediante `selectorsFloatingMenus` de Carbon,
sin desactivar el foco contenido de la advertencia ni sus guardas de cierre.
La repetición completa pasó. No se atribuyen estos hallazgos a fallos preexistentes.

Se conserva el gate clínico integrado **BLOCKED** por ausencia de OMOD/API
conectada. El harness usa datos sintéticos, intercepta impresiones y cierra sus
contextos/servidor al terminar. No acredita impresión física, firma, autorización
clínica ni funcionamiento del backend. Rollout, riesgo y reversión se mantienen
como en el README, sin cambios de dependencias ni componentes globales.
