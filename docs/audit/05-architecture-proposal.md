# 05 · Propuesta de arquitectura

**Proyecto:** `mi-music-player`
**Tipo de documento:** propuesta de arquitectura objetivo y plan de migración
**Fecha:** 14 de noviembre de 2026
**Restricción respetada:** este documento **no implementa nada**. No se modificó ningún archivo de la aplicación, ni dependencias, ni configuración. Todo lo aquí descrito es diseño y justificación.

---

## 1. Resumen de la propuesta

La arquitectura actual **no está mal**: es una arquitectura por capas real (dominio puro, servicios de plataforma, repositorios SQLite, stores Zustand, rutas Expo Router) y esa es la decisión correcta. El problema no es el dibujo de las capas, es que **el motor de reproducción concentra cinco responsabilidades críticas en un solo módulo de 574 líneas** y que **los fallos de plataforma no tienen representación en el modelo de estado**.

La propuesta, por tanto, es **conservadora y quirúrgica**:

1. **Mantener** las capas, el dominio puro, el patrón repositorio y Zustand.
2. **Dividir** `src/services/audio-engine.ts` en cuatro piezas con una frontera explícita (`native adapter` / `session state machine` / `lock-screen supervisor` / `audio mode`).
3. **Añadir** un módulo de capacidades del entorno (`capabilities.ts`) para que la UI pueda decidir qué prometer en vez de fallar en silencio.
4. **Añadir** persistencia de la sesión de reproducción como repositorio de primera clase, no como un `JSON.stringify` suelto en ajustes.
5. **Convertir los errores en datos** consumibles por la UI (un canal único de avisos), en lugar de solo filas de `error_logs`.
6. **Quitar el tope de 5000 pistas** y sustituirlo por un pipeline de escaneo por fases con progreso observable.
7. **Hacer del widget un consumidor de props resueltas**, incluido el tema, respetando que su runtime está aislado y no puede importar constantes de la app.

Nada de esto requiere cambiar de framework, de gestor de estado, de base de datos ni de motor de audio. **No se propone reescribir.** Se propone **separar responsabilidades, hacer explícitos los estados de fallo y persistir lo que el usuario espera encontrar al volver**.

---

## 2. Diagnóstico arquitectónico actual

### 2.1 Lo que está bien y debe conservarse

| Decisión actual | Por qué es correcta |
| --- | --- |
| Dominio puro en `src/domain/` sin imports de React Native | Permite 111 pruebas rápidas sin emulador; es la razón por la que la base está verde. |
| `AudioPlaylist` única fuera del ciclo de React | La cola sobrevive a la navegación y el sistema controla la sesión de medios. Es el patrón correcto para `expo-audio` SDK 58. |
| `playback-progress` como store aislado | Evita re-render de pantallas completas cada 500 ms. Decisión de rendimiento acertada. |
| Repositorios por agregado + migraciones versionadas | Escalable, testeable, sin ORM innecesario. |
| `expo-router` con rutas tipadas | Navegación declarativa, deep links gratis, sin `react-navigation` manual. |
| `media-widget.contract.ts` separado del runtime del widget | Resuelve el problema real de que el widget no puede importar módulos de la app. Muy bien pensado. |
| Stores con `scanPromise`/`hydratePromise` | Evita carreras de arranque duplicadas. |

### 2.2 Problemas estructurales (no de estilo)

**P1 · `audio-engine.ts` es cinco módulos disfrazados de uno.**
Contiene, en el mismo archivo y con estado de módulo compartido:

- ciclo de vida de `AudioPlaylist` (`create`, `remove`, reconstrucción de cola);
- orden de reproducción y aleatorio (`order`, `startQueue`, `rebuildQueue`);
- registro en pantalla de bloqueo y notificación (`setActiveForLockScreen`, metadatos);
- configuración de sesión de audio (`setAudioModeAsync`) y permisos de notificación;
- sondeo de estado cada 500 ms y fan-out a oyentes.

Consecuencia directa: **`C-01` es un bug estructural, no un descuido**. El flag `lockScreenControlsSupported` es un booleano global que mezcla «¿la plataforma lo soporta?» con «¿falló esta vez?», y por eso un fallo transitorio se vuelve permanente. Mientras las cinco responsabilidades vivan juntas, cada arreglo nuevo arriesga romper otra.

**P2 · Los fallos no son parte del modelo.**
`logError()` escribe en `error_logs`, pero ni `player.store`, ni `library.store`, ni la UI tienen un tipo que represente «esto está degradado». `A-04` no se arregla con más `Alert`: se arregla con **estado de capacidad** y **avisos tipados**.

**P3 · La sesión de reproducción no tiene dueño persistente.**
La cola canónica vive en memoria (`player.store`), el orden real vive en memoria (`audio-engine.order`), la posición vive en `playback-progress`, y el historial va a SQLite. Tres verdades y ninguna persistida como sesión. Eso hace `A-01` inevitable.

**P4 · El límite de 5000 pistas está en la capa de servicio, no en la de presentación.**
`C-02` no es «un número mal elegido»: es que el **contrato de `loadDeviceAudio` miente**. Devuelve un array que parece completo y no lo es. Un límite de rendimiento es legítimo; un límite silencioso no.

**P5 · El widget depende de la app viva sin decirlo.**
`onClick={() => undefined}` en anterior/siguiente (`A-03`) no es un TODO: es la consecuencia de que el widget delega en `addUserInteractionListener`, que solo existe mientras el proceso JS está vivo. El contrato del widget debe declarar **qué puede hacer por sí mismo** y **qué no**, y la UI debe reflejarlo.

---

## 3. Reglas de dependencia (contrato arquitectónico)

Estas reglas ya se cumplen casi por completo; se hacen explícitas para que el refactor no las rompa.

```
app/ (rutas)  ──►  components/  ──►  stores/  ──►  services/  ──►  data/  ──►  db
     │                                  │              │
     └──────────────► domain/ ◄─────────┴──────────────┘
```

| Capa | Puede importar | Nunca puede importar |
| --- | --- | --- |
| `domain/` | solo TypeScript puro | React, React Native, Expo, stores, servicios |
| `data/` | `db/`, `types/`, `domain/` | React, stores, `services/` |
| `services/` | `domain/`, `data/`, `types/`, módulos Expo | React, componentes, rutas |
| `stores/` | `services/`, `data/`, `domain/`, `types/` | componentes, rutas |
| `components/` | `stores/`, `hooks/`, `domain/`, `constants/`, `utils/` | `data/db` directamente |
| `app/` | todo lo anterior | nada de `data/db` directamente |
| `widgets/` | **solo** `widgets/media-widget.contract.ts` | cualquier módulo de la app |

**Regla nueva (propuesta):** ningún archivo de `src/app/` ni de `src/components/` puede importar `expo-audio`, `expo-media-library` ni `expo-widgets` directamente. Toda dependencia de plataforma pasa por `services/`. Hoy se cumple; conviene blindarlo con una regla de ESLint (`no-restricted-imports`) en la FASE 2.

---

## 4. Estructura objetivo

Cambios marcados: **(nuevo)**, **(dividido)**, **(movido)**. Todo lo no marcado se queda donde está.

```
src/
├── app/                        # sin cambios de estructura
├── components/                 # sin cambios de estructura
│   └── notice-banner.tsx       (nuevo)
├── constants/
│   └── theme.ts                # + export de paleta "resuelta" para el widget
├── data/
│   ├── db/migrations.ts        # + migración de playback_sessions
│   └── repositories/
│       └── playback-session.repository.ts   (nuevo)
├── domain/
│   └── playback/
│       ├── valid-play.ts
│       ├── repeat.ts           (nuevo: resolución de siguiente/anterior/loop)
│       └── session.ts          (nuevo: forma serializable de la sesión)
├── services/
│   ├── audio/
│   │   ├── native-playlist.ts  (nuevo)  ← adaptador fino de expo-audio
│   │   ├── audio-mode.ts       (nuevo)  ← setAudioModeAsync + permisos
│   │   ├── lock-screen.ts      (nuevo)  ← registro y supervisión de lock screen
│   │   ├── session.ts          (nuevo)  ← máquina de estados de la sesión
│   │   └── index.ts            (nuevo)  ← fachada con la API pública actual
│   ├── audio-engine.ts         (dividido → re-export temporal, luego eliminado)
│   ├── capabilities.ts         (nuevo)
│   ├── media.service.ts        # + escaneo por páginas y progreso
│   ├── media-widget.service.ts # + props de tema y capacidades
│   └── ...
├── stores/
│   ├── player.store.ts         # + restaurar sesión, + volumen
│   ├── notice.store.ts         (nuevo)
│   └── ...
└── widgets/
    ├── media-widget.contract.ts # + theme + canGoNext/canGoPrevious
    └── media-widget.tsx         # props resueltas, sin colores fijos
```

**Compatibilidad durante la migración:** `audio-engine.ts` se convierte en un barril de re-exportación (`export * from '@/services/audio'`) para que `player.store.ts` y `audio-bridge-inner.tsx` sigan funcionando mientras se mueve el código. Así cada paso es compilable y reversible (`A-09` exige un punto de retorno estable, por eso la FASE 1 empieza commiteando).

---

## 5. Refactor del motor de audio (`C-01`)

### 5.1 Reparto de responsabilidades

| Módulo | Responsabilidad única | Estado que posee |
| --- | --- | --- |
| `native-playlist.ts` | Crear, poblar, reemplazar y destruir la `AudioPlaylist`; suscribirse a eventos nativos. | `playlist`, `subscriptions`, `order` |
| `audio-mode.ts` | `setAudioModeAsync` una vez, permisos de notificación, política de reintento. | `audioModeConfigured` |
| `lock-screen.ts` | Registrar la playlist en la sesión de medios, actualizar metadatos, **supervisar salud** y reintentar. | `registration: 'unknown' \| 'active' \| 'degraded' \| 'unsupported'` |
| `session.ts` | Máquina de estados de reproducción: qué debe sonar, en qué índice, con qué loop/shuffle; restauración y persistencia. | `sessionState` |
| `index.ts` | Fachada: la API pública que hoy consume `player.store`. | — |

### 5.2 Máquina de estados de la sesión

Estados explícitos, porque los implícitos son los que producen `C-01`:

```
idle ──start──► preparing ──ready──► playing ⇄ paused
                    │                   │
                    └──error──► failed ◄┘
                                  │
                            recovering ──► ready | failed
```

Reglas:

- `preparing` es observable por la UI (spinner real, no pantalla vacía).
- `failed` **no** es terminal: `recovering` reintenta con backoff (1 s, 3 s, 10 s) y luego pasa la sesión a `degraded` si el fallo es de plataforma.
- `degraded` significa «reproduce, pero sin X» y **se muestra al usuario** (`A-04`), no se silencia.

### 5.3 Contrato propuesto de `lock-screen.ts`

```ts
export type LockScreenRegistration =
  | 'unknown'   // aún no se intentó
  | 'active'    // registrada y confirmada
  | 'degraded'  // falló N veces; reproducción sin controles del sistema
  | 'unsupported'; // la plataforma/módulo no lo ofrece (p. ej. Expo Go)

export type LockScreenHealth = {
  registration: LockScreenRegistration;
  lastError: string | null;
  attempts: number;
};

export function register(playlist: AudioPlaylist): Promise<LockScreenHealth>;
export function refreshMetadata(meta: AudioMetadata): Promise<void>;
export function unregister(): Promise<void>;
export function subscribeHealth(listener: (h: LockScreenHealth) => void): () => void;
```

**Cambio semántico clave respecto a hoy:** el flag deja de ser un booleano «soportado / no soportado» que se apaga para siempre. Pasa a ser un estado con **reintento acotado** y con **notificación a la UI**. Un fallo transitorio de `setActiveForLockScreen` ya no degrada la app hasta reiniciarla.

**Por qué no basta con «quitar el `catch`»:** si el error es determinista (dispositivo sin soporte, Expo Go, política del fabricante), reintentar en cada pista produce ruido y logs. La solución correcta es **reintentar con backoff y luego declarar `degraded` de forma visible**.

### 5.4 Contrato de la fachada

La API pública se mantiene **idéntica** a la actual (`startQueue`, `togglePlayback`, `seekTo`, `nextTrack`, …) para no tocar `player.store` en la FASE 2. Se añade, sin romper:

```ts
export function getCapabilities(): PlaybackCapabilities;
export function subscribeSessionState(listener: (s: SessionState) => void): () => void;
```

---

## 6. Capacidades del entorno (`capabilities.ts`)

**Problema que resuelve:** hoy la app descubre que algo no funciona **cuando falla** (`A-04`). Debe saberlo **antes** de pintar la UI.

```ts
export type Capability =
  | 'playback.background'      // lock screen registrable
  | 'playback.lockScreen'      // controles del sistema
  | 'playback.notifications'   // permiso concedido
  | 'mediaLibrary.read'        // permiso concedido
  | 'widget.homeScreen'        // expo-widgets disponible y configurado
  | 'library.incrementalScan'  // metadatos de modificación disponibles
  | 'library.albumFolderGrouping'; // URIs file:// vs content://
```

Reglas de diseño:

- `capabilities` **no** hace llamadas de red ni escaneos: solo consulta `Platform`, `Constants.executionEnvironment`, resultados de permisos ya concedidos y flags de build.
- Es **reactivo**: expone `subscribe()` porque los permisos cambian en tiempo de ejecución.
- La UI consume capacidades para **degradar con honestidad**: si `playback.lockScreen === false`, la pantalla de reproducción muestra «Controles del sistema no disponibles en este dispositivo» en vez de prometerlos.
- Se alimenta del `LockScreenHealth` de §5.3 y del estado de permisos, de modo que **una sola fuente de verdad** decide qué se muestra.

---

## 7. Persistencia de la sesión de reproducción (`A-01`)

### 7.1 Modelo

```ts
// domain/playback/session.ts — puro, serializable, testeable sin Expo
export type PlaybackSession = {
  queueSongIds: number[];
  currentSongId: number | null;
  positionSeconds: number;
  repeatMode: 'none' | 'all' | 'single';
  shuffle: boolean;
  updatedAt: number;
};
```

### 7.2 Tabla

```sql
CREATE TABLE IF NOT EXISTS playback_sessions (
  id           INTEGER PRIMARY KEY CHECK (id = 1),  -- sesión única
  payload      TEXT    NOT NULL,                    -- JSON de PlaybackSession
  updated_at   INTEGER NOT NULL
);
```

Una sola fila (`id = 1`): la app tiene una sesión de reproducción, no N. Guardar el payload como JSON es deliberado: la cola es un array ordenado con posibles duplicados, y normalizarla en una tabla hija añadiría joins y migraciones sin beneficio real. **Lo que no se hace** es guardar `Song` completos: solo ids. Los `Song` se rehidratan desde `song.repository`, que ya es la fuente de verdad de la biblioteca.

### 7.3 Política de escritura

| Evento | Escritura |
| --- | --- |
| Cambio de pista | inmediata |
| Cambio de loop/aleatorio | inmediata |
| Pausa / reanudación | inmediata |
| Cambio de posición | **throttle 5 s** (y al pausar, al salir de la app y al terminar la pista) |
| Cambio de cola (añadir, quitar, reordenar) | debounce 1 s |

Sin throttle, la posición cada 500 ms escribiría 7200 filas/hora. Con throttle, la pérdida máxima al morir el proceso es de 5 segundos de posición.

### 7.4 Restauración

Al hidratar:

1. Leer `playback_sessions`.
2. Filtrar ids que ya no existan en la biblioteca (los archivos pueden haberse borrado).
3. Reconstruir la cola en `player.store` **sin auto-play**.
4. Cargar la pista y la posición en el motor **en pausa**, con la barra ya en la posición correcta.
5. Si la lista queda vacía tras el filtrado, limpiar la fila y arrancar en `idle`.

**Decisión explícita:** no se reanuda la reproducción automáticamente. Reanudar audio sin consentimiento es una sorpresa desagradable en Android (y un riesgo de revisión en Play). Se restaura el *estado*, no la *acción*.

**Dependencia:** `song.repository` necesita un método `findByIds(ids)` eficiente. Si no existe, se añade con `WHERE id IN (…)` por lotes de ≤ 900 para no superar el límite de variables de SQLite.

---

## 8. Escaneo de biblioteca sin tope (`C-02`, `M-04`)

### 8.1 Pipeline por fases

```
1. enumerate     → ids + (mtime si está disponible)          páginas de 1000
2. diff          → nuevos / modificados / ausentes           dominio puro
3. hydrate       → metadatos + etiquetas de los que cambian   concurrencia 4
4. persist       → upsert por lotes en una transacción        lotes de 200
5. prune         → marcar ausentes (no borrar en duro)        transacción
6. report        → ScanReport a library.store y a la UI
```

```ts
export type ScanPhase = 'enumerate' | 'diff' | 'hydrate' | 'persist' | 'prune' | 'done';

export type ScanProgress = {
  phase: ScanPhase;
  processed: number;
  total: number | null;   // null mientras se enumera
  added: number;
  updated: number;
  removed: number;
};

export type ScanReport = {
  added: number;
  updated: number;
  removed: number;
  truncated: false;       // ya no existe el concepto de truncado silencioso
  failedTags: number;
};
```

### 8.2 Decisiones

- **Se elimina `MAX_SONGS` como tope silencioso.** La paginación por cursor acota memoria, no el resultado. El coste es tiempo, y el tiempo se comunica con `ScanProgress`.
- **Incremental por `modificationTime`** cuando el proveedor lo devuelve. Si no lo devuelve (o devuelve `0`), se cae a relectura completa de etiquetas, y `capabilities.library.incrementalScan` lo declara para que la UI avise de que el primer escaneo será más lento.
- **`ScanProgress` es observable** y alimenta un indicador real en la pantalla de biblioteca (`UI-06`), no un spinner indeterminado.
- **`prune` marca, no borra.** Borrar canciones elimina favoritos e historial por FK en cascada; marcar `is_missing` conserva la intención del usuario si el archivo vuelve.
- **`folderFromUri` (`A-07`)** se sustituye por una resolución en dos pasos: si la URI es `file://`, se usa la carpeta; si es `content://`, se consulta el nombre de archivo/ruta relativa que exponga `expo-media-library` y, si no hay ninguno, se agrupa por `album` antes de caer al `UNKNOWN_ALBUM`. Y `capabilities.library.albumFolderGrouping` lo declara.

### 8.3 Dónde vive cada cosa

| Pieza | Capa |
| --- | --- |
| `diff` de ids | `domain/library/scan-diff.ts` (puro, testeable) |
| paginación y lectura de metadatos | `services/media.service.ts` |
| persistencia por lotes | `data/repositories/song.repository.ts` |
| orquestación y progreso | `stores/library.store.ts` |

---

## 9. Contrato del widget (`A-02`, `A-03`, `UI-01`)

### 9.1 Props resueltas (el widget no importa nada de la app)

```ts
export type MediaWidgetTheme = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentText: string;
};

export type MediaWidgetProps = {
  // ...campos actuales...
  theme: MediaWidgetTheme;      // resuelto por la app según el tema activo
  canGoPrevious: boolean;       // false si no hay proceso vivo
  canGoNext: boolean;
  statusLabel: string;          // "Reproduciendo" / "En pausa" / "Sin reproducción"
};
```

- `theme` se resuelve en `media-widget.service.ts` desde `Colors.light`/`Colors.dark` **en el momento de publicar el snapshot**. Se actualiza al cambiar de tema.
- `canGoPrevious`/`canGoNext` permiten **no pintar** botones que no pueden funcionar (`A-03`). Es honesto y elimina el bug percibido.
- `statusLabel` da información a `accessibilityLabel` y a un lector de pantalla del widget.

### 9.2 Lo que el widget no puede hacer (y hay que aceptar)

| Limitación | Realidad | Mitigación |
| --- | --- | --- |
| Anterior/siguiente con app cerrada | El runtime aislado solo ejecuta `onClick`; la lógica real requiere JS vivo. | Ocultar botones (`canGo*`) y actualizar el snapshot en cada cambio de pista. |
| Colores del sistema | Solo `environment.colorScheme` en Android. | El tema se publica por props, no se lee del sistema. |
| Datos tras muerte del proceso | El snapshot queda congelado. | Mostrar `statusLabel` claro; al abrir la app, reconciliar. |

Se documenta en `README` y en Ajustes → Diagnóstico, para que la limitación no se perciba como avería (`M-06`).

---

## 10. Canal de avisos al usuario (`A-04`)

### 10.1 Store de avisos

```ts
export type NoticeSeverity = 'info' | 'warning' | 'error';
export type Notice = {
  id: string;
  severity: NoticeSeverity;
  code: NoticeCode;          // unión discriminada, no string libre
  title: string;
  message: string;
  action?: { label: string; run: () => void };
  dismissible: boolean;
};
```

`NoticeCode` cubre los fallos que hoy son invisibles: `MEDIA_PERMISSION_DENIED`, `SCAN_FAILED`, `LOCK_SCREEN_DEGRADED`, `WIDGET_UNAVAILABLE`, `ARTWORK_UNRESOLVED`, `DB_MIGRATION_FAILED`.

### 10.2 Reglas

- **Un solo componente** (`notice-banner`) renderizado en el layout raíz; nada de `Alert` dispersos.
- **Deduplicación por `code`**: el mismo aviso no se apila.
- **El aviso no sustituye al log**: `logError` sigue escribiendo en `error_logs` para diagnóstico. El aviso es la cara visible; el log es la traza.
- **Errores esperados no son errores**: `LOCK_SCREEN_DEGRADED` en Expo Go es `info`, no `error`.
- **Estados vacíos que explican la causa**: «No hay canciones» y «No se pudo leer la biblioteca» deben ser pantallas distintas (`UI-02`).

---

## 11. Matriz de propiedad del estado

Una sola fuente de verdad por dato, explícita:

| Dato | Dueño | Persistido en | Consumidores |
| --- | --- | --- | --- |
| Biblioteca (canciones) | `library.store` | SQLite `songs` | pantallas, reproductor |
| Cola y pista actual | `player.store` | `playback_sessions` | reproductor, mini-player, widget |
| Posición/duración | `playback-progress` | `playback_sessions` (throttle) | seek bar, mini-player |
| Orden real (aleatorio) | `services/audio/session.ts` | `playback_sessions` (ids) | motor, store |
| Modo loop/shuffle | `player.store` | `playback_sessions` | reproductor, motor |
| Ajustes | `settings.store` | SQLite `settings` | toda la app |
| Salud de plataforma | `services/audio/lock-screen.ts` + `capabilities` | no persistido (se recalcula) | UI, avisos |
| Errores | `error-log.service` | SQLite `error_logs` | diagnóstico, avisos |
| Avisos activos | `notice.store` | no persistido | layout raíz |

**Regla:** ningún componente lee `playback-progress` para tomar decisiones de negocio; solo para pintar. Cualquier decisión (siguiente pista, guardar sesión) pasa por `player.store` o por el dominio.

---

## 12. Plan de migración (sin big bang)

Cada paso deja el árbol compilando y con las 111 pruebas verdes. El detalle de fases está en `06-development-roadmap.md`.

| Paso | Acción | Riesgo | Reversible |
| --- | --- | --- | --- |
| 0 | Commit del estado actual (`A-09`) | ninguno | sí (git) |
| 1 | Extraer `audio-mode.ts` (sin cambiar comportamiento) | bajo | sí |
| 2 | Extraer `native-playlist.ts` y dejar fachada | medio | sí |
| 3 | Extraer `lock-screen.ts` con backoff y salud | medio | sí |
| 4 | Añadir `capabilities.ts` y consumirlo en UI | bajo | sí |
| 5 | `notice.store` + banner + estados vacíos | bajo | sí |
| 6 | Migración SQLite + `playback-session.repository` | medio (datos) | sí (migración aditiva) |
| 7 | Escaneo por fases + quitar `MAX_SONGS` | alto (rendimiento) | sí (flag) |
| 8 | Widget con props de tema y capacidades | bajo | sí |
| 9 | Limpieza de dependencias y permisos (`A-05`, `A-06`) | bajo | sí |

**Estrategia de rollback:** los pasos 1–8 se protegen con un interruptor de comportamiento en `settings` solo si el paso 7 (escaneo) se implementa antes de tener pruebas de integración. El resto es refactor con la misma API pública, por lo que revertir es `git revert`.

---

## 13. Trade-offs y cosas que NO se proponen

| Tentación | Por qué se rechaza |
| --- | --- |
| Migrar a `react-native-track-player` | Requiere development build obligatorio, permiso de foreground service propio y reescribe todo el motor. `expo-audio` ya cubre el SRS. Coste alto, beneficio dudoso. |
| Introducir Redux/RTK Query | Zustand ya está bien usado y es más simple. No hay problema que resolver. |
| Añadir un ORM (Drizzle/Prisma) | 9 repositorios SQL explícitos y probados; un ORM añade toolchain y migraciones opacas. |
| Mover todo el estado a SQLite | La posición a 500 ms nunca debe tocar disco. |
| Reestructurar `src/app/` | La navegación funciona y las rutas tipadas están verdes. |
| Sustituir el lector ID3 propio | Funciona, está probado (12 suites de dominio) y evita una dependencia nativa. |
| Persistir `Song` completos en la sesión | Duplica la verdad y se desincroniza con `songs`. |
| Auto-play al restaurar | Sorpresa para el usuario y riesgo de política en Play. |

**Complejidad añadida neta:** ~4 módulos nuevos en `services/audio/`, 1 repositorio, 1 store de avisos, 1 tabla, 1 migración y 1 componente. Es un aumento moderado y localizado, no una reescritura.

---

## 14. Decisiones registradas (ADR abreviado)

| # | Decisión | Alternativa descartada | Motivo |
| --- | --- | --- | --- |
| D1 | Mantener arquitectura por capas actual | Clean Architecture con casos de uso | La separación actual ya aísla dominio; añadir capa de use cases sería ceremonia sin beneficio. |
| D2 | Dividir `audio-engine` en 4 módulos + fachada | Dejarlo y parchear `withLockScreenGuard` | El parche arregla `C-01` pero deja la causa estructural. La fachada mantiene compatibilidad. |
| D3 | Lock screen con backoff y estado `degraded` visible | Reintentar siempre / desactivar siempre | Evita tanto el silencio actual como el ruido de reintentos infinitos. |
| D4 | Persistir sesión como JSON de ids en una fila | Tabla normalizada de cola | La cola es efímera y ordenada; normalizarla añade joins y migraciones sin ganancia. |
| D5 | No auto-play al restaurar | Reanudar reproducción | Consentimiento del usuario y política de Play. |
| D6 | Quitar el tope de 5000 y paginar | Subir el tope a 50 000 | Un tope distinto sigue siendo silencioso; paginar resuelve el contrato. |
| D7 | `prune` marca en vez de borrar | Borrado en cascada | Preserva favoritos, historial y playlists si el archivo vuelve. |
| D8 | Tema del widget por props | Importar `theme.ts` en el widget | El runtime del widget está aislado; importar constantes no es viable. |
| D9 | Avisos tipados + banner único | `Alert` puntuales | Consistencia, deduplicación y testabilidad. |
| D10 | Mantener `expo-audio` | Migrar a track-player | Cubre el SRS y evita salir de Expo Go en el flujo de desarrollo. |

---

## 15. Criterios de aceptación de la arquitectura objetivo

La propuesta se considera cumplida cuando:

1. `src/services/audio-engine.ts` ya no existe o es un barril de re-exportación de ≤ 10 líneas.
2. Ningún archivo de `services/audio/` supera ~200 líneas y cada uno tiene una responsabilidad nombrada.
3. `C-01` es reproducible como prueba: **un fallo simulado de `setActiveForLockScreen` no deja el estado en `unsupported` permanente**; tras el backoff queda `degraded` y emite aviso.
4. `C-02` no puede reproducirse: no existe ningún `limit(5000)` en rutas de datos, y `ScanProgress` reporta el total real.
5. Matar el proceso y reabrir restaura cola, pista, posición y modos, **en pausa**.
6. El widget respeta tema claro/oscuro y no muestra botones inoperantes.
7. Todo fallo visible al usuario tiene un `NoticeCode` y una prueba que lo produce.
8. Las reglas de dependencia de §3 son verificables por lint, no solo por convención.

---

**Documentos relacionados:** `03-functional-audit.md` (hallazgos `C-01`, `C-02`, `A-01`…`A-09`), `04-ui-ux-audit.md` (`UI-01`…`UI-12`), `06-development-roadmap.md` (fases y orden de ejecución), `07-dependencies-and-tools.md` (veredictos por paquete), `08-testing-strategy.md` (cómo se prueba cada punto anterior).
