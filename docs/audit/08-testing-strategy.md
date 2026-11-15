# 08 · Estrategia de pruebas

**Proyecto:** `mi-music-player`
**Tipo de documento:** estrategia de verificación y plan de cobertura
**Fecha:** 14 de noviembre de 2026

---

## 1. Estado actual (verificado)

| Verificación | Comando | Resultado real |
| --- | --- | --- |
| Tipado | `npx tsc --noEmit` | 0 errores |
| Pruebas | `npx jest` | **14 suites / 111 pruebas aprobadas** |
| Salud del proyecto | `npx expo-doctor` | **20/20** |
| Lint | `npx expo lint` | Script presente; no ejecutado en esta auditoría |

### 1.1 Qué se está probando hoy

Las 14 suites viven en `src/domain/__tests__/` (12) y `src/testing/bench/` (2):

| Suite | Cubre |
| --- | --- |
| `artwork-id3.test.ts`, `artwork-mp4.test.ts` | Extracción de portadas embebidas |
| `tags-id3.test.ts`, `tags-mp4.test.ts` | Parseo de etiquetas |
| `metadata.test.ts` | Normalización de metadatos |
| `audiobooks.test.ts` | Agrupación de audiolibros |
| `auto-playlists.test.ts` | Playlists automáticas |
| `filters.test.ts`, `sorting.test.ts`, `selection.test.ts` | Filtros, orden, selección |
| `reorder.test.ts` | Reordenamiento de colas/playlists |
| `valid-play.test.ts` | Regla de «reproducción válida» para estadísticas |
| `domain.bench.test.ts`, `navigation.bench.test.ts` | Benchmarks |

**Esto es una base sólida, no un accidente.** El dominio es puro y por eso se prueba rápido y sin emulador. Es exactamente la parte que había que probar primero.

### 1.2 Qué **no** se está probando (`A-08`)

| Capa / módulo | Pruebas | Riesgo |
| --- | --- | --- |
| `services/audio-engine.ts` (574 líneas) | **0** | Aquí viven `C-01` y toda la lógica de sesión |
| `stores/player.store.ts` | **0** | `A-01`, seeks, aleatorio |
| `stores/library.store.ts` | **0** | Escaneo, hidratación, carrera de arranque |
| `stores/settings.store.ts` | **0** | Persistencia de ajustes |
| `data/repositories/*` (9) | **0** | SQL, transacciones, migraciones |
| `data/db/migrations.ts` | **0** | Integridad de datos en actualizaciones |
| `services/media.service.ts` | **0** | `C-02`, paginación, `A-07` |
| `services/artwork.service.ts` | **0** | Caché, rutas, limpieza |
| `services/tag.service.ts` | **0** | Lectura binaria concurrente |
| `services/media-widget.service.ts` | **0** | `A-02`, `A-03`, coalescencia |
| `services/error-log.service.ts` | **0** | Tope de 200 filas |
| Componentes (23) | **0** | Interacción, accesibilidad |
| Pantallas (15) | **0** | Flujos completos |

**Conclusión:** la cobertura está donde el código es más fácil de probar, **no donde el riesgo es mayor**. `A-08` no es «faltan pruebas»: es «las pruebas no tocan los dos críticos».

---

## 2. Principios de la estrategia

1. **Probar la lógica, no la plataforma.** Todo lo que pueda ser puro, se hace puro y se prueba sin mocks. El refactor de la FASE 2 (dominio de sesión, `repeat.ts`, `scan-diff.ts`) existe en parte para esto.
2. **Mockear en la frontera, nunca en el medio.** Se sustituyen módulos nativos (`expo-audio`, `expo-media-library`, `expo-widgets`, `expo-file-system`), no los servicios propios.
3. **Un test por hallazgo.** Cada ID corregido (`C-01`, `C-02`, `A-01`…) tiene al menos una prueba que **falla antes** del arreglo y pasa después.
4. **Lo que no se puede probar en Jest se prueba en dispositivo con guion escrito.** No se finge cobertura con mocks que no representan la realidad.
5. **Rápido por defecto.** La suite unitaria debe correr en segundos; los benchmarks y las pruebas de dispositivo van aparte.

---

## 3. Pirámide objetivo

```
        ┌──────────────────────────┐
        │  Manual en dispositivo   │  ~12 escenarios por release
        │  (widget, lock screen,   │
        │   permisos, rendimiento) │
        ├──────────────────────────┤
        │  Integración (Jest)      │  ~25 pruebas
        │  store + servicio + repo │
        ├──────────────────────────┤
        │  Unitarias (Jest)        │  ~180 pruebas
        │  dominio + servicios     │
        └──────────────────────────┘
```

| Nivel | Cantidad objetivo | Tiempo de ejecución | Dónde |
| --- | --- | --- | --- |
| Unitarias | ~180 | < 15 s | `jest` en CI |
| Integración | ~25 | < 60 s | `jest` en CI |
| Dispositivo | 12 escenarios | manual | dev build |
| Benchmarks | 4 | < 30 s | `npm run bench` |

---

## 4. Dobles de prueba (mocks)

### 4.1 `expo-audio`

```ts
// src/testing/mocks/expo-audio.ts
export type FakePlaylistController = {
  failLockScreenTimes: number;   // cuántos intentos fallan
  emitStatus: (s: Partial<PlaybackStatus>) => void;
  emitTrack: (song: Song) => void;
  calls: { method: string; args: unknown[] }[];
};

export function installFakeAudio(): FakePlaylistController;
```

Requisitos del doble:

- `createAudioPlaylist` devuelve un objeto con `play`, `pause`, `seekTo`, `setActiveForLockScreen`, `updateLockScreenMetadata`, `remove`, `addListener`.
- `setActiveForLockScreen` puede configurarse para fallar **N veces** (para `C-01`) o **siempre**.
- Emite `playbackStatusUpdate` y `currentTrackChange` a demanda.
- Registra todas las llamadas para aserciones de orden.

### 4.2 `expo-media-library`

```ts
export function installFakeLibrary(options: {
  totalSongs: number;
  pageSize: number;
  uris?: 'file' | 'content' | 'mixed';
  modificationTimes?: 'present' | 'zero';
}): { queryCalls: number };
```

Sirve para `C-02` (12 000 pistas), `M-04` (segundo escaneo sin relectura) y `A-07` (URIs `content://`).

### 4.3 `expo-sqlite`

Dos opciones, en este orden de preferencia:

1. **Base real en memoria** (`:memory:`), si `expo-sqlite` lo permite en Jest. Es la opción fiel: valida SQL y transacciones de verdad.
2. Si no es viable, un doble que registre sentencias y simule `SELECT`/`INSERT` sobre estructuras en memoria.

Nunca se prueba un repositorio con un mock que devuelve lo que el test quiere oír: eso no valida el SQL.

### 4.4 `expo-widgets` y `expo-file-system`

- `expo-widgets`: doble que captura `updateSnapshot(name, props)` y `addUserInteractionListener`. Permite aserciones sobre el tema y los flags de capacidad (`A-02`, `A-03`).
- `expo-file-system`: doble que devuelve buffers conocidos (ya hay fixtures en `src/testing/fixtures.ts` para etiquetas y portadas).

### 4.5 Regla anti-falsos positivos

Un doble **no debe replicar la implementación**. Si el test pasa porque el mock hace lo que el código espera, no se está probando nada. Cada doble expone **observaciones** (llamadas, emisiones) y **fallos configurables**, no lógica de negocio.

---

## 5. Qué se prueba en cada capa

### 5.1 Dominio (ampliar lo existente)

| Módulo | Casos nuevos |
| --- | --- |
| `playback/repeat.ts` (nuevo) | `next`/`previous` en `none`/`all`/`single`; fin de cola; cola de 1; índice inválido |
| `playback/session.ts` (nuevo) | Serializar/deserializar; filtrado de ids ausentes; modos inválidos; cola vacía |
| `library/scan-diff.ts` (nuevo) | Nuevos, modificados, ausentes, duplicados, listas vacías, `mtime` en 0 |
| `library/audiobooks.ts` (existente) | `content://` con carpeta, sin carpeta, con álbum, sin álbum |
| `library/filters.ts`, `sorting.ts` | Regresión: no deben cambiar de comportamiento |

### 5.2 Servicios

| Servicio | Casos |
| --- | --- |
| `audio/lock-screen.ts` | Falla 1 vez → `active`; falla siempre → `degraded` con N intentos; sin soporte → `unsupported`; `subscribeHealth` notifica; metadatos se refrescan por pista |
| `audio/session.ts` | Transiciones válidas; transición inválida lanza en dev; `recovering` con backoff; restauración en pausa |
| `audio/native-playlist.ts` | Crear/reemplazar/eliminar; orden con aleatorio; no filtra memoria al reemplazar |
| `audio/audio-mode.ts` | Configura una sola vez; permiso denegado no rompe la reproducción |
| `media.service.ts` | 12 000 pistas completas (`C-02`); paginación; URIs `content://` (`A-07`); progreso monótono; fallo de etiqueta no aborta el escaneo |
| `media-widget.service.ts` | Snapshot con tema claro/oscuro; coalescencia de updates; `canGo*`; reconciliación al arrancar |
| `artwork.service.ts` | Caché hit/miss; limpieza de huérfanos; URI inválida devuelve `null` sin lanzar |
| `tag.service.ts` | Concurrencia 4; archivo corrupto devuelve metadatos parciales; no bloquea |
| `error-log.service.ts` | Tope de 200 filas; orden por fecha; no lanza si la base falla |

### 5.3 Stores

| Store | Casos |
| --- | --- |
| `player.store` | `play` con/sin cola; `next`/`previous` en los 3 modos; `seek` optimista y timeout de 1500 ms; `enqueue`/`playNext`; `removeFromQueue` de la pista actual; `clearQueue`; restauración sin auto-play (`A-01`) |
| `library.store` | `scanPromise` no duplica escaneos; `hydratePromise` idempotente; error de permiso produce aviso; segundo escaneo no relee etiquetas |
| `settings.store` | Persistencia y valores por defecto; cambio de tema |
| `notice.store` | Alta, deduplicación por `code`, descarte, acción ejecutada una vez |

### 5.4 Repositorios

| Repositorio | Casos |
| --- | --- |
| `song.repository` | `upsertBatch` 1000 filas; `findByIds` > 900 ids en lotes; `markMissing`; consultas excluyen ausentes |
| `playback-session.repository` | Guardar/cargar/limpiar; fila única; payload corrupto no rompe el arranque |
| `playlist.repository`, `favorite.repository`, `history.repository` | Integridad referencial; cascadas al borrar; orden estable |
| `maintenance.repository` | Limpieza no borra datos referenciados |
| `migrations` | Base vN → vN+1 conserva datos; migración idempotente; fallo deja versión anterior |

### 5.5 Componentes (solo si el tooling lo permite)

Con `@testing-library/react-native`, prioridad mínima:

1. `song-row`: pulsación reproduce, menú abre, accesibilidad presente.
2. `seek-bar`: arrastre actualiza sin saltos.
3. `notice-banner`: renderiza severidad y acción.
4. `empty-state`: distingue vacío real de error.

Si la librería no es compatible con React 19.3 / RN 0.88, **no se fuerza**: se documenta y se cubre con el guion manual.

---

## 6. Recetas de prueba por hallazgo

Cada fila es una prueba que **debe fallar con el código actual** y pasar tras el arreglo. Es la definición operativa de «corregido».

| ID | Prueba | Nivel | Falla hoy porque |
| --- | --- | --- | --- |
| `C-01` | `setActiveForLockScreen` falla 1 vez y luego funciona → estado final `active` | Servicio | Hoy queda `unsupported`/desactivado para siempre |
| `C-01` | Falla siempre → estado `degraded`, N intentos, `subscribeHealth` invocado | Servicio | Hoy no hay estado ni notificación |
| `C-02` | 12 000 pistas → 12 000 resultados y `truncated === false` | Servicio | Hoy devuelve 5000 |
| `C-02` | Dos escaneos con truncamiento no dan «coincide» | Store | Hoy `libraryMatchesDevice` puede engañarse |
| `A-01` | Guardar sesión, resetear módulos, hidratar → cola/pista/posición/modos, `isPlaying === false` | Integración | Hoy no existe persistencia |
| `A-02` | Publicar snapshot en tema claro y oscuro → props de tema distintos y sin `#7C5CFF` | Servicio | Hoy el color es fijo |
| `A-03` | Sin proceso vivo → `canGoPrevious === false` y no se renderiza el botón | Contrato/servicio | Hoy se renderiza inerte |
| `A-04` | Permiso denegado → `notice.store` contiene `MEDIA_PERMISSION_DENIED` | Integración | Hoy solo hay fila en `error_logs` |
| `A-07` | URI `content://` sin álbum → un libro por carpeta | Dominio | Hoy todos caen en el mismo libro |
| `M-04` | Segundo escaneo sin cambios → 0 lecturas de etiquetas | Integración | Hoy relee todo |
| `M-09` | `runtimeVersion` coherente con `version` ante OTA | Config (test de `app.json`) | Hoy queda a criterio manual |
| `UI-12` | Tocar el contenido de la hoja no la cierra | Componente/dispositivo | Riesgo sin verificar |

---

## 7. Lo que **no** se puede probar en Jest

Se declara explícitamente para no crear una falsa sensación de cobertura:

| Comportamiento | Por qué | Cómo se verifica |
| --- | --- | --- |
| Reproducción real en segundo plano | Requiere sesión de medios nativa | Dispositivo, 10 min en background, `adb logcat` |
| Controles en pantalla de bloqueo | UI del sistema | Dispositivo, bloqueo/desbloqueo |
| Notificación con metadatos y portada | Render nativo | Dispositivo, captura |
| Widget en pantalla de inicio | Runtime aislado + Glance | Dispositivo, app cerrada, tema claro/oscuro |
| Permisos en Android 13/14/15 | Diálogos del sistema | Dispositivo, instalación limpia por versión |
| Escaneo de 12 000 archivos reales | Biblioteca física | Dispositivo con almacenamiento sembrado |
| Migración sobre base real de usuario | Datos reales | Actualización desde build anterior |
| Consumo de batería y memoria | Sistema | `adb shell dumpsys batterystats`, Android Studio Profiler |

---

## 8. Guion de prueba manual (release)

12 escenarios, obligatorios antes de publicar. Se documentan con captura y resultado.

| # | Escenario | Resultado esperado |
| --- | --- | --- |
| 1 | Instalación limpia, primer arranque | Permiso de audio solicitado con contexto; biblioteca escaneada con progreso |
| 2 | Reproducir una canción | Suena, mini-player visible, metadatos correctos |
| 3 | Bloquear pantalla 10 min | La música continúa; controles funcionan |
| 4 | Notificación | Título, artista, portada, play/pausa, siguiente |
| 5 | Widget con app cerrada | Muestra estado; botón central responde; anterior/siguiente ausentes o funcionales |
| 6 | Tema claro y oscuro | Toda la UI y el widget coherentes; sin destello en splash |
| 7 | Matar la app y reabrir | Cola, pista, posición y modos restaurados, **en pausa** |
| 8 | Borrar una canción fuera de la app y refrescar | Desaparece de la lista; favorito se conserva si vuelve |
| 9 | Audiolibros | Agrupación correcta por libro |
| 10 | Fuente del sistema al 200 % | Sin recortes ni solapamientos |
| 11 | TalkBack | Flujo completo: canción → pausa → siguiente → playlist |
| 12 | Actualización desde la versión anterior | Datos, playlists, favoritos e historial intactos |

---

## 9. Integración continua

No existe CI hoy (`M-05`). Propuesta para FASE 7:

```yaml
# .github/workflows/ci.yml (propuesto)
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npx expo lint
      - run: npx jest --coverage
      - run: npx expo-doctor
```

Notas:

- **Node en CI ≠ Node local.** Local es v26.13.1; CI debe fijar una versión LTS soportada por el SDK (22 LTS es la apuesta segura) para no introducir diferencias.
- `expo-doctor` puede requerir red; si falla por rate limit, se ejecuta en un job separado no bloqueante y se revisa semanalmente.
- La cobertura se publica como artefacto, no como badge decorativo.

### Umbrales de cobertura propuestos

| Ámbito | Objetivo | Justificación |
| --- | --- | --- |
| `src/domain` | ≥ 90 % líneas | Ya está cerca; es puro y barato |
| `src/services` | ≥ 70 % | Contiene los dos críticos |
| `src/stores` | ≥ 80 % | Orquestan todo |
| `src/data/repositories` | ≥ 75 % | SQL y migraciones |
| Global | ≥ 65 % | Realista para una app con UI nativa |

Los umbrales se activan en `jest.config` **después** de escribir las pruebas, no antes: un umbral que se salta con `istanbul ignore` no vale nada.

---

## 10. Benchmarks y rendimiento

Ya existen `domain.bench.test.ts` y `navigation.bench.test.ts`. Se amplían con:

| Benchmark | Métrica | Umbral de alerta |
| --- | --- | --- |
| Diff de 12 000 ids | ms | > 100 ms |
| Render de 500 filas memoizadas | ms | > 16 ms por frame en scroll |
| Escritura de sesión (throttle) | escrituras / 10 s | > 3 |
| Serialización de cola de 5 000 | ms | > 20 ms |
| Arranque en frío con 12 000 pistas | s | > 3 s sin progreso visible |

Los números se registran en `docs/TESTING.md` con fecha y dispositivo, para detectar regresiones entre fases.

---

## 11. Riesgos de la estrategia

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Mocks que no representan `expo-audio` real | Alto: pruebas verdes, app rota | Dobles mínimos + guion manual obligatorio por release |
| `expo-sqlite` no funciona en Jest | Medio | Probar con base en memoria; si no, doble de sentencias + prueba manual de migración |
| Testing Library incompatible con React 19.3 | Medio | Verificar antes de instalar; no bloquear la fase |
| Cobertura alta sin cubrir los críticos | Alto | La tabla de §6 manda sobre el porcentaje |
| CI lento por `expo-doctor` | Bajo | Job separado, no bloqueante |
| Pruebas dependientes de tiempo (`setTimeout`, backoff) | Medio | `jest.useFakeTimers()` y relojes controlados; nunca `sleep` real |

---

## 12. Criterios de salida de la estrategia

1. Existe una prueba que **falla con el código actual** para cada uno de: `C-01`, `C-02`, `A-01`, `A-02`, `A-03`, `A-04`, `A-07`.
2. La suite completa corre en < 60 s en CI.
3. Cobertura global ≥ 65 %, servicios ≥ 70 %, stores ≥ 80 %, dominio ≥ 90 %.
4. CI verde en un push limpio con `tsc`, `lint`, `jest --coverage` y `expo-doctor`.
5. `docs/TESTING.md` publicado con: cómo correr, qué se mockea, qué no se puede probar, guion manual de 12 escenarios y benchmarks con fecha.
6. Cada release tiene el guion manual ejecutado y firmado, con capturas de los escenarios 3, 5, 6 y 7 (los que Jest no puede cubrir).

---

**Documentos relacionados:** `03-functional-audit.md` (`A-08` y el resto de hallazgos), `05-architecture-proposal.md` (módulos puros que hacen testeable el motor), `06-development-roadmap.md` (FASE 7), `07-dependencies-and-tools.md` (herramientas disponibles y limitaciones).
