# 03 · Auditoría funcional

**Referencia:** `docs/requirements/SRS.md` (RF-001…RF-013, RNF-001…RNF-007), `scope.md`, `user-stories.md`, `uses-cases.md`.
**Método:** trazabilidad requisito → código → comportamiento observable. Cada estado se apoya en archivos concretos.

Escala:

- ✅ **Implementado** y coherente con el requisito.
- 🟡 **Implementado con reservas** (funciona, pero con una limitación conocida).
- ❌ **No implementado** o implementado de forma que no cumple el requisito.
- ❓ **No verificable** sin dispositivo/entorno nativo.

---

## 1. Tabla de trazabilidad

| Req. | Función | Implementación | Estado |
| --- | --- | --- | --- |
| RF-001 | Detectar audio, metadatos, portadas, fecha de alta, audiolibros, sin duplicados, archivos inaccesibles, SQLite | `media.service.ts`, `domain/metadata.ts`, `domain/artwork/*`, `song.repository.ts` (`is_available`, `last_seen_at`, `ON CONFLICT(media_id)`) | ✅ |
| RF-002 | Reproducir/pausar, anterior/siguiente, seek, tiempos, aleatorio, repetir canción/lista | `audio-engine.ts`, `player.store.ts`, `player.tsx`, `seek-bar.tsx` | ✅ |
| RF-002 | Reproducción en segundo plano | `expo-audio` + plugin `enableBackgroundPlayback` | 🟡 `C-01` |
| RF-002 | Notificación con título/artista/carátula/controles | `setActiveForLockScreen` + `updateLockScreenMetadata` | 🟡 `C-01` |
| RF-002 | Controles en pantalla de bloqueo | Igual que la notificación | 🟡 `C-01` |
| RF-002 | Widget con portada, título, artista, progreso, tiempos y controles | `widgets/media-widget.tsx`, `media-widget.service.ts` | 🟡 `A-02`, `A-03` |
| RF-002 | Controles persistentes durante la navegación | `mini-player.tsx` montado en `_layout.tsx` | ✅ |
| RF-003 | Inicio con resumen, accesos rápidos, recientes, más escuchadas, álbumes, playlists | `(tabs)/index.tsx`, `quick-access.tsx`, `section-header.tsx` | ✅ |
| RF-004 | Categorías canciones/álbumes/artistas/audiolibros/playlists/favoritos | 6 rutas + vistas internas | ✅ |
| RF-005 | Favoritos persistentes y reproducibles | `favorite.repository.ts`, `toggleFavorite`, filtro en `songs.tsx` | ✅ |
| RF-006 | Playlists manuales (crear, nombrar, agregar, quitar, reordenar, borrar, reproducir) | `playlist.repository.ts`, `playlists.tsx`, `playlist/[id].tsx`, `playlist-picker.tsx`, `domain/playlists/reorder.ts` | ✅ |
| RF-006 | Playlists automáticas (6) | `domain/library/auto-playlists.ts` + pruebas | ✅ |
| RF-007 | Ordenamientos de canciones/álbumes/artistas/playlists | `domain/library/sorting.ts`, `sort-sheet.tsx` | ✅ |
| RF-008 | Búsqueda con debounce en canciones/álbumes/audiolibros | `use-debounced-value.ts`, pantallas | ✅ |
| RF-009 | Cola: ver, agregar, reproducir a continuación, quitar, reordenar, vaciar, aleatorio, repetición | `player.store.ts`, `queue.tsx` | ✅ |
| RF-010 | Historial con fecha, contador, última reproducción y umbral de escucha válida | `history.repository.ts`, `domain/playback/valid-play.ts` | ✅ |
| RF-011 | Tema claro/oscuro persistido | `settings.store.ts`, `settings.repository`, `(tabs)/settings.tsx` | ✅ |
| RF-011 | Información de la app, administración de biblioteca, datos y diagnóstico | `settings.tsx`, `error-log.service.ts`, `logs.tsx` | ✅ |
| RF-012 | Audiolibros: clasificación automática/manual, agrupación, búsqueda, reproducción, persistencia | `domain/library/audiobooks.ts`, `audiobooks.tsx` | 🟡 `A-07` (agrupación por carpeta) |
| RF-013 | Registro de errores con contexto, deduplicación y contador | `error-log.service.ts`, `error-log.repository.ts` (límite 200) | ✅ |
| RNF-001 | Rendimiento: listas eficientes, queries con índices, evitar cargar todo en memoria | Índices en migraciones, store de progreso aislado, `FlatList` | 🟡 sin medición en dispositivo |
| RNF-002 | Evitar dependencias innecesarias | 12+ paquetes declarados sin uso | ❌ `A-05` |
| RNF-003 | Persistencia de favoritos, playlists, historial, preferencias, metadatos | SQLite cubre todo lo listado | ✅ |
| RNF-004 | Funcionar sin Internet | Todo local; OTA es opcional | ✅ |
| RNF-005 | Android/iOS, Expo, validación en Development Build | Configurado, sin evidencia de build | 🟡 |
| RNF-006 | Permisos mínimos, sin credenciales, sin datos personales | 2 permisos innecesarios | ❌ `A-06` |
| RNF-007 | Mantenibilidad: TypeScript, arquitectura | Excelente base | ✅ |

---

## 2. Flujos funcionales verificados en código

### 2.1 Arranque

1. `_layout.tsx` hidrata **ajustes** y luego **biblioteca**.
2. `library.store.hydrate()` lee primero SQLite (biblioteca de la sesión anterior aparece al instante) y consulta el permiso en paralelo.
3. Si hay permiso y la BD está vacía, mantiene el loader hasta que termina la primera sincronización.
4. La sincronización corre **en silencio** (`isSyncing`, no `isScanning`), con deduplicación por `scanPromise`.
5. `libraryMatchesDevice()` compara solo ids: si coincide, **no** relee etiquetas.

**Valoración:** flujo bien pensado. El arranque percibido es rápido y no bloquea la UI con la biblioteca persistida. ✅

### 2.2 Escaneo

1. `loadDeviceAudio()` ejecuta `new Query().eq(MEDIA_TYPE, AUDIO).orderBy(CREATION_TIME).limit(5000)`.
2. `mapLimit(assets, 4, toSong)` lee etiquetas y resuelve metadatos.
3. `upsertScannedSongs()` marca primero todo `is_available = 0` y luego hace upsert por lotes de 50 con `is_available = 1`.
4. `reclassifyAudiobooks()` aplica la heurística de duración.

**Valoración:** correcto y con buen manejo de archivos eliminados. Dos reservas: el tope de 5000 (`C-02`) y la relectura completa de etiquetas cuando cambia un solo id (`M-04`).

### 2.3 Reproducción

1. `startQueue()` reutiliza la playlist nativa si el orden coincide; si no, `disposePlaylist()` → `createPlaylist()`.
2. `disposePlaylist()` hace `pause → clearLockScreenControls → destroy → release`. **Este orden es correcto** y evita reproductores vivos.
3. Los eventos `playlistStatusUpdate` y `trackChanged` alimentan `syncStatus` y `syncTrack`.
4. `seek()` es optimista con timeout de 1500 ms para no rebotar la barra.
5. `toggleShuffle()` y `moveInQueue()` reconstruyen la cola nativa conservando pista, posición y estado.

**Valoración:** el diseño del motor es sólido. El punto débil no es la reproducción en sí, sino **la activación del lock screen** (`C-01`).

### 2.4 Cola

`queue.tsx` permite mover, quitar, vaciar, saltar y reproducir. `appendSong`, `insertAfterCurrent` y `removeSongById` mantienen sincronizada la playlist nativa.

**Valoración:** cumple `RF-009` completo. Limitación: **la cola vive solo en memoria** (`A-01`).

### 2.5 Widget

- El servicio comprueba `requireOptionalNativeModule('ExpoWidgets')` antes de importar.
- Publica snapshots con coalescing: solo si cambia pista/estado/duración, hay seek, o pasaron 5 s.
- Copia la portada a `widgetsDirectory` y poda las anteriores.
- Los botones del widget usan `target` + `addUserInteractionListener`.

**Valoración:** implementación cuidadosa. Tres defectos: colores fijos (`A-02`), botones anterior/siguiente inertes sin proceso vivo (`A-03`) y falta de etiquetas de accesibilidad.

### 2.6 Ajustes y datos

- Tema persistido en SQLite.
- Actualización OTA con comprobación y prompt.
- Limpiar historial y borrar datos administrativos con confirmación.
- Diagnóstico con logs deduplicados (máx. 200).

**Valoración:** cumple `RF-011` y `RF-013`. ✅

---

## 3. Hallazgos

Convención: **Confirmado** = verificado en código/configuración; **Riesgo** = comportamiento probable no reproducible en esta auditoría.

### CRÍTICO

#### `C-01` · La reproducción en segundo plano puede desactivarse para siempre tras un solo fallo

- **Severidad:** CRÍTICO · **Confirmado (código + documentación oficial)**
- **Dónde:** `src/services/audio-engine.ts:140-156` (`withLockScreenGuard`), `:324-329` (`activateLockScreen`).
- **Qué ocurre:** `withLockScreenGuard` ejecuta la operación dentro de `try/catch`. Si `setActiveForLockScreen` lanza **una sola vez**, el módulo pone `lockScreenControlsSupported = false` y **no vuelve a intentarlo en toda la sesión**. No hay reintento, no hay aviso en la UI, y el usuario no se entera.
- **Por qué es crítico:** la documentación de `expo-audio` SDK 58 dice textualmente: *«On Android, you have to enable the lock screen controls with `setActiveForLockScreen` for sustained background playback. Otherwise, the audio will stop after approximately 3 minutes of background playback (OS limitation)»*. Es decir: un fallo transitorio degrada el producto a «la música se corta a los 3 minutos» de forma permanente y silenciosa. Además incumple `RF-002` (notificación, pantalla de bloqueo y reproducción en segundo plano).
- **Impacto adicional:** sin lock screen activo tampoco hay notificación con controles ni metadatos.
- **Recomendación:** ver `06-development-roadmap.md` FASE 1.

#### `C-02` · La biblioteca se trunca en 5000 pistas sin avisar

- **Severidad:** CRÍTICO · **Confirmado**
- **Dónde:** `src/services/media.service.ts:33` (`MAX_SONGS = 5000`), usado en `:72` y `:146`.
- **Qué ocurre:** tanto la consulta ligera de ids como la consulta completa aplican `.limit(5000)`. El usuario con más de 5000 archivos de audio ve una biblioteca incompleta **sin ningún aviso**. Peor aún: `libraryMatchesDevice()` compara tamaños de conjuntos; con truncamiento en ambos lados la comparación puede dar «coincide» y **nunca** se descubren las pistas restantes.
- **Por qué es crítico:** es pérdida silenciosa de datos desde la perspectiva del usuario (canciones «desaparecidas»), y contradice `RF-001` («detectar archivos de audio compatibles») sin excepción documentada.
- **Recomendación:** paginar la consulta o eliminar el tope; si se mantiene por rendimiento, mostrar un aviso explícito y configurable.

---

### ALTO

#### `A-01` · Sin persistencia de la sesión de reproducción

- **Severidad:** ALTO · **Confirmado**
- **Dónde:** `src/stores/player.store.ts` (estado en memoria), `audio-engine.ts` (playlist en memoria).
- **Qué ocurre:** cola, pista actual, posición, modo de repetición y aleatorio se pierden si el proceso muere. Al reabrir, el reproductor está vacío.
- **Matiz:** el SRS no exige explícitamente reanudar la sesión en `RF-009`/`RNF-003`, pero Android mata procesos en segundo plano con frecuencia; en la práctica el usuario percibe «se cerró la música y se olvidó de todo».
- **Recomendación:** persistir sesión mínima (ids de cola, pista, posición, modos) y restaurar sin auto-play.

#### `A-02` · El widget ignora el tema de la aplicación

- **Severidad:** ALTO · **Confirmado**
- **Dónde:** `src/widgets/media-widget.tsx:62,76,82,88,97-98,104,107,122,131,141`.
- **Qué ocurre:** los colores están escritos a mano (`#0B0B0F`, `#1C1C26`, `#7C5CFF`, `#9A9AA8`, `#2A2A38`, `#FFFFFF`). No se usan los tokens de `constants/theme.ts` ni el `environment.colorScheme` que `expo-widgets` expone en Android (documentación SDK 58: *«The `environment` argument provides only `colorScheme` on Android»*).
- **Consecuencia:** con tema claro el widget sigue siendo oscuro; si se cambia la paleta de la app, el widget queda desincronizado.
- **Restricción técnica real:** el runtime del widget es aislado y **no puede importar** constantes de módulo. La solución correcta es **pasar los colores resueltos por props** desde `updateSnapshot`, no importarlos.

#### `A-03` · Los botones «anterior» y «siguiente» del widget no hacen nada si la app no está viva

- **Severidad:** ALTO · **Confirmado (código + documentación)**
- **Dónde:** `src/widgets/media-widget.tsx:117-124` y `:136-143` (`onClick={() => undefined}`).
- **Qué ocurre:** solo el botón central devuelve props nuevas (`isPlaying`). Anterior y siguiente dependen de `addUserInteractionListener`, que según la documentación **solo se dispara mientras el proceso de la app está vivo**. Con la app cerrada, pulsar anterior/siguiente no produce ningún efecto visible.
- **Consecuencia:** el widget promete controles que no cumplen `RF-002` en el escenario más probable (app en segundo plano profundo).
- **Agravante:** los botones no tienen `contentDescription`, así que un lector de pantalla no puede identificarlos.
- **Recomendación:** aceptar la limitación y **no mostrar** esos botones cuando no haya proceso, o sustituirlos por acciones que el runtime pueda resolver (p. ej. un `target` que devuelva props derivadas), y documentarlo.

#### `A-04` · Los fallos son invisibles para el usuario

- **Severidad:** ALTO · **Confirmado**
- **Dónde:** `audio-engine.ts` (`logError` en cada `catch`), `media.service.ts`, `media-widget.service.ts`, `library.store.ts`.
- **Qué ocurre:** todos los errores van a `error_logs` (consultable solo en Ajustes → Diagnóstico). No hay `Alert`, banner ni estado de error en pantalla para: permiso denegado, fallo de escaneo, lock screen no disponible, widget no disponible, portada no resoluble.
- **Consecuencia:** el usuario no puede distinguir «no hay canciones» de «no pude leer la biblioteca». `library.store` ya expone `error`, pero la UI no lo explota de forma sistemática.
- **Recomendación:** un canal único de feedback no intrusivo + estados vacíos que expliquen la causa.

#### `A-05` · Dependencias y plugins declarados sin uso

- **Severidad:** ALTO · **Confirmado** (viola `RNF-002`)
- **Dónde:** `package.json`, `app.json`.
- **Qué ocurre:** sin ninguna importación en `src/`: `expo-symbols`, `expo-glass-effect`, `expo-font`, `expo-device`, `expo-system-ui`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`. Además `expo-web-browser` y `expo-asset` se declaran como plugins sin uso funcional.
- **Consecuencia:** APK más grande, más superficie de actualización, más ruido en auditorías y en `expo-doctor`.
- **Veredicto por paquete:** en `07-dependencies-and-tools.md`.

#### `A-06` · Permisos Android por encima de lo necesario

- **Severidad:** ALTO · **Confirmado** (viola `RNF-006`)
- **Dónde:** `app.json:22-31`.
- **Qué ocurre:** `WRITE_EXTERNAL_STORAGE` y `READ_MEDIA_VISUAL_USER_SELECTED` no se usan en ninguna parte del código. `MODIFY_AUDIO_SETTINGS` tampoco es necesario para reproducir.
- **Consecuencia:** fricción en la instalación y riesgo en la revisión de Google Play.

#### `A-07` · La agrupación de audiolibros se degrada con URIs `content://`

- **Severidad:** ALTO (condicionado al tipo de biblioteca) · **Confirmado (código)**
- **Dónde:** `media.service.ts:88-99` (`folderFromUri` solo acepta `file://`), `domain/library/audiobooks.ts:76` (`book = album !== UNKNOWN_ALBUM ? album : folder ?? UNKNOWN_ALBUM`).
- **Qué ocurre:** si el proveedor devuelve `content://`, `folder` es `null`. Todos los audiolibros sin etiqueta de álbum y del mismo artista se agrupan en **un solo libro**.
- **Consecuencia:** `RF-012` («agrupar por libro») se cumple solo cuando hay etiqueta de álbum o URI `file://`.

#### `A-08` · Cobertura de pruebas limitada al dominio puro

- **Severidad:** ALTO · **Confirmado**
- **Dónde:** `src/domain/__tests__` (12 archivos) + 2 benchmarks.
- **Qué ocurre:** hay 0 pruebas de `audio-engine`, `player.store`, `library.store`, repositorios SQLite, `media.service`, `artwork.service`, `tag.service`, `media-widget.service` y componentes. Justo donde viven los hallazgos `C-01`, `A-01` y `A-03`.

#### `A-09` · Cambios críticos sin confirmar en Git

- **Severidad:** ALTO (riesgo de proceso) · **Confirmado**
- **Dónde:** `git status`.
- **Qué ocurre:** `audio-engine.ts`, `player.store.ts`, `app.json`, `package.json` y todo `src/widgets/` + `media-widget.service.ts` están sin commitear. No existe un punto de retorno estable para la refactorización propuesta.

---

### MEDIO

| ID | Hallazgo | Evidencia | Nota |
| --- | --- | --- | --- |
| `M-01` | El permiso de notificaciones se solicita al montar la app, sin contexto | `audio-bridge-inner.tsx:35` | En Android 13+ es mejor pedirlo al iniciar la primera reproducción; denegado una vez, cuesta recuperarlo |
| `M-02` | No hay control de volumen en la app | `player.tsx`, `audio-engine.ts` | Se depende del volumen del sistema; `AudioPlaylist.volume` existe |
| `M-03` | Configuración web (COEP/COOP, `asyncRoutes`, `react-native-web`) sin validación | `app.json:39-45,103-112` | Ruido para un producto Android/iOS |
| `M-04` | Cualquier cambio de ids dispara relectura completa de etiquetas | `library.store.ts:123-138`, `media.service.ts:143-153` | Sin incremental por `MODIFICATION_TIME` |
| `M-05` | No hay CI | ausencia de `.github/` | `tsc`, `jest`, `expo-doctor` dependen de ejecución manual |
| `M-06` | Widget con datos obsoletos tras muerte del proceso | `media-widget.service.ts` | Limitación de la plataforma; debe documentarse en la UI |
| `M-07` | `predictiveBackGestureEnabled: false` | `app.json:21` | Desactiva el gesto predictivo de Android 14+ |
| `M-08` | Accesibilidad parcial | 43 props `accessibility*` | Sin auditoría con TalkBack ni tamaños dinámicos |
| `M-09` | `runtimeVersion.policy: "appVersion"` con versión fija | `app.json:117-119` | Una OTA sin subir `version` no se entrega |
| `M-10` | Sin control de nivel de audio / ecualizador | — | Fuera del SRS; no es un defecto, es alcance futuro |

---

### BAJO

| ID | Hallazgo | Evidencia |
| --- | --- | --- |
| `B-01` | `README.md` afirma que existe `engines` en `package.json` | `README.md:19` |
| `B-02` | Faltan los documentos prometidos (`ARCHITECTURE.md`, `DATABASE.md`, `CODING_STANDARDS.md`, `TESTING.md`) | `docs/requirements/scope.md` |
| `B-03` | El widget usa glifos (`◀◀`, `▶▶`, `▮▮`) en vez de iconos | `widgets/media-widget.tsx` |
| `B-04` | `{...{ target: 'previous' }}` es un rodeo de tipado | `widgets/media-widget.tsx:118` |
| `B-05` | Constantes mágicas (`5000`, `4`, `1500`, `5`) dispersas | `media.service.ts`, `player.store.ts`, `media-widget.service.ts` |
| `B-06` | Duplicación del mapeo de tema (tema de navegación vs tokens) | `_layout.tsx:58-73` |

---

## 4. Resumen numérico

| Severidad | Cantidad | Confirmados | Riesgos |
| --- | --- | --- | --- |
| CRÍTICO | 2 | 2 | 0 |
| ALTO | 9 | 9 | 0 |
| MEDIO | 10 | 8 | 2 |
| BAJO | 6 | 6 | 0 |

**Cumplimiento del SRS:** 20 requisitos (13 RF + 7 RNF) evaluados en 27 filas de verificación → **18 ✅**, **7 🟡**, **2 ❌** (`RNF-002`, `RNF-006`). El producto cumple la práctica totalidad de la funcionalidad declarada; los incumplimientos son de higiene y de robustez, no de alcance.
