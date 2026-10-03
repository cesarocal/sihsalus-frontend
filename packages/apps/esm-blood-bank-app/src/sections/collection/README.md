# Extracción y Tamizaje - prototipo con mocks

## Alcance

Convierte las rutas existentes `collection` y `laboratory/screening` en pantallas navegables. Solo cambia `esm-blood-bank-app` en `bloodBank`. No añade standalone, OMOD, migraciones ni cambios de login, roles o navbar global.

Se reutilizan Carbon, PageHeader/Pictogram del framework y tokens/layout de `applicant-selection/selection.scss`. Listados, filtros, paginación, errores seguros y confirmación de salida son compartidos dentro del ESM.

## Flujo

1. Extracción lista solo Seleccionados. **Extraer sangre** abre cuatro etapas: Etiqueta, Cantidad extraída, Registro y Constancia.
2. Etiqueta captura componente, anticoagulante, conservación/agente opcionales, volumen aproximado, servicio/responsable, muestra/recipiente y leucocitos reducidos. Autóloga habilita receptor, documento, servicio e historia.
3. Completar Etiqueta genera una muestra visible en Tamizaje, sin duplicarla. Puede imprimir vistas de unidad/tubo con marca DEMO, no etiquetas institucionales ni barcodes. Las impresiones son vistas previas; no se auditan contadores.
4. Volumen exige número positivo decimal (hasta dos decimales, límite técnico DECIMAL(8,2), no recomendación clínica). Continuar ingresa la unidad mock en cuarentena y la muestra en Inventario. Reacción adversa queda deshabilitada y pendiente.
5. Registro guarda fecha, lote de bolsa, complicaciones, completa/incompleta, responsable y notas. La donación efectiva actualiza Donantes.
6. Constancia deriva identidad/edad/grupo/Rh/Hb/Hct, permite decidir correo y fecha de resultados (diez días calendario por defecto). No envía correos. Guardar finaliza y retira la postulación del listado activo; la conserva para antecedentes/autocompletado.
7. Tamizaje lista muestras, permite buscar y filtrar por estado/resultado. Recepción exige responsable, fecha/hora y confirmación de concordancia de nombre/documento/código entre tubo y registro.
8. Captura siete pruebas: HBsAg, Anti-HBc, Anti-HCV, Anti-VIH 1/2, Anti-HTLV I/II, Chagas y Sífilis. Cada una requiere resultado y reactivo/marca/lote. Fecha y profesional comunes se aplican a todas las pruebas de esta captura.
9. Revisión exige validador y todas las pruebas completas. Resultado global: Reactivo si alguna es reactiva, luego Indeterminado si corresponde, sino No reactivo. Validar bloquea edición; permite imprimir el resumen.

La X utiliza la confirmación compartida `../../shared/exit-confirmation.component.tsx`, con **Seguir editando / Salir** y la casilla **Guardar el avance antes de salir** marcada por defecto, también en Tamizaje. Guardar conserva incluso una etapa incompleta, respetando el límite heredado del lote; desmarcar descarta solo cambios no guardados, nunca el registro previo. Un formulario guardado sin nueva edición se cierra sin otra escritura ni aviso de éxito. Un fallo devuelve al formulario sin perder su edición. Durante el envío se bloquea la salida y el guardado duplicado. Etiqueta/volumen/registro cerrados son de consulta; un documento finalizado se cierra sin esta confirmación. Revisiones antiguas no sobrescriben registros actualizados.

El [contrato de texto y guardado](../../../TEXT_AND_SAVE_CONTRACT.md) documenta el contador de lote, el conteo UTF-16, la compatibilidad histórica, los mensajes específicos y los límites backend aún pendientes. No se imponen máximos genéricos a las observaciones ni al lote de reactivo.

**La unidad permanece en cuarentena con cualquier resultado. Reactivo no confirma diagnóstico.** Liberación/descarte, confirmaciones/repeticiones, sello de calidad, seguimiento, rechazo/reemplazo de muestras y reacción adversa están pendientes. El riesgo biológico autólogo no se infiere automáticamente de un tamizaje único.

El panel proviene de los documentos entregados; necesita validación del protocolo vigente antes de uso clínico. Las impresiones son adaptaciones DEMO con firma física, no reproducciones oficiales ni PDF archivados en OpenMRS.

## Organización y API futura

- `collection-page.component.tsx`: cola/registro y filtros.
- `collection-workflow.component.tsx`: etapas y guardados.
- `collection-documents.component.tsx`: identidad, etiquetas y constancia.
- `collection.types.ts`, `collection-rules.ts`: DTO y validaciones.
- `../laboratory/screening/*`: listado, formulario, informe, tipos y reglas.
- `../../shared/processing-{page,modal}.component.tsx`, `print-document.ts`: UI e impresión aislada.
- `../../api/blood-bank-processing.api.ts`: `CollectionApi` y `ScreeningApi`; rutas propuestas `/ws/rest/v1/bloodbank/collections` y `/ws/rest/v1/bloodbank/screenings`.
- `../../api/mock-{blood-bank-processing.api,processing-store}.ts`: persistencia y fixtures.

`useMockData=false` muestra error seguro: los adaptadores reales están deshabilitados. Hay que acordar payloads, conceptos/UUIDs configurables, encuentros/órdenes, provider/ubicación y autorización por operación antes de implementar el OMOD.

| Datos                   | Mapeo previsto                                                                 |
| ----------------------- | ------------------------------------------------------------------------------ |
| Donación y responsable  | `banco_extraccion`, `banco_donante`, `provider`                                |
| Unidad/estado           | `banco_unidad` + historial en la misma transacción                             |
| Etiquetas/constancia    | `banco_unidad_etiqueta`, `banco_muestra_etiqueta`, `banco_constancia_donacion` |
| Muestra                 | `banco_muestra`, un solo origen: unidad; postulación como contexto derivado    |
| Tamizaje                | `banco_muestra_orden_tamizaje` + `test_order`                                  |
| Resultados/trazabilidad | `obs` + `banco_tamizaje_prueba`; fechas/validador/dictamen                     |

El OMOD debe verificar pertenencia paciente/muestra/unidad/orden, numeración atómica, idempotencia, concurrencia, auditoría y permisos. Los controles frontend no sustituyen esas garantías.
No se reescribe la postulación original: su salida del listado deriva de la extracción completada en el mismo almacén mock. Los códigos `BB-*`, `M-*` y `DON-*` no son identificadores institucionales.

## Datos sintéticos y limpieza

Hay un seleccionado inicial (DNI `90000012`) y una muestra inicial `M-DEMO-001`. Solo datos ficticios, por pestaña, conservados al recargar pero no compartidos ni clínicamente persistidos.

`sihsalus.blood-bank.processing.mock.v1` guarda extracciones, muestras y datos de constancia. Etapa/unidad/muestra usan una única escritura; un fallo no finge éxito. No hay firma digital, envío de correo ni documento PDF archivado. No se modifican cookies ni tokens.

Para reiniciar la demostración, limpie exclusivamente ambas claves desde DevTools:

```js
sessionStorage.removeItem("sihsalus.blood-bank.selection.mock.v1");
sessionStorage.removeItem("sihsalus.blood-bank.processing.mock.v1");
location.reload();
```

## Evidencia local - 2026-10-03

Cambios sin commit en `bloodBank`, base `59e8102087c7614f773eeb9c8c6239fc944fbff5`. No es evidencia de despliegue ni validación clínica integrada.

| Estado  | Comando/caso                                                                   | Resultado                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PASSED  | Scripts del workspace: lint, typescript, test, build                           | Exit 0; 95 pruebas / 10 archivos; dos advertencias de tamaño en build (main ~402 KiB, vendor ~255 KiB)                                                                                   |
| PASSED  | validate:workspaces, validate:critical-route-privileges, validate:react-router | Exit 0; guards existentes y 15 apps críticas fail closed                                                                                                                                 |
| PASSED  | validate:error-exposure --base HEAD                                            | Exit 0; sin exposición en alcance cambiado                                                                                                                                               |
| PASSED  | Smoke Playwright local con Edge headless, escritorio 1440x1000/tablet 768x1024 | X/cancelar, guardar/recargar, volumen inválido, etiqueta de tubo, constancia, muestra derivada, recepción, siete resultados, validación reactiva y cuarentena; cero errores de navegador |
| NOT RUN | E2E clínico con sesión, OMOD/content y backend OpenMRS                         | Contrato aún no implementado; solo datos sintéticos aislados                                                                                                                             |

La fixture temporal estuvo fuera del repo, con componentes reales y stubs de configuración/traducción, sin login ni peticiones OpenMRS. Se inspeccionaron PNGs de listado, etiqueta, revisión, tablet y constancia; se verificó documento/invocación de impresión, no una impresora física. Se limpió el almacenamiento de prueba.
Los avisos Sass de la fixture señalan archivos Carbon; no se verificó su carácter preexistente en origin/main. No cambiaron dependencias.

Rollback: volver a la versión anterior del ESM; no hay esquema ni datos OpenMRS que revertir.
