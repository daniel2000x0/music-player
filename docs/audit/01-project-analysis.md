# 01 · Análisis del proyecto

**Proyecto:** `mi-music-player`
**Tipo:** aplicación móvil Android/iOS de reproducción y administración musical local
**Auditoría:** solo lectura sobre el árbol de trabajo actual (rama `master`, commit `91d53d6` + cambios sin confirmar)
**Fecha:** 14 de noviembre de 2026
**Alcance:** análisis de estado, estructura, stack, métricas y madurez por módulo. No se modificó ningún archivo de la aplicación.

---

## 1. Resumen ejecutivo

El proyecto está **mucho más avanzado de lo que su documentación sugiere**. No es un prototipo: es una aplicación funcional con arquitectura por capas, persistencia SQLite versionada, motor de reproducción basado en `expo-audio` (`AudioPlaylist`), lector propio de etiquetas ID3v2/MP4, widget de pantalla de inicio y canal de actualizaciones OTA.

La línea base técnica está **verde y verificada empíricamente**:

| Verificación | Comando | Resultado |
| --- | --- | --- |
| Tipado estricto | `npx tsc --noEmit` | Sin errores (0 salidas) |
| Pruebas automatizadas | `npx jest` | 14 suites / **111 pruebas aprobadas** |
| Salud del proyecto Expo | `npx expo-doctor` | **20/20 comprobaciones** aprobadas |
| Node.js | `node -v` | v26.13.1 (compatible con el rango de `expo`) |
| npm | `npm -v` | 11.20.0 |

Por tanto, **ningún hallazgo de este informe debe interpretarse como «el proyecto no compila»**. Los problemas detectados son de **robustez, completitud funcional, higiene de dependencias, verificabilidad y experiencia de usuario**, no de corrección sintáctica.

Los tres riesgos que más afectan a la promesa del producto son:

1. **La reproducción en segundo plano puede degradarse en silencio** hasta detenerse a los ~3 minutos en Android (ver `C-01`).
2. **La biblioteca se trunca en 5000 pistas sin avisar al usuario** (ver `C-02`).
3. **No existe persistencia de la sesión de reproducción**: si Android mata el proceso, se pierde cola, pista y posición (ver `A-01`).

---

## 2. Contexto del producto

Según `docs/requirements/` (SRS, alcance, historias de usuario y casos de uso), la aplicación debe:

- Escanear la biblioteca musical del dispositivo y extraer metadatos reales.
- Reproducir con cola, aleatorio, repetición y controles del sistema (notificación, pantalla de bloqueo, widget).
- Administrar favoritos, playlists manuales y automáticas, historial y estadísticas.
- Explorar por canciones, álbumes, artistas, audiolibros y playlists, con filtros y ordenamientos.
- Funcionar **sin conexión** y con **permisos mínimos**.
- Persistir todo lo administrativo en SQLite.

El SRS define 13 requisitos funcionales (`RF-001` a `RF-013`) y 7 no funcionales (`RNF-001` a `RNF-007`). El análisis funcional detallado está en `03-functional-audit.md`.

---

## 3. Stack tecnológico verificado

Versiones comprobadas directamente en `node_modules`, no inferidas desde `package.json`:

| Paquete | Versión instalada | Rol real en el proyecto |
| --- | --- | --- |
| `expo` | 58.0.25 | SDK base (SDK 58) |
| `react-native` | 0.88.1 | Runtime nativo |
| `react` | 19.3.0 | UI |
| `expo-router` | 58.0.31 | Navegación por archivos, rutas tipadas |
| `expo-audio` | 58.0.12 | Motor de reproducción (`AudioPlaylist`), sesión de audio, lock screen |
| `expo-media-library` | 58.0.14 | Consulta de audio del dispositivo (API nueva `Query`/`Asset`) |
| `expo-sqlite` | 58.0.17 | Persistencia administrativa (WAL, FK) |
| `expo-file-system` | 58.0.13 | Lectura binaria de etiquetas y portadas |
| `expo-image` | 58.0.18 | Render de carátulas |
| `expo-widgets` | 58.0.28 | Widget Android (Jetpack Glance) |
| `@expo/ui` | 58.0.28 | Controles nativos en Ajustes |
| `expo-updates` | 58.0.22 | OTA |
| `expo-constants` | 58.0.16 | Detección de Expo Go / config |
| `zustand` | 5.0.16 | Estado global |
| `typescript` | 6.0.3 | Tipado |
| `jest` + `jest-expo` | 30.5.2 / 58.0.14 | Pruebas |

Configuración relevante:

- **`app.json`**: `userInterfaceStyle: "automatic"`, permisos Android declarados a mano, plugin `expo-audio` con `enableBackgroundPlayback: true`, plugin `expo-widgets` con `enableAndroid: true`, `experiments.reactCompiler: true`, `experiments.typedRoutes: true`, OTA con `runtimeVersion.policy: "appVersion"`.
- **`eas.json`**: perfiles `development` (development client), `preview` (APK) y `production` (APK, `autoIncrement`).
- **`tsconfig.json`**: alias `@/* → src/*`.
- **`metro.config.js`**: configuración por defecto de Expo.
- **`eslint.config.js`**: `eslint-config-expo`.

> Observación: `eas.json` produce **APK** también en `production`. Es válido para distribución directa, pero impide publicar en Google Play (que exige AAB). Se trata en `07-dependencies-and-tools.md`.

---

## 4. Estructura del repositorio

```
mi-music-player/
├── app.json                  Configuración Expo + plugins + permisos + widget
├── eas.json                  Perfiles de build
├── package.json              Dependencias, scripts, config Jest
├── tsconfig.json             Alias @/*
├── docs/
│   ├── requirements/         SRS, alcance, historias, casos de uso
│   └── audit/                Este informe
├── src/
│   ├── app/                  Rutas Expo Router (15 pantallas)
│   ├── components/           23 componentes de presentación
│   ├── constants/            Tokens de diseño
│   ├── data/
│   │   ├── db/               Conexión, migraciones versionadas
│   │   └── repositories/     9 repositorios SQLite
│   ├── domain/               Lógica pura (filtros, orden, audiolibros, tags, artwork)
│   ├── hooks/                Hooks de tema, debounce, actualización OTA
│   ├── services/             Motor de audio, mediateca, widget, tags, artwork, errores
│   ├── stores/               Zustand: player, library, settings, playback-progress
│   ├── testing/              Fixtures y benchmarks
│   ├── types/                Contratos TypeScript
│   ├── utils/                Utilidades
│   └── widgets/              Widget de pantalla de inicio (Glance)
└── assets/
```

### Métricas

| Métrica | Valor |
| --- | --- |
| Archivos TypeScript/TSX en `src/` | 107 |
| Líneas de código en `src/` | ~11 935 |
| Pantallas (`src/app/`) | 15 |
| Componentes | 23 |
| Repositorios | 9 |
| Archivos de prueba | 14 (todos en `src/domain/__tests__` + 2 benchmarks) |
| Pruebas | 111 |
| Archivo de mayor tamaño | `src/services/audio-engine.ts` (574 líneas) |

La distribución es sana: no hay «archivos Dios» de miles de líneas ni lógica de negocio dentro de las pantallas grandes. El único punto de concentración excesiva es `audio-engine.ts`, que concentra **ciclo de vida nativo + adaptación de estado + lock screen + reconstrucción de cola + guardas de entorno**. Es el candidato natural a dividirse (ver `05-architecture-proposal.md`).

---

## 5. Mapa de módulos, responsabilidad y madurez

Porcentaje estimado de **completitud respecto del SRS**, no de cobertura de pruebas.

| # | Módulo | Archivos principales | Estado | % |
| --- | --- | --- | --- | --- |
| 1 | Arranque e hidratación | `src/app/_layout.tsx`, `audio-bridge-inner.tsx` | Hidrata ajustes → biblioteca, monta el puente de audio | 90 % |
| 2 | Navegación y rutas | `src/app/**` (15 pantallas), layouts de tabs | Expo Router con rutas tipadas | 95 % |
| 3 | Biblioteca y escaneo | `media.service.ts`, `library.store.ts` | Escaneo, deduplicación, sincronización incremental por ids | 90 % |
| 4 | Metadatos y etiquetas | `domain/metadata.ts`, `tag.service.ts`, `domain/artwork/*` | Parser propio ID3v2 + MP4, portadas | 92 % |
| 5 | Persistencia SQLite | `data/db/*`, 9 repositorios | Esquema versionado (v4), WAL, FK, upsert por lotes | 95 % |
| 6 | Motor de reproducción | `audio-engine.ts` | `AudioPlaylist`, cola nativa, seek optimista | 80 % |
| 7 | Cola, aleatorio, repetición | `player.store.ts`, `app/queue.tsx` | Reordenar, insertar, quitar, barajar, 3 modos de bucle | 88 % |
| 8 | Notificación y lock screen | `audio-engine.ts` | Metadatos y controles; activación frágil (`C-01`) | 60 % |
| 9 | Widget de inicio | `widgets/*`, `media-widget.service.ts` | Snapshot, interacciones, degradación segura | 65 % |
| 10 | Favoritos, playlists, historial | repositorios + pantallas | CRUD completo, playlists automáticas | 92 % |
| 11 | Búsqueda, filtros, orden | `domain/library/*`, `components/sort-sheet.tsx` | Debounce, múltiples criterios, barra alfabética | 90 % |
| 12 | Audiolibros | `domain/library/audiobooks.ts`, `(tabs)/audiobooks.tsx` | Clasificación automática + manual y agrupación | 85 % |
| 13 | Ajustes, tema, OTA, diagnóstico | `(tabs)/settings.tsx`, `update.service.ts`, `error-log.service.ts` | Tema persistido, logs consultables, actualización OTA | 90 % |
| 14 | UI/UX y sistema de diseño | `constants/theme.ts`, 23 componentes | Tokens coherentes; widget no los usa | 85 % |
| 15 | Rendimiento | store de progreso aislado, `React.memo` selectivo, benchmarks | Buena base; sin medición en dispositivo | 70 % |
| 16 | Pruebas | `src/domain/__tests__` | Solo dominio puro | 35 % |
| 17 | Documentación técnica | `docs/` | Requisitos completos; faltan arquitectura/BD/estándares/testing | 45 % |
| 18 | Build y distribución | `eas.json`, `app.json` | Perfiles listos; sin evidencia de build ni CI | 50 % |
| 19 | Accesibilidad | 43 props `accessibility*` en 23 componentes | Parcial, sin auditoría formal | 55 % |

**Madurez global ponderada: ~78 %** para el alcance declarado en el SRS. El producto es usable hoy en un Development Build; lo que falta es **endurecer la reproducción en segundo plano, cerrar huecos de datos y profesionalizar la verificación**.

---

## 6. Lo que está bien hecho (y conviene preservar)

Estas decisiones son correctas y no deberían revertirse en fases posteriores:

1. **Separación por capas real**: `app` (rutas) → `components` (presentación) → `stores` (estado) → `services` (infraestructura) → `data` (persistencia). El dominio (`src/domain`) es puro y testeable.
2. **Migraciones idempotentes y versionadas** con `PRAGMA user_version` y reconstrucción de tablas; `WAL` y `foreign_keys` activados.
3. **Upsert por lotes de 50 filas** con `ON CONFLICT(media_id)` y cachés de artista/álbum: evita el clásico N+1 al escanear.
4. **Store de progreso aislado** (`playback-progress.ts`): los ticks de 500 ms no re-renderizan listas completas. Es una optimización madura, no accidental.
5. **Seek optimista con ventana de confirmación de 1500 ms**: evita el salto visual de la barra al arrastrar.
6. **Guardas de entorno explícitas**: `IS_EXPO_GO` y `requireOptionalNativeModule('ExpoWidgets')` con `import()` diferido. La app no se rompe en Expo Go.
7. **Degradación defensiva** en escaneo: `loadDeviceAudio()` devuelve `null` ante error para no marcar la biblioteca como vacía.
8. **Parser de etiquetas propio** con topes de memoria (2 MB de tags, 10 MB de portada) y pruebas unitarias con fixtures binarios.
9. **Tokens de diseño centralizados** (`Colors`, `Spacing`, `Radius`, `Fonts`).
10. **Registro de errores deduplicado** con contador y última ocurrencia, consultable desde Ajustes → Diagnóstico.

---

## 7. Deuda técnica y discrepancias detectadas

### 7.1 Discrepancias de configuración (confirmadas)

| Observación | Evidencia | Impacto |
| --- | --- | --- |
| `README.md` afirma que el proyecto fija `engines` en `package.json` | `README.md:19` vs. `package.json` sin campo `engines` | Documentación falsa; quien clone puede usar un Node incompatible |
| Permisos Android declarados pero no usados | `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_VISUAL_USER_SELECTED` en `app.json` | Incumple `RNF-006` (permisos mínimos) y complica la revisión de Play |
| Plugins declarados sin uso directo | `expo-web-browser`, `expo-asset`, `expo-system-ui`… | Ruido de configuración y binario más grande |
| Colores del widget hardcodeados | `src/widgets/media-widget.tsx` (`#0B0B0F`, `#7C5CFF`) | El widget ignora el tema claro/oscuro de la app |
| Documentos prometidos inexistentes | `docs/requirements/scope.md` promete `ARCHITECTURE.md`, `DATABASE.md`, `CODING_STANDARDS.md`, `TESTING.md` | Entregables incompletos |

### 7.2 Estado del control de versiones (confirmado)

El árbol de trabajo tiene **cambios sin confirmar en archivos críticos de reproducción**:

```
 M README.md
 M app.json
 M docs/requirements/*
 M eslint.config.js
 M package.json
 M package-lock.json
 M src/components/audio-bridge-inner.tsx
 M src/services/audio-engine.ts
 M src/stores/playback-progress.ts
 M src/stores/player.store.ts
?? .agents/  .claude/skills/  agent/  opencode.json  skills-lock.json
?? src/services/media-widget.service.ts
?? src/widgets/
```

Esto significa que **el widget y parte del motor actual no están en el historial de Git**. Si el equipo necesita volver a un estado estable, no puede hacerlo con `git checkout`. Es un riesgo de proceso, no de código, pero debe resolverse antes de iniciar cualquier fase de refactorización.

### 7.3 Deuda estructural

- `audio-engine.ts` mezcla cinco responsabilidades (ver §4).
- No hay **persistencia de sesión de reproducción** (cola, pista, posición).
- El estado de capacidades (¿hay lock screen? ¿hay módulo de widget? ¿permiso de notificaciones?) no se expone en la UI ni en diagnóstico.
- Los errores se registran, pero **no se comunican al usuario**: fallos de escaneo, permisos o lock screen son invisibles.
- Cobertura de pruebas concentrada en dominio puro; sin pruebas de stores, motor, repositorios, servicios ni componentes.

---

## 8. Herramientas y fuentes utilizadas en esta auditoría

| Herramienta | Disponibilidad | Uso |
| --- | --- | --- |
| Lectura directa del código | ✅ | 100 % de los archivos de configuración y de `src/` |
| `tsc`, `jest`, `expo-doctor` | ✅ | Verificación de línea base |
| Context7 MCP | ✅ parcial | Documentación de Expo SDK 58 (`/websites/expo_dev_versions_sdk`) |
| `webfetch` a `docs.expo.dev/versions/v58.0.0/` | ✅ | `expo-audio`, `expo-media-library`, `expo-widgets`, `expo-file-system` |
| Expo MCP | ❌ no expuesto en este entorno | Se sustituye por documentación oficial versionada |
| GitHub MCP | ❌ no expuesto en este entorno | No se pudo contrastar issues/PRs del upstream |
| Skills de Expo instalados en disco | ⚠️ 44 declarados en `skills-lock.json`, no registrados como herramienta en esta sesión | Se citan como recursos del repositorio, no como herramientas ejecutadas |

El detalle completo, con la clasificación de cada dependencia y el veredicto de conservar/cambiar/evaluar, está en `07-dependencies-and-tools.md`.

---

## 9. Conclusión

El proyecto merece una auditoría de **endurecimiento**, no una reescritura. La arquitectura elegida es la adecuada para el problema; el código está tipado, probado en su núcleo lógico y libre de errores de compilación. Las intervenciones de mayor retorno son concretas y acotadas:

1. Hacer **observable y reparable** la activación de la pantalla de bloqueo (`C-01`).
2. Eliminar el **truncamiento silencioso** de la biblioteca (`C-02`).
3. **Persistir la sesión** de reproducción (`A-01`).
4. Limpiar dependencias y permisos (`A-04`, `A-05`).
5. Elevar la **verificación** (pruebas de stores/servicios + CI).

El orden propuesto y los criterios de salida de cada etapa están en `06-development-roadmap.md`.
