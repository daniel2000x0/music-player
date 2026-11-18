# 06 · Hoja de ruta de desarrollo

**Proyecto:** `mi-music-player`
**Tipo de documento:** plan de ejecución por fases
**Fecha:** 14 de noviembre de 2026
**Naturaleza:** propuesta. **Ninguna fase ha sido ejecutada.** No se modificó código, dependencias ni configuración durante la auditoría.

---

## 1. Cómo leer esta hoja de ruta

Cada fase declara: objetivo, problemas que ataca, archivos a tocar, funcionalidades a implementar, dependencias, Skills, MCP, riesgos de compatibilidad, pruebas y criterios de salida. Un criterio de salida es **binario y verificable**: o se cumple, o la fase no termina.

**Regla de oro:** ninguna fase empieza si la anterior no tiene sus criterios de salida cumplidos y **verificados con comando**, no con impresión subjetiva.

**Línea base de partida (verificada):** `npx tsc --noEmit` limpio · `npx jest` 14 suites / 111 pruebas ✅ · `npx expo-doctor` 20/20 · rama `master` en `91d53d6` con cambios sin commitear.

**Esfuerzo:** estimación en jornadas de una persona con contexto completo. No incluye tiempo de revisión en dispositivo, que se suma aparte.

| Fase | Nombre | Esfuerzo | Bloquea a |
| --- | --- | --- | --- |
| 1 | Correcciones críticas y compatibilidad | 2–3 d | todas |
| 2 | Arquitectura y separación del motor | 3–4 d | 3, 4, 7 |
| 3 | Biblioteca, SQLite y escaneo sin tope | 4–5 d | 4, 6 |
| 4 | Motor de reproducción y sesión persistente | 4–5 d | 5, 7 |
| 5 | Notificaciones, pantalla de bloqueo y widget | 3–4 d | 6 |
| 5.1 | Carátulas ausentes: formatos y respaldos | 1–2 d | 6, 7 |
| 6 | UI/UX, animaciones y accesibilidad | 4–6 d | 7 |
| 7 | Pruebas y optimización | 4–5 d | 8 |
| 8 | APK y producción | 2–3 d | — |

Total orientativo: **26–35 jornadas**. No es un mes de trabajo: es un ciclo de endurecimiento sobre una app que **ya funciona**.

---

## FASE 1 · Correcciones críticas y compatibilidad

**Esfuerzo:** 2–3 días
**Objetivo:** eliminar los dos riesgos que rompen la promesa del producto (`C-01`, `C-02`) y dejar un punto de retorno estable en Git antes de refactorizar (`A-09`). Esta fase **no refactoriza**: corrige y asegura.

### Problemas que ataca

| ID | Problema |
| --- | --- |
| `C-01` | La reproducción en segundo plano puede desactivarse para siempre tras un solo fallo de lock screen |
| `C-02` | La biblioteca se trunca en 5000 pistas sin avisar |
| `A-09` | Cambios críticos sin commitear: no hay rollback |
| `A-04` (parcial) | Los dos fallos anteriores son invisibles para el usuario |
| `B-01` | `README` afirma un campo `engines` que no existe |

### Archivos a modificar

| Archivo | Cambio |
| --- | --- |
| `src/services/audio-engine.ts` | `withLockScreenGuard`: backoff acotado (1 s, 3 s, 10 s) en vez de desactivación permanente; estado `degraded` en vez de booleano; exponer salud vía callback |
| `src/services/media.service.ts` | Eliminar `.limit(MAX_SONGS)`; paginar por cursor; devolver `{ songs, truncated: false }` o `ScanReport` mínimo |
| `src/stores/library.store.ts` | Propagar `error` y el resultado del escaneo a un campo observable por la UI |
| `src/components/audio-bridge-inner.tsx` | Consumir el nuevo estado de salud y publicarlo en el store |
| `README.md` | Corregir `B-01`; documentar limitaciones reales del widget y del lock screen |
| `.gitignore` | Verificar que `.agents/`, `agent/`, `opencode.json` quedan fuera o se commitean deliberadamente |

### Funcionalidades a implementar

1. **Reintento acotado de lock screen** con estado explícito (`unknown` / `active` / `degraded` / `unsupported`).
2. **Aviso visible no intrusivo** cuando la reproducción queda en `degraded` (banner o fila en el reproductor; el canal completo llega en FASE 2).
3. **Escaneo completo** sin tope: paginación de 1000 en 1000 con `id` como cursor.
4. **Commit de seguridad** con mensaje que describa el estado actual, rama de trabajo `audit/fase-1`.

### Dependencias

- Ninguna nueva. **No instalar nada en esta fase.** Todo se resuelve con `expo-audio` y `expo-media-library` ya presentes.

### Skills a consultar

| Skill | Para qué |
| --- | --- |
| `opencode` | Flujo de trabajo, comandos y convenciones del entorno |
| `context7-mcp` | Verificar la firma vigente de `setActiveForLockScreen` y `AudioPlaylist` en SDK 58 antes de tocar el motor |

> **Limitación registrada:** los skills de Expo/ingeniería que están en disco (`.agents/skills`, `.claude/skills`, `skills-lock.json`) **no están registrados como herramientas invocables** en esta sesión. Solo `context7-mcp`, `find-skills`, `opencode` y `report` lo están. Si en la ejecución real aparecen registrados, deben consultarse antes de cada fase según lo previsto.

### MCP a usar

| MCP | Estado | Uso |
| --- | --- | --- |
| Context7 | ✅ disponible | Documentación de `expo-audio` y `expo-media-library` SDK 58 |
| Expo MCP | ❌ no expuesto | Se sustituye por `webfetch` a `docs.expo.dev/versions/v58.0.0/` |
| GitHub MCP | ❌ no expuesto | No verificable en esta sesión |

### Riesgos de compatibilidad

- **`setActiveForLockScreen` en Expo Go:** sigue sin poder validarse en runtime nativo. El código debe compilar y degradar limpiamente; la verificación real exige development build.
- **Paginación de `expo-media-library`:** el cursor por `id` (`after: lastId`) debe confirmarse en la documentación SDK 58; si la API no soporta cursor, se pagina por `offset` con `limit` y se acepta el coste.
- **Escaneo de bibliotecas grandes:** quitar el tope puede disparar el tiempo de arranque en dispositivos con >5000 pistas. La mitigación es progreso observable; el pipeline completo llega en FASE 3.

### Pruebas

- Unitarias nuevas: `media.service` con un mock que devuelve 12 000 ids → el resultado contiene 12 000.
- Unitarias nuevas: `withLockScreenGuard` con un mock que falla una vez y luego funciona → el estado final es `active`, no permanente desactivado.
- Unitarias nuevas: fallo siempre → estado `degraded` y callback invocado exactamente una vez.
- Manual: instalar en dispositivo con biblioteca grande y comprobar que aparecen todas las pistas.

### Criterios de salida

1. `grep -r "MAX_SONGS" src/` no devuelve resultados.
2. Existe una prueba que demuestra que 12 000 pistas se leen completas.
3. Existe una prueba que demuestra que un fallo transitorio de lock screen **no** desactiva la función de forma permanente.
4. El estado `degraded` es observable desde el store y visible en la UI del reproductor.
5. `npx tsc --noEmit`, `npx jest` y `npx expo-doctor` siguen verdes.
6. Todo el trabajo está commiteado en una rama, con el estado previo recuperable por `git`.

---

## FASE 2 · Arquitectura y separación del motor

**Esfuerzo:** 3–4 días
**Objetivo:** convertir `audio-engine.ts` en una fachada y repartir sus cinco responsabilidades en módulos con una sola cada uno. Añadir capacidades del entorno y el canal de avisos.

### Problemas que ataca

| ID | Problema |
| --- | --- |
| `C-01` (causa raíz) | Concentración de responsabilidades que hace estructural el bug |
| `A-04` | Fallos invisibles: no existe modelo de estado para la degradación |
| `A-05` | Dependencias y plugins declarados sin uso |
| `A-06` | Permisos Android por encima de lo necesario |
| `UI-02` | Estados vacíos que no explican la causa |

### Archivos a modificar / crear

| Archivo | Acción |
| --- | --- |
| `src/services/audio/native-playlist.ts` | **Nuevo.** Ciclo de vida de `AudioPlaylist`, orden real, suscripciones |
| `src/services/audio/audio-mode.ts` | **Nuevo.** `setAudioModeAsync`, permisos de notificación, reintento |
| `src/services/audio/lock-screen.ts` | **Nuevo.** Registro, metadatos, salud y backoff |
| `src/services/audio/session.ts` | **Nuevo.** Máquina de estados de sesión |
| `src/services/audio/index.ts` | **Nuevo.** Fachada con la API pública actual + `getCapabilities()` |
| `src/services/audio-engine.ts` | Reducir a barril de re-exportación; eliminar en FASE 4 |
| `src/services/capabilities.ts` | **Nuevo.** Detección de capacidades del entorno |
| `src/stores/notice.store.ts` | **Nuevo.** Avisos tipados |
| `src/components/notice-banner.tsx` | **Nuevo.** Banner único en el layout raíz |
| `src/app/_layout.tsx` | Montar `NoticeBanner` |
| `src/app/(tabs)/songs.tsx`, `audiobooks.tsx`, `playlists.tsx` | Distinguir «vacío» de «error» |
| `src/stores/library.store.ts` | Consumir `notice.store` en fallos de escaneo/permiso |
| `package.json`, `app.json` | Retirar dependencias y permisos sin uso (`A-05`, `A-06`) |

### Funcionalidades a implementar

1. **Fachada estable:** `player.store` y `audio-bridge-inner` no cambian sus imports; el barril mantiene la API.
2. **Máquina de estados de sesión** (`idle` → `preparing` → `ready`/`playing`/`paused`/`failed`/`recovering`).
3. **`capabilities.ts`** con las 7 capacidades de `05-architecture-proposal.md` §6.
4. **Canal de avisos** con deduplicación por `code` y severidad.
5. **Estados vacíos honestos** en biblioteca, audiolibros y playlists.
6. **Poda de dependencias** tras verificar con `grep` que siguen sin uso **y** que no son peers obligatorios de `expo-router@58`: `expo-symbols`, `expo-glass-effect`, `expo-device`, `expo-system-ui`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`. Las tres últimas se retiran solo si `peerDependenciesMeta` de `expo-router` las marca como opcionales. **`expo-font` se conserva**: `expo-doctor` falla con «Missing peer dependency: expo-font Required by: @expo/vector-icons» si se retira. El plugin `expo-font` que añade `expo install` sí se retira de `app.json`.
7. **Poda de permisos:** `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_VISUAL_USER_SELECTED`, `MODIFY_AUDIO_SETTINGS`. Se quitan de `android.permissions` **y** se añaden a `android.blockedPermissions`, porque los plugins `expo-media-library` y `expo-audio` los re-añaden al manifest.

### Dependencias

- **Ninguna nueva.**
- **Retiradas:** 7 dependencias (`expo-symbols`, `expo-glass-effect`, `expo-device`, `expo-system-ui`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`) y 2 plugins sin uso, **solo tras** confirmar con `grep` que no hay imports y ejecutar `npx expo-doctor` después. `expo-font` se conserva por ser peer obligatorio de `@expo/vector-icons` (ver `07-dependencies-and-tools.md`).

### Skills a consultar

`opencode` (convenciones y comandos), `context7-mcp` (firmas de `expo-audio` y `expo-constants` para `executionEnvironment`).

### MCP a usar

Context7 ✅ · Expo MCP ❌ (sustituido por `webfetch` a docs v58) · GitHub MCP ❌.

### Riesgos de compatibilidad

| Riesgo | Nivel | Mitigación |
| --- | --- | --- |
| La poda de dependencias rompe un peer de `expo-router` | MEDIO | Podar de una en una, `expo-doctor` tras cada paso |
| `react-native-reanimated`/`gesture-handler` parecen no usarse pero `expo-router` los carga | MEDIO | Conservar si son peers requeridos; solo retirar los opcionales confirmados |
| El barril oculta dependencias circulares | BAJO | Regla de ESLint `import/no-cycle` en `services/` |
| Cambiar imports rompe rutas tipadas | BAJO | `tsc` en cada paso |

### Pruebas

- `capabilities` con `Platform.OS` y `executionEnvironment` mockeados (4 combinaciones).
- `notice.store`: alta, deduplicación por `code`, descarte, acción.
- `session.ts`: transiciones válidas e inválidas (tabla de estados; toda transición no declarada lanza en desarrollo).
- Regresión: las 123 pruebas existentes deben seguir pasando **sin modificarlas** (resultado: **139/139**).

### Criterios de salida

1. `audio-engine.ts` ≤ 10 líneas, solo re-exportaciones.
2. Cada archivo de `services/audio/` ≤ 200 líneas y con una responsabilidad declarada en cabecera.
3. `capabilities.ts` cubierto por pruebas y consumido al menos en 2 pantallas.
4. Un fallo simulado de escaneo produce un aviso visible, no solo una fila en `error_logs`.
5. `package.json` no contiene las dependencias retiradas y `expo-doctor` sigue en 20/20.
6. Los 3 permisos retirados no aparecen en el manifest final (`android.blockedPermissions` + `expo config --type introspect`).
7. Verdes: `tsc`, `jest`, `expo-doctor`, `expo lint`.

### Estado al cierre de FASE 2

| Criterio | Resultado |
| --- | --- |
| `audio-engine.ts` | 8 líneas (`export *`) |
| Módulos `services/audio/` | `index` 40, `audio-mode` 70, `events` 72, `session` 98, `playlist-edits` 100, `native-playlist` 166, `queue` 174, `lock-screen` 200 |
| `capabilities` | 7 capacidades; consumido en `player.tsx` y `settings.tsx` |
| Aviso por fallo de escaneo | `library.scan-failed` con acción «Reintentar» |
| Dependencias | 7 retiradas; `expo-font` conservada como peer |
| Permisos | 3 bloqueados con `android.blockedPermissions` (manifest con 5 + `READ_EXTERNAL_STORAGE` limitado a `maxSdkVersion=32`) |
| Verdes | `tsc` limpio · `jest` 139/139 · `expo-doctor` 20/20 · `expo lint` 0 problemas · bundle Android exportado |

### Verificación en dispositivo (FASE 2)

Dispositivo: Infinix X6826 (`09729372AM004325`), Android 12 (SDK 31), APK release 1.0.0 canal `preview`.
OTA aplicada: grupo `f609e8b8-df66-4460-9778-e031ac65005f`, update Android `01a1dd7c-03c2-7cea-aa2d-26225d1946fe`, commit `c5b9782`.

| Comprobación | Resultado |
| --- | --- |
| Arranque del bundle nuevo | ✅ `Ajustes → Diagnóstico → Capacidades del dispositivo` muestra las 7 capacidades |
| Biblioteca | ✅ 1792 canciones / 671 artistas tras escaneo completo; sin errores JS ni crashes |
| Reproducción | ✅ cola completa desde «Reproducir»; notificación `expo_audio_channel` con Anterior/Pausa/Siguiente y metadatos correctos |
| Segundo plano | ✅ 40 s con la app en background y la posición avanzando (`state=3`) |
| Controles de notificación | ✅ pausa, play y siguiente funcionan (`active item id` y metadatos cambian) |
| Estado sin permiso | ✅ «Sin acceso a tu música» + «Conceder permiso» (no confunde vacío con error) |
| Reanudación tras permiso | ✅ vuelve a escanear y muestra la biblioteca |

**Observaciones abiertas (no bloquean FASE 2):**

1. `KEYCODE_MEDIA_PLAY_PAUSE` pausa pero no reanuda; `KEYCODE_MEDIA_PLAY`, los botones de la notificación y el botón de la app sí. Es comportamiento del handler nativo de `expo-audio`, no de la fachada; se anota para FASE 4.
2. El aviso `Cargando tu biblioteca…` cubre también el escaneo completo (≈30 s con 1792 pistas); en FASE 3/6 conviene separar «cargando copia local» de «escaneando».
3. Android 12 no expone `POST_NOTIFICATIONS` ni `READ_MEDIA_AUDIO` como permisos en tiempo de ejecución: su comportamiento (incluido el canal de avisos de FASE 2) queda pendiente de validar en un dispositivo Android 13+.

---

## FASE 3 · Biblioteca, SQLite y escaneo sin tope

**Esfuerzo:** 4–5 días
**Objetivo:** hacer del escaneo un pipeline por fases, incremental y observable, con persistencia por lotes y poda lógica en lugar de borrado. Corregir la agrupación de audiolibros con URIs `content://`.

### Problemas que ataca

| ID | Problema |
| --- | --- |
| `C-02` (profundidad) | Truncado silencioso y contrato mentiroso de `loadDeviceAudio` |
| `M-04` | Cualquier cambio de ids dispara relectura completa de etiquetas |
| `A-07` | `folderFromUri` solo acepta `file://`; audiolibros se agrupan mal |
| `UI-06` | Arranque en frío sin progreso granular |
| `M-06` | Widget con datos obsoletos tras muerte del proceso (parte de reconciliación) |

### Archivos a modificar / crear

| Archivo | Acción |
| --- | --- |
| `src/domain/library/scan-diff.ts` | **Nuevo.** Diff puro nuevos/modificados/sin cambios/ausentes |
| `src/domain/library/scan-progress.ts` | **Nuevo.** `ScanPhase`, `ScanProgress` y su formato |
| `src/domain/library/scan-report.ts` | **Nuevo.** `ScanReport` y `describeScanReport` (dominio puro) |
| `src/services/library-scan.service.ts` | **Nuevo.** Pipeline por fases `enumerate → diff → hydrate → persist → prune → done` |
| `src/services/media.service.ts` | Enumeración paginada y lectura de un asset; `folderFromUri` para `content://` |
| `src/services/media.service.web.ts` | API sincronizada con la variante nativa |
| `src/data/repositories/song.repository.ts` | `getScanState`, `upsertBatch` transaccional, `markMissing`; chunks de 500 ids |
| `src/data/db/migrations.ts` | Migración v5: columna `modification_time` + índices de fecha y disponibilidad |
| `src/stores/library.store.ts` | `scanOnce` deduplicado, `scanProgress`, `lastScanReport`; sin `libraryMatchesDevice` |
| `src/services/media-widget.service.ts` | `reconcileMediaWidget()` revalida el snapshot contra el store |
| `src/components/audio-bridge-inner.tsx` | Suscripción a `hydrated`/`lastScanReport` para reconciliar el widget |
| `src/components/refresh-button.tsx` | Mostrar porcentaje real, no spinner indeterminado |
| `src/app/(tabs)/songs.tsx` | Banner de escaneo con fase y conteo |
| `src/app/(tabs)/settings.tsx` | Progreso en curso y resumen del último escaneo |

### Funcionalidades a implementar

1. **Pipeline:** `enumerate → diff → hydrate → persist → prune → done`, con `ScanProgress` emitido en cada lote.
2. **Incremental por `modificationTime`** cuando el proveedor lo expone; si no, relectura completa y capacidad declarada.
3. **`upsertBatch`** en una sola transacción por lote de 200.
4. **`markMissing`** en vez de `DELETE`, con índice para no penalizar consultas.
5. **Agrupación de audiolibros robusta** para `content://`, con `capabilities.library.albumFolderGrouping`.
6. **Progreso visible** en biblioteca y en el botón de refresco.
7. **Reconciliación del widget** al volver del proceso muerto: el snapshot se revalida contra el store.

### Dependencias

- **Ninguna nueva.** `expo-sqlite` y `expo-media-library` cubren todo.
- **Descartado explícitamente:** `expo-background-task`/`expo-task-manager` para escaneo en segundo plano. Añade complejidad nativa y no está en el SRS; reevaluar en FASE 8 si hay demanda real.

### Skills a consultar

`opencode`, `context7-mcp` (API `Query`/`Asset` de `expo-media-library` SDK 58, `withTransactionAsync` de `expo-sqlite`).

### MCP a usar

Context7 ✅ (consultas separadas por concepto: paginación de media library / transacciones SQLite) · Expo MCP ❌ · GitHub MCP ❌.

### Riesgos de compatibilidad

| Riesgo | Nivel | Mitigación |
| --- | --- | --- |
| `expo-media-library` no soporta cursor por id en SDK 58 | MEDIO | **Confirmado:** no hay cursor; se pagina con `limit`/`offset` y se detecta la página repetida para cortar y advertir |
| `markMissing` rompe consultas que asumen `songs` completa | MEDIO | **Desviación:** `is_available` sigue siendo la columna canónica; no hay `is_missing` ni cambios en las consultas existentes |
| Migración sobre datos existentes falla en dispositivos reales | ALTO | Migración aditiva (`ALTER TABLE … ADD COLUMN`), prueba con base sembrada, backup previo en `legacy-migration.service` |
| Escaneo largo bloquea la UI | MEDIO | Lotes con `await` entre fases y progreso; nunca un bucle síncrono sobre 10 000 filas |
| `modificationTime` viene en `0` en algunos proveedores | MEDIO | Detección y caída a escaneo completo con aviso |

### Pruebas

- `scan-diff`: nuevos, modificados, ausentes, sin cambios, ids duplicados, listas vacías.
- `song.repository`: `upsertBatch` con 1000 filas, `findByIds` con >900 ids (lotes), `markMissing`.
- Migración: base con versión N → versión N+1 conserva filas y añade columna.
- Integración de escaneo con media library mockeada: 12 000 pistas, 3 fases, progreso monótono.
- Regresión: audiolibros con `content://` y sin álbum → un libro por carpeta, no uno solo.

### Criterios de salida

1. Escanear 12 000 pistas produce 12 000 filas y `ScanReport.truncated === false`.
2. Un segundo escaneo sin cambios **no** relee etiquetas (verificable por contador de llamadas al lector).
3. La UI muestra fase y conteo durante el escaneo.
4. Una canción borrada del dispositivo desaparece de la lista y conserva su favorito si vuelve.
5. Audiolibros sin álbum con `content://` se agrupan por carpeta cuando el proveedor la expone, y por álbum cuando no.
6. `tsc`, `jest`, `expo-doctor` verdes; migración probada con base sembrada.

### Desviaciones respecto al plan

| Plan | Ejecutado | Motivo |
| --- | --- | --- |
| Columna `is_missing` | Se conserva `is_available` (ya existente) | Evita una segunda fuente de verdad y no obliga a tocar las consultas; la poda lógica es la misma |
| `findByIds` renombrado | `getByIds` con chunks de 500 ids | No se rompe la API que consumen `player.store` y `audio-bridge-inner` |
| Paginación por cursor | `limit`/`offset` con detección de página repetida | SDK 58 no expone cursor; el proveedor que ignora `offset` se detecta y se corta con advertencia |
| `ScanReport.truncated` | `ScanReport` con `mode` (`incremental`/`full`) y `skipped` | No hay truncado posible sin tope; `mode` declara si el proveedor permitió el incremental |
| Pipeline dentro de `media.service.ts` | `media.service.ts` (permisos + enumeración + lectura) y `library-scan.service.ts` (fases) | Cada archivo con una responsabilidad declarada, sin crecer el servicio de medios |
| `capabilities.library.albumFolderGrouping` en FASE 3 | Ya declarada en FASE 2 | La capacidad existía desde la separación del motor |

### Estado al cierre de FASE 3

| Criterio | Resultado |
| --- | --- |
| Enumeración sin tope | `AUDIO_PAGE_SIZE` 1000, `MAX_PAGES` 1000; prueba con 12 000 pistas → 12 000 filas y 13 páginas |
| Segundo escaneo sin cambios | `readDeviceTrack` no se llama; `upsertBatch`/`markMissing`/`reclassifyAudiobooks` tampoco |
| Progreso en UI | Banner en `songs.tsx` (fase + conteo), porcentaje en `refresh-button.tsx`, resumen en `settings.tsx` |
| Poda lógica | `markMissing` por chunks de 500; sin `DELETE` ni reset global de `is_available` |
| Agrupación de audiolibros | `folderFromUri` resuelve documentos SAF (`content://…/document/…`) y `file://`; ignora `content://media/…` y `ph://` |
| Migración | v5 aditiva (`ALTER TABLE songs ADD COLUMN modification_time INTEGER` + índices); idempotente |
| Widget | `reconcileMediaWidget()` revalida pista y cola al hidratar o al terminar un escaneo |
| Tamaño de archivos | `library-scan.service` 121, `scan-diff` 94, `scan-report` 54, `scan-progress` 55, `media.service` 202 |
| Verdes | `tsc` limpio · `jest` **25 suites / 187 pruebas** · `expo-doctor` 20/20 · `expo lint` 0 problemas |

### Verificación en dispositivo (FASE 3)

Dispositivo: Infinix X6826 (`09729372AM004325`), Android 12 (SDK 31), APK release 1.0.0 canal `preview`.
OTA aplicada: grupo `ace5fe3e-ad0d-442f-8eb5-503f7275fc47`, update Android `01a1e247-2ffb-7881-ab7d-75f19492ec7d`, commit `846d2ba`.

| Comprobación | Resultado |
| --- | --- |
| OTA aplicada | ✅ `expo-updates` reporta la rama `preview` al día (`CheckCompleteUnavailable`, `isUpdateAvailable=false`) tras descargar y reiniciar |
| Migración v5 sin pérdida de datos | ✅ 1792 canciones / 671 artistas / 995 álbumes y 8 favoritos tras la migración aditiva |
| Escaneo incremental | ✅ `Configuración → Último escaneo: sin cambios · 1 s` en el segundo escaneo (el primero, tras la migración, relee todas las filas una vez) |
| Re-escaneo manual | ✅ «Volver a escanear» corre el pipeline y refresca el resumen sin errores |
| Sin errores en runtime | ✅ sin `ReactNativeJS` con errores ni `FATAL`/`AndroidRuntime` de la app |
| Widget | ✅ proveedor `MediaWidgetProvider` enlazado en el launcher (`dumpsys appwidget`, id 58); sin errores de widget |

**Observaciones (no bloquean FASE 3):**

1. El banner de progreso por fases (`songs.tsx`) no se pudo capturar con `uiautomator dump`: el escaneo incremental sin cambios termina en ~1 s, más rápido de lo que tarda un dump. La evidencia del pipeline es el resumen de Configuración y las pruebas unitarias.
2. La reconciliación del widget (`reconcileMediaWidget`) no se pudo confirmar visualmente: el texto del `RemoteViews` no se expone a `uiautomator` y el launcher quedó fuera de foco. Queda como comprobación manual pendiente (colocar el widget, reproducir, matar el proceso y volver).

---

## FASE 4 · Motor de reproducción y sesión persistente

**Esfuerzo:** 4–5 días
**Objetivo:** persistir la sesión de reproducción y restaurarla sin auto-play; completar la máquina de estados; añadir control de volumen. Eliminar definitivamente `audio-engine.ts`.

### Problemas que ataca

| ID | Problema |
| --- | --- |
| `A-01` | Sin persistencia de sesión: se pierde cola, pista, posición y modos |
| `M-02` | No hay control de volumen en la app |
| `M-10` | Sin control de nivel/ecualizador (solo se documenta el alcance) |
| `C-01` | Cierre del ciclo: la sesión degradada se restaura y se informa |

### Archivos a modificar / crear

| Archivo | Acción |
| --- | --- |
| `src/domain/playback/session.ts` | **Nuevo.** Forma serializable, validación, filtrado de ids ausentes |
| `src/data/repositories/playback-session.repository.ts` | **Nuevo.** Una fila, `save`/`load`/`clear` |
| `src/data/db/migrations.ts` | Tabla `playback_sessions` |
| `src/services/audio/session.ts` | Máquina de estados completa, persistencia con throttle |
| `src/stores/player.store.ts` | `hydrateSession()`, persistencia en cambios, `setVolume` |
| `src/app/_layout.tsx` | Disparar `hydrateSession` tras hidratar biblioteca |
| `src/app/player.tsx` | Control de volumen; estado `degraded` visible |
| `src/services/audio-engine.ts` | **Eliminar** (los imports ya apuntan a `services/audio/`) |

### Funcionalidades a implementar

1. **Persistencia de sesión** con la política de escritura de `05` §7.3 (inmediata en pista/modo/pausa, throttle 5 s en posición, debounce 1 s en cola).
2. **Restauración en pausa** con posición exacta y cola filtrada.
3. **Control de volumen** en el reproductor (0–1), respetando el volumen del sistema.
4. **Recuperación tras muerte del proceso** sin reabrir en vacío.
5. **Estado `degraded` persistente en la sesión de UI**, no en disco.

### Dependencias

- **Ninguna nueva.**

### Skills a consultar

`opencode`, `context7-mcp` (`AudioPlaylist.volume`, `seekTo`, eventos de estado en SDK 58).

### MCP a usar

Context7 ✅ · Expo MCP ❌ · GitHub MCP ❌.

### Riesgos de compatibilidad

| Riesgo | Nivel | Mitigación |
| --- | --- | --- |
| Restaurar en pausa deja el motor en estado inconsistente | MEDIO | Prueba de integración: restaurar → `play()` funciona |
| Escrituras frecuentes degradan el rendimiento | MEDIO | Throttle y escritura fuera del hilo de render; medir con benchmark existente |
| `volume` no aplica en Android con sesión de medios | BAJO | Verificar en docs; si no aplica, ocultar el control en vez de mostrar uno inerte |
| Ids restaurados ya no existen | BAJO | Filtrado contra `song.repository`; limpiar fila si queda vacía |

### Pruebas

- `domain/playback/session`: serialización, filtrado, validación de modos.
- `playback-session.repository`: guardar/cargar/limpiar; escritura concurrente.
- `player.store`: restaurar 500 canciones con 3 ausentes → 497 en cola, sin auto-play.
- Integración: matar proceso simulado (reset de módulo) → `hydrateSession` repone estado.
- Throttle: 100 cambios de posición en 10 s → ≤ 3 escrituras.

### Criterios de salida

1. Matar la app y reabrir restaura cola, pista, posición y modos, **en pausa**.
2. La posición restaurada difiere de la real en ≤ 5 s.
3. El control de volumen funciona o está ausente; nunca inerte.
4. `audio-engine.ts` ya no existe y `grep -r "audio-engine" src/` no devuelve nada.
5. Verdes: `tsc`, `jest`, `expo-doctor`.

### Desviaciones respecto al plan

| Plan | Implementado | Motivo |
| --- | --- | --- |
| Persistencia en `services/audio/session.ts` | `session-persistence.ts` como módulo aparte; `session.ts` queda como máquina de estados pura | Separar la política de escritura (throttle/debounce/flush) de las transiciones facilita probar cada una por separado |
| `setVolume` en `session.ts` | `volume` vive en `player.store` y se persiste en `app_settings` (debounce 500 ms) | El volumen es una preferencia del usuario, no parte de la sesión; no se serializa en `playback_sessions` |
| Pista/modo/pausa con escritura inmediata | Añadido `seek` a la lista de escrituras inmediatas | Un salto de posición debe sobrevivir a una muerte del proceso; con throttle se perdía |
| `degraded` "persistente en la sesión de UI" | Añadido a `SessionState` con `degradeSession`/`clearDegradation`; **no** se persiste en disco | Un estado degradado es transitorio de la ejecución; restaurarlo desde disco daría un falso positivo |
| `RepeatMode` en `services/audio/native-playlist.ts` | Movido a `src/domain/playback/session.ts`; `native-playlist.ts` lo re-exporta | La sesión serializable necesita el tipo sin depender de la capa de motor |

### Estado al cierre de FASE 4

| Criterio | Resultado |
| --- | --- |
| Persistencia de sesión | Tabla `playback_sessions` (migración **v6**, fila única `id = 1`); política §7.3 de `05`: posición throttle 5 s, cola debounce 1 s (reinicia temporizador), pista/modo/pausa/seek inmediatas |
| Restauración | `hydrateSession` deja `isPlaying: false` y sin playlist nativa; la primera acción carga el motor (`ensureEngineQueue`). **Nunca auto-play** |
| Volumen | `volume` en `player.store` (0–1) con `VolumeControl`; persistido en `app_settings` con debounce 500 ms |
| Estado `degraded` | `SessionState` + `degradeSession`/`clearDegradation`; visible en `player.tsx`; ignorado en `idle`; no se persiste |
| `audio-engine.ts` | **Eliminado**; `grep -r "audio-engine" src/` vacío (ámbitos de `logError` y prefijos renombrados a `audio/session`, `audio/queue`, `audio/playlist`, `audio/events`, `audio/lock-screen`, `audio/mode`, `audio/session-persistence`) |
| Pruebas | `playback-session`, `playback-session.repository`, `session-persistence`, `player-session` (500 con 3 ausentes → 497), `session` (degraded), `migrations` (v6 + tabla) |
| Verdes | `tsc` limpio · `jest` **29 suites / 216 pruebas** · `expo-doctor` 20/20 · `expo lint` 0 problemas |

### Verificación en dispositivo (FASE 4)

Dispositivo: Infinix X6826 (`09729372AM004325`), Android 12 (SDK 31), APK release 1.0.0 canal `preview`.
OTA aplicada: grupo `2ca33c8c-bb5f-4bce-82b0-adac3d9cfafb`, update Android `01a1e720-b566-7826-8bd6-59f424741e0c`, commit `ae6f5cf`.

| Comprobación | Resultado |
| --- | --- |
| OTA aplicada | ✅ primer arranque descarga el manifest `01a1e720-…`; segundo arranque `isUpdateAvailable=false` / `CheckCompleteUnavailable` |
| Sin errores en runtime | ✅ sin `ReactNativeJS` con errores ni `FATAL`/`AndroidRuntime` de la app |
| Criterios 1–3 (restaurar en pausa, posición ≤ 5 s, volumen) | ⏳ verificación manual del usuario en el móvil pendiente; cubiertos por pruebas unitarias |

### Corrección del ANR tras FASE 4 (desviación)

Tras aplicar la OTA de FASE 4 el dispositivo registró dos ANR
(`Input dispatching timed out ... Waited 8003ms for MotionEvent`). El hilo
`main` quedaba bloqueado ~8 s en `android.media.session.MediaSession.setQueue`
→ `ParcelableListBinder.send` → `BinderProxy.transactNative`; el hilo JS
(`mqt_v_js`) estaba inactivo, así que el bloqueo era **puramente nativo**.

**Causa raíz (confirmada con traces y `dumpsys media_session`):** al
crear/reconstruir la cola, `AudioControlsService.setActivePlayableInternal`
publicaba la lista **completa** de pistas (~65 KB, 1801 pistas) en la
`MediaSession` del sistema mediante una única transacción binder del hilo
principal.

**Arreglo (solo JS, apto para OTA):** el motor nativo ya no recibe el orden de
reproducción completo, sino una **ventana** acotada alrededor de la pista actual
(100 por detrás, 100 por delante); la cola completa sigue viviendo en el store.
La ventana se recentra al acercarse a sus bordes (margen de 20 pistas) y, con
repetición total, da la vuelta para no cortar la reproducción continua.

| Aspecto | Detalle |
| --- | --- |
| Dominio | `src/domain/playback/queue-window.ts` (`computeQueueWindow`, `needsWindowRecenter`; constantes `QUEUE_WINDOW_BACK`/`FORWARD`/`EDGE` = 100/100/20) |
| Motor | `native-playlist.ts` recorta la ventana, conserva `order` completo y traduce índices nativo↔global (`getCurrentIndex`, `getCurrentSong`, `skipToFullIndex`, `isInWindow`, `windowNeedsRecenterNow`) |
| Orquestación | `queue.ts`: `createPlaylistWithOrder`, `refreshWindow`, `maintainWindow`; `startQueue` salta dentro de la ventana o reconstruye |
| Ediciones | `playlist-edits.ts` muta el orden completo y recrea la ventana (evita traducir índices en cada edición) |
| Store | `player.store.ts` llama `maintainWindow()` en `syncTrack`, `next`, `previous` y `cycleRepeat` |
| Límite | `toggleShuffle` sigue reconstruyendo la cola completa (`rebuildQueue`), comportamiento ya presente en `2e04e02`; **no** es regresión de FASE 4 |

**Pruebas:** `src/domain/__tests__/queue-window.test.ts` (ventana y recentrado,
puros) y `src/services/__tests__/audio-queue-window.test.ts` (integración: el
motor recibe 201 pistas de una cola de 1801; recentrado; vuelta con repetición
total; **recentrar no pausa** con el motor en buffering).

### Segundo hallazgo: el recentrado pausaba la reproducción

Verificado en dispositivo con taps reales en «Siguiente»: al cruzar el borde de
la ventana (tramo de 90 avances) la cola pasó de 101 a 182 pistas (recentrado
correcto) pero el estado pasó de `state=3` (PLAYING) a `state=2` (PAUSED).

**Causa raíz:** `refreshWindow` decidía el estado con `playlist.playing`, que
`expo-audio` expone como `ExoPlayer.isPlaying` **en crudo**
(`AudioModule.kt`, `Property("playing")`). Durante el buffering de un cambio de
pista —o de un seek— `isPlaying` es `false`, mientras que el evento de estado ya
lo corrige con `intendedPlayingState` (`AudioPlaylist.kt`). La playlist recreada
arrancaba en pausa.

**Arreglo:** el estado se toma de la intención de la sesión
(`services/audio/session`, alimentada por el `playing` buffering-aware) mediante
`intendsPlayback()`; se aplica en `refreshWindow`, en `rebuildQueue` (por
defecto) y en `togglePlayback` (el botón de pausa también reanudaba en vez de
pausar durante el buffering).

| Verificación | Resultado |
| --- | --- |
| `tsc --noEmit` | limpio |
| `jest` | **31 suites / 236 pruebas** |
| `expo lint` | 0 problemas |
| `expo-doctor` | 20/20 |
| Dispositivo (adb) | recentrados 101→182→201 manteniendo `state=3`; sin ANR ni errores JS; pausa/reanudación `3→2→3` |

### Subidas (GitHub y OTA)

| Subida | Detalle |
| --- | --- |
| Commit ANR | `5472b46` — «ventana de cola para evitar el ANR al publicar miles de pistas (FASE 4)» |
| Commit recentrado | `8dda1f4` — «el recentrado de la ventana ya no pausa la reproducción» |
| Rama | `fix/4-anr-ventana-cola` empujada a `origin` |
| Fusión | `master` por **fast-forward** hasta `8dda1f4` (mismo commit que la OTA) |
| OTA `preview` | grupo `b06fff6b-c902-4505-8b5b-388ac17244e5`; Android `01a1e775-4ff9-7bd7-bb7d-96a07c413021`; runtime 1.0.0 |
| Estado OTA | descargada y aplicada en el Infinix X6826 (`CheckCompleteUnavailable`, `isUpdatePending=false`) |

### Corrección del widget de pantalla de inicio (tiempos)

El widget mostraba los dos tiempos **pegados al borde izquierdo** y sin
separador, de modo que `2:00` y `3:35` se leían como `2:003:35`. Medido en
dispositivo (análisis de píxeles del `uiautomator dump`): posición en
`x[83..121]` y duración en `x[121..159]`, ambas arrancando en el borde.

**Causa raíz:** el componente usaba `Row` con
`horizontalArrangement="spaceBetween"`, pero el conversor Glance de
`expo-widgets` (`ExpoWidgetEmittableTree.toPeekRow` /
`toPeekHorizontalAlignment`) **ignora `horizontalArrangement`**: solo traduce
`horizontalAlignment` y cualquier otro valor cae en `Alignment.Start`.

**Arreglo (solo JS, apto para OTA):** los tiempos van en una **sola `Text`** con
separador (`2:12 / 3:35`), centrada con `Row(fillMaxWidth,
horizontalAlignment="center")`, que sí está soportado. Además el formato del
widget admite horas (`h:mm:ss`) y muestra `--:--` **solo** cuando la duración
aún no se conoce (la posición `0` se muestra como `0:00`). Como la función del
widget se serializa a texto (runtime aislado), la lógica va duplicada dentro de
la función; una prueba extrae la copia inline del fuente y la compara con la
canónica `formatClock` (`src/utils/format.ts`) para que no diverjan.

| Aspecto | Detalle |
| --- | --- |
| Widget | `src/widgets/media-widget.tsx` (`formatClock`, `durationLabel`, `timeLabel`) |
| Formato canónico | `src/utils/format.ts` (`formatClock`; `formatDuration` reutiliza `formatClock`) |
| Pruebas | `src/utils/__tests__/format.test.ts` y `src/widgets/__tests__/media-widget.test.ts` (paridad de la copia inline + guardas de layout) |
| Verificación local | `tsc --noEmit` limpio · `jest` **33 suites / 247 pruebas** · `expo lint` 0 |
| Dispositivo (adb) | el widget muestra una sola etiqueta `2:12 / 3:35` en `bounds [313,651][407,679]`; centro x=360 = centro de la fila `[83,643][637,679]` → **centrada** |
| OTA `preview` | grupo `c4f5968d-ce8c-47da-8a1c-5291a232b4c7`; Android `01a1ecef-c19a-7366-bada-f2426570b1e1`; runtime 1.0.0 |
| Estado OTA | descargada y aplicada en el Infinix X6826 (`CheckCompleteUnavailable`, `isUpdateAvailable=false`) |

**Nota:** el layout del widget sí viaja por OTA. `WidgetsLayoutRegistry.layout()`
prefiere el layout guardado en runtime por `WidgetObject` (registrado al cargar
el JS de la app) sobre el recurso embebido `R.raw.expo_widgets_layout_registry`;
verificado en dispositivo tras el OTA.

### Cadencia del reloj del widget (desviación)

Tras corregir el formato, el reloj del widget avanzaba a saltos de 5 s
(`2:00 → 2:05 → 2:10`). **Causa:** `media-widget.service.ts` filtra los ticks de
progreso con `PROGRESS_SNAPSHOT_INTERVAL_SECONDS = 5`; el motor reporta cada
500 ms, pero solo se publicaba cada 5 s.

**Arreglo:** bajar el intervalo a **1 s**. El reloj avanza segundo a segundo y
Glance no se recompone dos veces por segundo (el reloj solo muestra segundos).

| Verificación | Resultado |
| --- | --- |
| Medición previa (dispositivo) | 1 cambio cada 5 s (`2:00 → 2:05 → 2:10…`) |
| Medición posterior (dispositivo) | **16 de 16 capturas distintas** a ~1,0 s (15,5 s) → 1 cambio/s |
| `tsc --noEmit` | limpio |
| `jest` | 33 suites / 247 pruebas |
| `expo lint` | 0 |
| Sin errores/ANR | sin `Input dispatching timed out` ni `FATAL EXCEPTION` de la app |
| OTA `preview` | grupo `8a8cd590-4f63-4938-ae59-fc6b364e5447`; Android `01a1ed05-1f5a-7d77-a069-982ced8934eb`; runtime 1.0.0; aplicada |

**Nota:** con el widget actualizándose cada segundo, `uiautomator dump` deja de
servir para medir (la ventana nunca queda «idle» y devuelve el árbol anterior,
así que la lectura se congela). La medición se hizo con `screencap` y
comparación de píxeles de la fila de tiempos.

---

## FASE 5 · Notificaciones, pantalla de bloqueo y widget

**Esfuerzo:** 3–4 días
**Objetivo:** cumplir `RF-002` de verdad en Android: controles del sistema fiables, metadatos correctos, widget coherente con el tema y honesto sobre lo que puede hacer.

### Problemas que ataca

| ID | Problema |
| --- | --- |
| `A-02` | El widget ignora el tema y usa `#7C5CFF`, ajeno al sistema de diseño |
| `A-03` | Anterior/siguiente inertes con app cerrada; sin `contentDescription` |
| `M-01` | Permiso de notificaciones pedido al montar, sin contexto |
| `M-06` | Widget con datos obsoletos tras muerte del proceso |
| `UI-01`, `UI-08` | Incoherencia de paleta y glifos de texto en el widget |
| `C-01` | Cierre en UI: `degraded` comunicado |

### Archivos a modificar / crear

| Archivo | Acción |
| --- | --- |
| `src/widgets/media-widget.contract.ts` | `theme`, `canGoPrevious`, `canGoNext`, `statusLabel` |
| `src/widgets/media-widget.tsx` | Props resueltas, sin colores literales, sin botones inoperantes, `contentDescription` |
| `src/services/media-widget.service.ts` | Resolver tema al publicar, publicar capacidades, reconciliar al arrancar |
| `src/services/audio/lock-screen.ts` | Metadatos completos y refresco en cada cambio de pista |
| `src/components/audio-bridge-inner.tsx` | Pedir permiso de notificaciones en la primera reproducción, no al montar |
| `src/app/player.tsx` | Aviso de `degraded` con explicación y acción |

### Funcionalidades a implementar

1. **Tema del widget por props** (`theme` resuelto desde `Colors`), actualizado al cambiar claro/oscuro.
2. **Botones honestos**: si `canGoPrevious`/`canGoNext` es `false`, no se pintan.
3. **Accesibilidad del widget**: `contentDescription` en todos los botones y `statusLabel` en el contenedor.
4. **Permiso de notificaciones contextual** en la primera reproducción, con explicación previa.
5. **Reconciliación del snapshot** al arrancar y en cada cambio de pista/estado.
6. **Iconos reales** en el widget si el subconjunto de componentes Android de `expo-widgets` lo permite; si no, se mantienen glifos pero con `contentDescription` (y se documenta).

### Dependencias

- **Ninguna nueva.** No se añade una librería de iconos para el widget: el runtime aislado solo admite el subconjunto documentado.
- **Descartado:** `expo-notifications` como sustituto. `expo-audio` ya gestiona la notificación de sesión de medios; duplicarla genera dos controles.

### Skills a consultar

`opencode`, `context7-mcp` (`expo-widgets` Android: componentes admitidos, `environment`, `addUserInteractionListener`).

### MCP a usar

Context7 ✅ · Expo MCP ❌ (docs de `expo-widgets` vía `webfetch`).

### Riesgos de compatibilidad

| Riesgo | Nivel | Mitigación |
| --- | --- | --- |
| El widget exige development build en Android | **ALTO (confirmado)** | Documentar que Expo Go no lo soporta; probar en build de desarrollo |
| `environment` solo expone `colorScheme` en Android | Confirmado | El tema se pasa por props; no se depende del entorno |
| Cambiar props del widget rompe snapshots existentes | MEDIO | Props nuevas con valores por defecto en `MEDIA_WIDGET_INITIAL_PROPS` |
| El permiso de notificaciones denegado deja la app sin controles | MEDIO | Aviso con acción «Abrir ajustes»; `capabilities` lo refleja |
| Los botones ocultos cambian el layout del widget | BAJO | Layout de 1 o 3 botones con el mismo ancho; prueba visual en dispositivo |

### Pruebas

- `media-widget.contract`: props completas, valores iniciales, resolución de tema claro/oscuro.
- `media-widget.service`: publicar snapshot con tema; reconciliar tras reinicio simulado; deduplicar.
- **No testeable en Jest:** render real del widget. Requiere dispositivo + build de desarrollo → se marca como verificación manual obligatoria.
- Manual: widget en tema claro y oscuro; app cerrada; botón central responde; anterior/siguiente no se muestran.

### Criterios de salida

1. El widget respeta tema claro y oscuro sin colores literales en `media-widget.tsx` (`grep "#"` en el archivo devuelve 0 resultados de paleta).
2. Ningún botón del widget es inerte: o funciona, o no se muestra.
3. Todos los controles del widget tienen `contentDescription`.
4. El permiso de notificaciones se pide en contexto y su denegación es visible y reversible.
5. Verificación manual en build de desarrollo documentada con captura.
6. Verdes: `tsc`, `jest`, `expo-doctor`.

### Desviaciones respecto al plan

| Plan | Implementado | Motivo |
| --- | --- | --- |
| `contentDescription` en **todos** los controles del widget | Portada (imagen) con `statusLabel`; los botones conservan glifos como texto visible | El conversor Glance de `expo-widgets` solo aplica `contentDescription` a imágenes (`ExpoWidgetEmittableTree.kt:253-257`); `toPeekButton` lo ignora (`:295-310`) y `toPeekModifier` no traduce `semantics` (`:402-425`). El modificador se descarta en silencio |
| **Iconos reales** en el widget | Glifos `◀◀`/`▶`/`▮▮`/`▶▶` en `Text` dentro de `Button` | El subconjunto Glance que traduce `expo-widgets` no incluye `IconView`; los `Image` no admiten `target`/`onClick`, así que no pueden sustituir a un botón |
| Metadatos y refresco en `src/services/audio/lock-screen.ts` | **Sin cambios**: ya quedaron completos en FASE 4 | La verificación en dispositivo confirma título/artista/álbum y las acciones «Previous Track»/«Play»/«Next Track» en cada cambio de pista; no había nada que arreglar |
| Permiso de notificaciones «al montar» (estado previo) | Se pide en la **primera reproducción**, con explicación y acción «Permitir» | `M-01`: pedirlo al arrancar no explica para qué sirve y el usuario deniega sin información |
| Tema del widget «actualizado al cambiar claro/oscuro» | El servicio **republica** el snapshot al cambiar el tema aunque la reproducción esté en pausa | `M-06`: sin esto, cambiar el tema con la app en pausa dejaba el widget con la paleta anterior |

### Estado al cierre de FASE 5

| Criterio | Resultado |
| --- | --- |
| Tema del widget | `theme` viaja en las props y se resuelve en `src/widgets/media-widget-theme.ts` (`resolveWidgetTheme(mode)`) desde `Colors`; `media-widget.tsx` tiene **0** literales `#` (y `media-widget-theme.ts` también) |
| Botones honestos | `canGoPrevious = canGoNext = queue.length > 1`; el toggle se oculta sin canción (`!hasSong`). Nada inerte (`A-03`) |
| Accesibilidad | `contentDescription={props.statusLabel}` en la portada (`Image`); `statusLabel` describe título, artista y estado (`«… , en pausa»`) |
| Permiso contextual | `promptNotificationPermission()` en la primera reproducción; si se deniega, el aviso pasa a `warning` con «Abrir ajustes» (`Linking.openSettings()`); una sola vez por sesión (`notificationPromptShown`) |
| Degradación en UI | `player.tsx` distingue el motivo (`lockScreenWarning`) y ofrece «Abrir ajustes» solo cuando falta el permiso de notificaciones (`canOpenNotificationSettings`) |
| Reconciliación | `reconcileMediaWidget()` al hidratar la biblioteca y al terminar un escaneo; `shouldPublish` detecta cambios de tema y de capacidades aunque esté en pausa |
| Pruebas | `media-widget.contract.test.ts` (paleta y valores iniciales), `notification-prompt.test.ts` (contexto, dedupe, denegación) e invariantes en `media-widget.test.ts` |
| Verdes | `tsc` limpio · `jest` **35 suites / 258 pruebas** · `expo lint` 0 problemas · `expo-doctor` ⚠️ deriva de versiones upstream (9 paquetes; pre-existente, ver nota) |

**Nota `expo-doctor`:** la comprobación de versiones falla por deriva del upstream (`expo` ~58.0.26 vs 58.0.25, `expo-widgets` ~58.0.29 vs 58.0.28, `expo-router`, `expo-sqlite`, `jest-expo`, `@expo/ui`, `expo-dev-client`, `expo-file-system`, `expo-web-browser`). Es **pre-existente** y no se toca: subir módulos nativos rompería la coincidencia con el APK instalado (los cambios de esta fase son solo JS y viajan por OTA). `package.json` y `package-lock.json` quedan sin cambios.

### Verificación en dispositivo (FASE 5)

Dispositivo: Infinix X6826 (`09729372AM004325`), Android 12 (SDK 31), APK release 1.0.0 canal `preview`, app `com.abelo.mimusicplayer`.
OTA aplicada: grupo `e015edf0-0371-41d5-b9f2-d8abfbf1d698`, update Android `01a1ed22-c670-7e71-8a51-559ea6f2cbf2`, runtime `1.0.0`, commit `04e83d7` (dos arranques; `CheckCompleteUnavailable` con `isUpdateAvailable=false`).

| Comprobación | Resultado |
| --- | --- |
| OTA aplicada | ✅ el widget usa el layout nuevo (tema por props) → el bundle principal es el de `04e83d7` |
| Tema oscuro | ✅ `dark-surface #17171C` (10 702 px) y `dark-accent #1ED760`; `light-*` en 0 |
| Tema claro (cambiado en Ajustes **en pausa**) | ✅ `light-surface #F0F0F3` (10 702 px) y `light-accent #12B76A`; `dark-*` en 0 → el tema se resuelve y **se republica sin reproducir** |
| Accesibilidad de portada | ✅ `content-desc='Before You Go — Lewis Capaldi, en pausa'` en el `ImageView` de portada `[83,511][187,615]` |
| Botones honestos (cola > 1) | ✅ tres `Button` en `y=[691,749]` |
| Botones honestos (cola = 1) | ✅ un único `Button [286,672][434,730]` (solo el toggle); sin anterior/siguiente |
| Formato con horas | ✅ `1:33 / 1:06:34` en una sola `TextView` `[299,632][420,660]` centrada |
| Permiso contextual (`M-01`) | ✅ en la primera reproducción aparece «Controles en la pantalla de bloqueo» con la explicación y la acción «Permitir» (`bounds [32,88][688,410]`); al pulsarla se concede y el aviso desaparece |
| Metadatos y controles del sistema | ✅ notificación `expo_audio_channel`, `category=transport`, `android.template=MediaStyle`, acciones «Previous Track»/«Play»/«Next Track», `android.title`/`android.text`(artista)/`android.subText`(álbum) correctos; `dumpsys media_session` con `metadata: size=6` |
| Sin errores en runtime | ✅ sin `ReactNativeJS` con errores, sin `FATAL`/`AndroidRuntime` de la app, sin ANR |

**Pendiente de reproducir en este dispositivo (limitación del entorno, no del código):**

- **Denegación del permiso (`M-01`):** en Android 12 no existe `POST_NOTIFICATIONS` (API 33+), así que `requestNotificationPermissionsAsync()` concede sin diálogo y no hay ruta de denegación real. La rama de denegación (aviso `warning` con «Abrir ajustes») queda cubierta por `notification-prompt.test.ts`.
- **Aviso de degradación (`C-01`):** solo se pinta cuando `sessionState` o `lockScreen.status` están degradados; en este dispositivo la sesión de medios funciona (`state=3`), así que no se pudo provocar sin simular un fallo.

**Nota de medición:** con reproducción activa el widget se actualiza cada segundo y la ventana **nunca queda «idle»**: `uiautomator dump` no escribe el archivo (o devuelve el árbol anterior), lo que produce **falsos negativos** al leer el widget o los banners. Para leer el árbol hay que **pausar** antes (botón del widget o `adb shell input keyevent 127`); para el reloj se mide con `screencap` y comparación de píxeles.

### Subidas (GitHub y OTA)

| Subida | Detalle |
| --- | --- |
| Commit | `04e83d7` — «feat(widget,audio): tema, botones honestos, accesibilidad y permiso contextual (FASE 5)» (11 archivos, +530/−79) |
| Rama | `fase/5-notificaciones-widget` empujada a `origin` |
| Fusión | `master` por **fast-forward** (mismo commit que la OTA) |
| OTA `preview` | grupo `e015edf0-0371-41d5-b9f2-d8abfbf1d698`; Android `01a1ed22-c670-7e71-8a51-559ea6f2cbf2`; runtime `1.0.0` |
| Estado OTA | descargada y aplicada en el Infinix X6826 (`CheckCompleteUnavailable`, `isUpdatePending=false`) |

---

## FASE 5.1 · Carátulas ausentes: formatos y respaldos

**Esfuerzo:** 1–2 días
**Objetivo:** que las canciones con portada real dejen de mostrar el marcador por defecto. Tres causas, tres arreglos: los **FLAC** no se leían en absoluto, muchas carpetas solo tienen una imagen suelta (`cover.jpg`) y las pistas ya guardadas sin portada nunca se vuelven a revisar.

No se modifica ningún archivo de audio: toda la lectura es de solo lectura.

### Problemas que ataca

| ID | Problema |
| --- | --- |
| `AR-01` | Los **FLAC** (y sus etiquetas) no se leían: ni arte embebido ni título/artista/álbum. Cada FLAC quedaba como «Archivo» en «Sin álbum» y fragmentaba el álbum |
| `AR-02` | Muchas carpetas no traen arte embebido, solo una imagen suelta (`cover.jpg`, `folder.png`…) que la app ignoraba |
| `AR-03` | Las pistas guardadas antes de saber leer FLAC o arte de carpeta quedaron con `artwork_uri = null` y el escaneo incremental no las vuelve a tocar (su `modification_time` no cambió) |
| `AR-04` | `MAX_ATTEMPTS_PER_ALBUM = 2` se rendía demasiado pronto en discos donde la primera pista no tiene portada; `sniffArtwork` solo reconocía JPEG/PNG |

### Solución implementada

| Área | Detalle |
| --- | --- |
| Parser FLAC | `src/domain/artwork/flac.ts`: `extractFlacArtwork` (bloque `PICTURE` tipo 6, prefiriendo frontal) y `extractFlacTags` (`VORBIS_COMMENT` tipo 4: `TITLE`, `ARTIST`, `ALBUM`, `ALBUMARTIST`, `TRACKNUMBER`, y `METADATA_BLOCK_PICTURE` en base64) |
| Firmas de imagen | `src/domain/artwork/bytes.ts`: `ArtworkMime` amplía a WebP y GIF, `EXTENSION_BY_MIME`, `sniffArtworkMime` (JPEG/PNG/WebP/GIF) y `u24`/`u32le` para FLAC |
| Etiquetas FLAC | `src/services/tag.service.ts`: `flac` en `TAG_EXTENSIONS` y rama por firma `fLaC` |
| Arte de carpeta | `src/services/artwork.service.ts`: `readFolderArtwork` busca `cover`/`folder`/`front`/`album` (`.jpg`/`.jpeg`/`.png`/`.webp`) junto al archivo y devuelve la **URI original** (no se copia a la caché) |
| Cadena de resolución | `resolveArtworkUri` = caché → arte embebido → arte de carpeta; `resolveAlbumArtwork` agrupa y prueba hasta `MAX_ATTEMPTS_PER_ALBUM` pistas (subido de 2 a **5**), reutilizado por el escaneo y el barrido |
| Barrido de ausentes | `src/services/artwork-backfill.service.ts`: `runArtworkBackfill({force?, onProgress?})` agrupa por álbum, emite la fase `backfill` y sella por grupo |
| Sello por pista | Migración **V7**: `songs.artwork_checked_at`. El barrido automático solo revisa filas con `artwork_checked_at IS NULL` (una vez por pista); la acción manual usa `force` (todas las que siguen sin portada) |
| Integración | `runLibraryScan` ejecuta el barrido tras `reclassifyAudiobooks` (fase `backfill`), envuelto en `try/catch`; también como acción manual «Buscar carátulas faltantes» en Ajustes |
| No pisar portada | `upsertBatch` usa `artwork_uri = COALESCE(excluded.artwork_uri, artwork_uri)` para no perder una portada existente si la extracción falla |

### Desviaciones y limitaciones

| Plan | Implementado | Motivo |
| --- | --- | --- |
| Leer `album_art` de MediaStore | **Descartado** | `expo-media-library` SDK 58 no expone `album_art` de MediaStore; requeriría un módulo nativo |
| OGG/OPUS embebido | **Diferido** | Comparten contenedor Ogg (no FLAC nativo); el parser FLAC no aplica y no se añadió parser Ogg |
| BMP como portada | **Diferido** | Fuera de `ArtworkMime`; poco frecuente y de gran tamaño |
| Recopilatorios multi-artista | **Diferido** | El agrupado por álbum usa `${album}\0${artist}`; un disco con artistas distintos por pista se trata como varios álbumes |

### Criterios de salida

| Criterio | Resultado |
| --- | --- |
| FLAC leídos | Arte embebido y etiquetas de texto extraídos; los FLAC dejan de fragmentar álbumes |
| Arte de carpeta | Se resuelve cuando no hay arte embebido, devolviendo la URI original de la imagen |
| Barrido de ausentes | Corre una sola vez por pista en el escaneo (sello `artwork_checked_at`) y a demanda desde Ajustes con `force` |
| Sin pérdida de portadas | `COALESCE` en `upsertBatch` conserva la portada previa ante un fallo de extracción |
| Pruebas | `artwork-flac.test.ts`, `artwork-bytes.test.ts`, `artwork-backfill.service.test.ts`; actualizados `migrations.test.ts` (v7), `song.repository.test.ts` (650/650/260 + barrido) y `library-scan.service.test.ts` |
| Verdes | `tsc` limpio · `jest` **38 suites / 281 pruebas** · `expo lint` 0 problemas |

### Verificación en dispositivo (FASE 5.1)

Dispositivo: Infinix X6826 (`09729372AM004325`), Android 12 (SDK 31), APK release 1.0.0 canal `preview`, app `com.abelo.mimusicplayer`.
OTA aplicada: grupo `26d5bb22-e93c-4dab-98d1-71f321ee9629`, update Android `01a1eed5-5cd9-73f8-83f8-c80229e277ca`, runtime `1.0.0`, commit `7c49383`.

| Comprobación | Resultado |
| --- | --- |
| OTA aplicada | ✅ Ajustes muestra la fila nueva «Buscar carátulas faltantes» («Relee la portada de las canciones que no la muestran (FLAC incluidos).») → el bundle principal es el de `7c49383` |
| Acción manual del barrido | ✅ el diálogo confirma y «Búsqueda terminada» responde «No se encontraron carátulas nuevas en los archivos revisados» (candidatas > 0, resueltas 0: el barrido automático del primer escaneo tras la OTA ya había completado todo lo extraíble) |
| Arte embebido FLAC (`AR-01`) | ✅ «505» (`Arctic Monkeys - 505.flac`, **sin** `cover.jpg` en su carpeta) muestra portada (`ImageView` de 52 dp); su fila conserva «Artista desconocido» (metadatos viejos, no re-hidratados) → la portada salió del bloque `PICTURE`, no de carpeta ni de releer etiquetas |
| Parser contra archivo real | ✅ `extractFlacArtwork`/`extractFlacTags` sobre el FLAC extraído del dispositivo devuelven `image/jpeg` (171 485 B) y las etiquetas `TITLE`/`ARTIST`/`ALBUM`/`ALBUMARTIST`/`TRACKNUMBER` |
| Detección validada (control negativo) | ✅ en Audiolibros, las filas con portada rinden `ImageView` y las que no la tienen rinden la `View` de reserva con glifo (`Ionicons`), en la **misma** lista → `ImageView` ⇔ portada real |
| Reescaneo (regresión) | ✅ «Volver a escanear» termina en «sin cambios · 1 s»; el barrido integrado no rompe el escaneo |
| Sin errores nuevos | ✅ «Registro de errores» sigue con **2 sucesos**, ambos de `audio/lock-screen` (`setActiveForLockScreen`), ninguno de `artwork-service` |

**Pendiente de reproducir en este dispositivo (limitación del entorno, no del código):**

- **Arte de carpeta (`AR-02`):** el dispositivo no tiene ninguna imagen `cover.*`/`folder.*`/`front.*`/`album.*`/`artwork.*` en las carpetas de música (verificado con `toybox find` y con `content query` sobre MediaStore), así que la ruta de respaldo no es ejercitable aquí; queda cubierta por `artwork-bytes.test.ts` y por lectura de código.

**Método de medición:** `uiautomator dump` con la reproducción **pausada** (`adb shell input keyevent 127`; con reproducción activa la ventana nunca queda «idle» y el dump falla o devuelve el árbol anterior). La portada se distingue por el nodo `android.widget.ImageView` de 52 dp (104 px) al inicio de cada fila, frente a la `View` de reserva con glifo cuando no hay portada.

### Subidas (GitHub y OTA)

| Subida | Detalle |
| --- | --- |
| Commit | `7c49383` — «feat(artwork): soporte FLAC, arte de carpeta y barrido de caratulas ausentes (FASE 5.1)» (19 archivos, +1493/−66) |
| Rama | `fase/5.1-caratulas-ausentes` empujada a `origin` |
| Fusión | `master` por **fast-forward** (mismo commit que la OTA) |
| OTA `preview` | grupo `26d5bb22-e93c-4dab-98d1-71f321ee9629`; Android `01a1eed5-5cd9-73f8-83f8-c80229e277ca`; runtime `1.0.0` |
| Estado OTA | descargada y aplicada en el Infinix X6826 (`CheckCompleteUnavailable`, `isUpdateAvailable=false`; la fila nueva de Ajustes confirma el bundle) |

---

## FASE 6 · UI/UX, animaciones y accesibilidad

**Esfuerzo:** 4–6 días
**Objetivo:** coherencia visual, estados de carga reales, animaciones con propósito y accesibilidad verificada. No es «embellecer»: es eliminar fricción y malentendidos.

### Problemas que ataca

| ID | Problema |
| --- | --- |
| `UI-03` | Splash siempre oscuro → destello en tema claro |
| `UI-04` | `userInterfaceStyle: automatic` vs. tema manual |
| `UI-05` | Seis pestañas inferiores con etiquetas largas en pantallas estrechas |
| `UI-06` | Arranque sin progreso granular (UI) |
| `UI-07` | Botones que comunican estado solo por color |
| `UI-09` | Restos de plantilla y `adaptiveIcon` azul por defecto |
| `UI-10` | `CategoryBar` sin etiqueta accesible |
| `UI-11` | `Spacing` sin paso de 12; literales 10/12 |
| `UI-12` | Hojas modales: posible cierre al tocar el contenido |
| `M-08` | Accesibilidad parcial, sin auditoría con TalkBack |
| `B-06` | Duplicación del mapeo de tema |

### Archivos a modificar

| Archivo | Cambio |
| --- | --- |
| `src/constants/theme.ts` | Paso de espaciado 12; tokens de icono/estado |
| `src/app/_layout.tsx` | Tema de navegación derivado de tokens; splash coherente |
| `src/app/(tabs)/_layout.tsx` | Revisar 6 pestañas; etiquetas cortas o agrupación |
| `src/components/category-bar.tsx` | `accessibilityLabel` por elemento y rol |
| `src/components/option-sheet.tsx`, `sort-sheet.tsx`, `playlist-picker.tsx`, `text-prompt-modal.tsx` | Revisar backdrop `Pressable` anidado (`UI-12`) |
| `src/components/song-row.tsx`, `mini-player.tsx`, `seek-bar.tsx` | Estado no solo por color; objetivos táctiles ≥ 44 dp |
| `src/components/screen-shell.tsx` | Estados de carga/error/vacío consistentes |
| `app.json` | Splash, `adaptiveIcon.backgroundColor`, textos de permisos |
| `assets/images/` | Retirar `expo-logo.png`, `react-logo*.png`, `tutorial-web.png`, `logo-glow.png` |

### Funcionalidades a implementar

1. **Sistema de espaciado completo** (4/8/12/16/24/32) y sustitución de literales.
2. **Splash y tema nativo coherentes** con el tema activo.
3. **Navegación inferior revisada**: 5 destinos + «Más», o etiquetas de una palabra; validar a 320 dp.
4. **Estados de carga con esqueleto** en biblioteca y playlists.
5. **Animaciones con propósito**: transición de mini-player a reproductor, aparición de portada, sin animaciones decorativas.
6. **Accesibilidad**: etiquetas, roles, orden de foco, contraste AA, soporte de tamaño de fuente dinámico.
7. **Modales sin cierre accidental** verificado en dispositivo.

### Dependencias

- **Ninguna nueva obligatoria.**
- **Reevaluar `react-native-reanimated`:** si se retiró en FASE 2 y se quieren gestos/animaciones fluidas, **volver a instalarla con `npx expo install`** (versión resuelta por SDK) y justificarlo. Alternativa sin dependencia: `Animated` de React Native, suficiente para las transacciones previstas.
- **Descartado:** librería de UI completa (Tamagui, gluestack). El sistema actual con tokens es suficiente y ya está coherente.

### Skills a consultar

`opencode`, `context7-mcp` (API de animación de React Native 0.88, accesibilidad, `expo-splash-screen` si se usa).

### MCP a usar

Context7 ✅ · Expo MCP ❌ · GitHub MCP ❌.

### Riesgos de compatibilidad

| Riesgo | Nivel | Mitigación |
| --- | --- | --- |
| Cambiar el splash exige rebuild nativo | **ALTO** | Requiere development build o `eas build`; no se ve en Expo Go |
| Animaciones con Reanimated exigen plugin Babel y dev build | MEDIO | Si se usa, `expo install` + prebuild; si no, `Animated` |
| Reducir pestañas cambia rutas y deep links | MEDIO | Mantener rutas existentes; cambiar solo la presentación |
| Tamaño de fuente dinámico rompe layouts fijos | MEDIO | Probar con escala 1.3 y 2.0 |
| Contraste AA choca con la paleta actual | BAJO | Ajustar `textSecondary` claro (`#60646C` cumple; verificar sobre `backgroundElement`) |

### Pruebas

- Snapshot visual manual en 320/360/412 dp y en tema claro/oscuro.
- `axe`/TalkBack manual: recorrido completo de biblioteca → reproductor → cola.
- Unitarias: helpers de espaciado y tema.
- Regresión: ninguna pantalla pierde funcionalidad.

### Criterios de salida

1. Cero literales de color en componentes de pantalla (todos vía tokens).
2. Cero literales de espaciado fuera de la escala.
3. TalkBack puede completar: abrir canción, pausar, siguiente, añadir a playlist, cambiar tema.
4. Ninguna pantalla se rompe con fuente al 200 % ni a 320 dp.
5. Splash y tema del sistema coinciden con el tema activo (verificado en build).
6. `UI-12` verificado en dispositivo (cierra o no cierra; comportamiento documentado).
7. Verdes: `tsc`, `jest`, `expo-doctor`, `expo lint`.

---

## FASE 7 · Pruebas y optimización

**Esfuerzo:** 4–5 días
**Objetivo:** cubrir las capas que hoy no tienen pruebas (`A-08`), automatizar la verificación y medir el rendimiento con datos reales.

### Problemas que ataca

| ID | Problema |
| --- | --- |
| `A-08` | 0 pruebas de motor, stores, repositorios, servicios y componentes |
| `M-05` | No hay CI |
| `M-09` | `runtimeVersion.policy: "appVersion"` con versión fija |
| `B-05` | Constantes mágicas dispersas |

### Archivos a modificar / crear

| Archivo | Acción |
| --- | --- |
| `src/services/audio/__tests__/*` | **Nuevo.** Native playlist, lock screen, sesión |
| `src/stores/__tests__/*` | **Nuevo.** `player`, `library`, `notice`, `settings` |
| `src/data/repositories/__tests__/*` | **Nuevo.** Con `expo-sqlite` en modo memoria o mock |
| `src/services/__tests__/*` | **Nuevo.** `media`, `artwork`, `tag`, `media-widget` |
| `src/testing/mocks/` | **Nuevo.** Dobles de `expo-audio`, `expo-media-library`, `expo-widgets` |
| `jest.config` (en `package.json`) | Umbrales de cobertura |
| `.github/workflows/ci.yml` | **Nuevo.** `tsc`, `lint`, `jest`, `expo-doctor` |
| `src/services/audio/*` | Extraer constantes a `config` |
| `app.json` | Revisar `runtimeVersion` |

### Funcionalidades a implementar

1. **Dobles de prueba** para todos los módulos nativos usados.
2. **Cobertura objetivo**: dominio ≥ 90 % (ya cerca), servicios ≥ 70 %, stores ≥ 80 %, global ≥ 65 % en líneas.
3. **CI** en cada push y PR: typecheck, lint, pruebas, `expo-doctor`.
4. **Benchmarks** existentes ampliados a escaneo y render de listas.
5. **Medición en dispositivo**: arranque en frío, escaneo de 12 000 pistas, memoria con lista de 5 000 filas, batería en 30 min de reproducción.
6. **Decisión sobre `runtimeVersion`**: `appVersion` o `sdkVersion`, documentada.

### Dependencias

- **Ninguna de runtime.**
- **Dev, solo si hace falta:** `@testing-library/react-native` para componentes. Verificar compatibilidad con React 19.3 y RN 0.88 antes de instalar; si no es compatible, se limita la cobertura a lógica y se documenta.

### Skills a consultar

`opencode`, `context7-mcp` (`jest-expo` SDK 58, mocking de módulos Expo), `find-skills` si se busca un skill de testing no registrado.

### MCP a usar

Context7 ✅ · Expo MCP ❌ · GitHub MCP ❌ (no se puede crear el workflow por API; se escribe el archivo).

### Riesgos de compatibilidad

| Riesgo | Nivel | Mitigación |
| --- | --- | --- |
| `jest-expo` y RN 0.88 requieren ajustes de transform | MEDIO | Ya funciona con 111 pruebas; ampliar el mismo preset |
| Mockear `expo-audio` oculta bugs reales | MEDIO | Complementar con pruebas manuales en dev build documentadas |
| Testing Library incompatible con React 19.3 | MEDIO | Verificar peer deps; si falla, no bloquear la fase |
| CI sin secretos para `expo-doctor` | BAJO | `expo-doctor` no requiere login para las comprobaciones básicas |

### Pruebas

- La propia fase consiste en pruebas; el criterio es la cobertura y el CI verde.
- Prueba de humo E2E manual documentada (guion de 12 pasos).

### Criterios de salida

1. Cobertura global ≥ 65 % y servicios ≥ 70 % (medida, no estimada).
2. CI ejecuta y pasa en un push limpio.
3. Existe al menos una prueba por cada hallazgo corregido (`C-01`, `C-02`, `A-01`, `A-02`, `A-03`, `A-04`, `A-07`).
4. Benchmarks de escaneo y render registrados con número.
5. Guion de prueba manual en `docs/TESTING.md` (`B-02`).
6. `runtimeVersion` decidido y documentado.
7. Verdes: `tsc`, `jest`, `expo-doctor`, `expo lint`.

---

## FASE 8 · APK y producción

**Esfuerzo:** 2–3 días
**Objetivo:** publicar con un artefacto correcto, versionado y actualizable. Esta fase tiene un problema concreto y conocido: **`eas.json` genera APK en producción**, lo que impide publicar en Google Play.

### Problemas que ataca

| ID | Problema |
| --- | --- |
| — | `eas.json` producción usa `buildType: "apk"` → no sirve para Play Store (requiere AAB) |
| `M-09` | OTA con `runtimeVersion` fijo por `appVersion` |
| `A-05`/`A-06` | Cierre: APK sin dependencias ni permisos innecesarios |
| `UI-09` | Iconos y splash definitivos |

### Archivos a modificar

| Archivo | Cambio |
| --- | --- |
| `eas.json` | `production.build.android.buildType: "app-bundle"`; conservar `preview` con APK para pruebas internas |
| `app.json` | `version` inicial, `android.versionCode`, iconos definitivos, splash, textos de Play |
| `docs/` | `TESTING.md`, `ARCHITECTURE.md`, `DATABASE.md`, `CODING_STANDARDS.md` (`B-02`) |
| `README.md` | Requisitos reales, comandos, limitaciones conocidas, proceso de release |
| `CHANGELOG.md` | **Nuevo.** Primera versión |

### Funcionalidades a implementar

1. **Perfiles EAS**: `development` (dev client), `preview` (APK interno), `production` (AAB).
2. **Versionado**: `version` semántica + `autoIncrement` de `versionCode`.
3. **Política OTA** acorde a la decisión de FASE 7.
4. **Checklist de release**: firma, tamaño, permisos efectivos del APK/AAB, pruebas en dispositivo limpio.
5. **Documentación de limitaciones**: widget en Expo Go, lock screen por fabricante, escaneo inicial largo.

### Dependencias

- **Ninguna nueva.**
- **Herramientas:** `eas-cli` (vía `npx eas-cli@latest`), cuenta Expo, keystore gestionado por EAS.

### Skills a consultar

`opencode`, `context7-mcp` (EAS Build y `runtimeVersion`), `report` si se detecta un bug de plataforma reproducible.

### MCP a usar

Context7 ✅ · Expo MCP ❌ · GitHub MCP ❌.

### Riesgos de compatibilidad

| Riesgo | Nivel | Mitigación |
| --- | --- | --- |
| Cambiar a AAB impide instalar directo | Confirmado por diseño | Mantener `preview` APK para QA |
| `expo-widgets` requiere prebuild y configuración Android | **ALTO (confirmado)** | `npx expo prebuild` en el perfil; validar `enableAndroid` + `android.package` |
| Iconos adaptativos mal recortados | MEDIO | Probar máscaras circle/squircle/rounded |
| OTA a versión equivocada | MEDIO | `runtimeVersion` coherente; probar `eas update` en canal interno |
| Revisión de Play por permisos | BAJO tras `A-06` | Declaración de permisos y política de privacidad |

### Pruebas

- Instalación limpia en dispositivo sin la app previa.
- Actualización desde la versión anterior conservando datos (migraciones SQLite).
- Verificación de permisos efectivos con `adb shell dumpsys package`.
- `eas build --profile production` y `eas submit` en modo borrador.

### Criterios de salida

1. `eas.json` produce AAB en producción y APK en preview.
2. Instalación limpia funciona: escaneo, reproducción, widget, restauración de sesión.
3. Actualización desde la build anterior conserva biblioteca, playlists, favoritos e historial.
4. Permisos efectivos = permisos declarados = permisos usados.
5. Documentación de limitaciones publicada.
6. Artefacto firmado y versionado listo para revisión.

---

## 2. Dependencias entre fases (por qué este orden)

```
FASE 1 ──► FASE 2 ──► FASE 4 ──► FASE 5 ──► FASE 5.1
              │           ▲
              └──► FASE 3 ┘

FASE 1..5.1 ──► FASE 6 ──► FASE 7 ──► FASE 8
```

- **FASE 1 antes que todo:** sin rollback (`A-09`) y sin los dos críticos, cualquier refactor se hace sobre arena.
- **FASE 2 antes que 3 y 4:** el escaneo y la sesión necesitan el canal de avisos y las capacidades; y la sesión necesita la máquina de estados.
- **FASE 3 antes que 4:** restaurar una sesión exige que los ids de la biblioteca sean fiables (sin truncado, sin borrados en duro).
- **FASE 5 después de 4:** el widget publica el estado del motor; sin sesión persistente, el snapshot nace muerto tras cada muerte de proceso.
- **FASE 5.1 después de 5:** es una reparación puntual de la biblioteca (FLAC, arte de carpeta, pistas ya guardadas); no depende de la UI de FASE 6 y desbloquea las mediciones de FASE 7.
- **FASE 6 después de 5:** no tiene sentido pulir la UI de estados que aún no existen.
- **FASE 7 antes que 8:** se publica lo que está medido.

---

## 3. Riesgos transversales del plan

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| No hay dispositivo/emulador en la auditoría | Alto: todo lo nativo está sin verificar | FASE 1 debe empezar con un development build instalado; las verificaciones manuales se documentan con captura |
| Expo Go no soporta `expo-widgets` ni garantiza background | Alto | Desarrollo diario en Expo Go para UI; pruebas nativas en dev build por fase |
| Un fabricante (Xiaomi, Huawei, Samsung) mata el proceso | Alto | Documentar; `A-01` reduce el daño a «se reanuda en pausa» |
| El refactor del motor introduce regresiones sutiles | Alto | Fachada con API idéntica + 111 pruebas de regresión + pruebas nuevas de sesión |
| El escaneo sin tope penaliza el arranque | Medio | Progreso observable, incremental, y medir antes/después en FASE 7 |
| Cambios en `app.json` exigen rebuild nativo | Medio | Agrupar cambios nativos por fase para no reconstruir en cada commit |
| Skills de Expo no invocables | Medio | Sustituir con Context7 + docs oficiales v58; registrar la limitación |

---

## 4. Qué se puede hacer ya, sin esperar a las 8 fases

Si el objetivo es **mejorar el producto esta semana** con riesgo mínimo:

1. **FASE 1 completa** (2–3 días): elimina los dos críticos y crea el punto de retorno. Es la única fase con ratio riesgo/beneficio claramente favorable por sí sola.
2. **El commit de seguridad** del paso 0, aunque no se haga nada más.
3. **La poda de permisos** (`A-06`) si se va a publicar pronto: es un cambio de una línea por permiso y evita fricción en Play.

Todo lo demás gana mucho si va después de la separación del motor (FASE 2).

---

**Documentos relacionados:** `01-project-analysis.md` (estado y madurez), `02-compatibility-report.md` (qué corre en Expo Go), `03-functional-audit.md` (hallazgos con ID), `04-ui-ux-audit.md` (`UI-01`…`UI-12`), `05-architecture-proposal.md` (diseño objetivo), `07-dependencies-and-tools.md` (veredictos), `08-testing-strategy.md` (estrategia de verificación).
