# Pruebas y verificación

Este documento es la **guía ejecutable** de la FASE 7. La estrategia y el rationale están en `docs/audit/08-testing-strategy.md`; aquí solo hay comandos, umbrales, criterios y el guion de dispositivo.

---

## 1. Verificación automática

| Comprobación | Comando | Se ejecuta en |
| --- | --- | --- |
| Tipado | `npx tsc --noEmit` | local + CI |
| Lint | `npx expo lint --no-cache` | local + CI |
| Pruebas + cobertura | `npm run test:coverage` | local + CI |
| Umbrales por capa | `npm run check:coverage` | local + CI |
| Salud del proyecto | `npx expo-doctor` | local + CI (informativo) |
| Benchmarks | `npm run bench` | local, bajo demanda |

El workflow `.github/workflows/ci.yml` ejecuta todo lo anterior en cada push a `master` y en cada pull request. Usa `npm ci` (hay `package-lock.json`) y Node 22.

> `expo lint` reutiliza caché entre ejecuciones: en local hay que pasar
> `--no-cache` para ver el estado real de los archivos.

### 1.1 Umbrales de cobertura

Los umbrales globales están en la sección `jest.coverageThreshold` de `package.json`. Los promedios por capa los comprueba `scripts/check-coverage.js` sobre `coverage/coverage-summary.json` (Jest aplica sus globs **por archivo**, no por directorio, por eso hace falta el script).

| Ámbito | Métrica | Objetivo | Medido (FASE 7) |
| --- | --- | --- | --- |
| Global | Líneas | ≥ 65 % | **90.92 %** |
| Global | Sentencias | — | **90.54 %** |
| Global | Ramas | — | **85.02 %** |
| Global | Funciones | — | **89.15 %** |
| `src/domain/**` | Líneas | ≥ 90 % | **90.35 %** |
| `src/services/**` | Líneas | ≥ 70 % | **91.92 %** |
| `src/stores/**` | Líneas | ≥ 80 % | **89.25 %** |

Los umbrales exigidos en `package.json` son algo más altos que los mínimos históricos del plan (90/89/84/88 en global) para proteger el estado alcanzado. La cobertura se mide, no se estima: el informe se genera en `coverage/` (ignorado por Git) y la comprobación por capa falla el pipeline si baja del objetivo.

### 1.2 `expo-doctor` en CI

`expo-doctor` informa de una deriva de versiones **pre-existente** (no introducida por FASE 7): **19/20 comprobaciones pasan** y falla solo la de versiones, con **9 paquetes** publicados con revisiones posteriores a las de `package.json`:

| Tipo | Paquetes |
| --- | --- |
| Minor | `expo-web-browser` (`~58.1.0` esperado, `58.0.8` instalado) |
| Patch | `@expo/ui`, `expo`, `expo-dev-client`, `expo-file-system`, `expo-router`, `expo-sqlite`, `expo-widgets`, `jest-expo` |

Corregirla exigiría subir dependencias nativas y volver a validar el APK, algo deliberadamente fuera de FASE 7. Por eso el paso se ejecuta en CI con `continue-on-error: true`: **se informa, no bloquea**. Se revisará al cerrar la FASE 8.

---

## 2. Dobles de prueba

`src/testing/mocks/` contiene los sustitutos de los módulos nativos. Se montan desde un factory de `jest.mock`, nunca en medio de un servicio:

| Doble | Uso |
| --- | --- |
| `expo-audio.ts` | playlist falsa con eventos (`__emit`), fallos de lock screen / modo de audio / seek y captura de instancias |
| `expo-file-system.ts` | sistema de archivos en memoria (`__seedFile`, `__getFile`, `__reset`) para carátulas, tags y widget |
| `expo-widgets.ts` | captura de snapshots y emisión de pulsaciones (`__emitInteraction`) |
| `expo-modules-core.ts` | presencia/ausencia del módulo nativo `ExpoWidgets` (Expo Go vs dev build) |
| `database.ts` | SQLite falso que registra SQL y parámetros para los repositorios |

Regla: **mockear en la frontera** (módulos nativos), no los servicios propios. Lo que no se puede representar fielmente en un doble se verifica en dispositivo con el guion de la sección 4.

No se añaden pruebas de **render** de componentes ni pantallas: el proyecto no
tiene `@testing-library/react-native` y su compatibilidad con React 19.3 / RN
0.88 no está garantizada. Añadirla obligaría a introducir una dependencia de dev
y a revalidar el preset de Jest; la cobertura se limita a lógica (dominio,
servicios, stores y repositorios) y la interacción se cubre con el guion manual.
La accesibilidad implementada en FASE 6 se verifica en dispositivo con
`uiautomator dump`.

---

## 3. Hallazgos cubiertos por pruebas

Cada ID corregido en fases anteriores tiene al menos una prueba de regresión:

| ID | Prueba |
| --- | --- |
| `C-01` | `src/services/__tests__/audio-lockscreen.test.ts` (backoff 1 s → 3 s → 10 s, degradación y recuperación) |
| `C-02` | `src/services/__tests__/media.service.test.ts` (paginación y permisos de la mediateca) |
| `A-01` | `src/data/repositories/__tests__/playback-session.repository.test.ts` + `src/services/__tests__/session-persistence.test.ts` |
| `A-02` | `src/services/__tests__/media-widget.service.test.ts` (coalescencia de snapshots) |
| `A-03` | `src/services/__tests__/media-widget.service.test.ts` (pulsaciones y contenido del widget) |
| `A-04` | `src/services/__tests__/capabilities.test.ts` + `src/services/audio/__tests__/audio-mode.test.ts` |
| `A-07` | `src/services/__tests__/media.service.test.ts` (borrado confirmado por el sistema) |
| ANR ventana | `src/services/__tests__/audio-queue-window.test.ts` (201 pistas entregadas al motor, no la cola completa) |

---

## 4. Guion de prueba manual (12 pasos)

Se ejecuta en un **dev build o APK preview** con al menos unas decenas de canciones. Se registra el resultado de cada paso antes de cerrar un release.

Para una comprobación rápida solo de UI en **Expo Go**, iniciar el servidor con
`npx expo start --go` (o `npm run start:go`). El `npx expo start` habitual apunta
al Development Build porque el proyecto incluye `expo-dev-client`; si se escanea
ese QR con Expo Go, la app no carga y se queda en el splash blanco con «Music».

| # | Escenario | Pasos | Resultado esperado |
| --- | --- | --- | --- |
| 1 | Instalación y permisos | Instalar el APK, abrir la app, denegar permiso de audio, concederlo desde Ajustes | Sin crash; al conceder se lanza el escaneo y se retira el aviso de permiso |
| 2 | Primer arranque | Abrir con BD vacía | Loader visible, progreso de escaneo con fase y conteo, lista poblada al terminar |
| 3 | Arranque posterior | Cerrar y reabrir sin cambios en la mediateca | La biblioteca aparece de inmediato desde SQLite; no hay spinner ni relectura de etiquetas |
| 4 | Reproducción y sesión de medios | Pulsar una canción; expandir la notificación y la pantalla de bloqueo | Título, artista y portada correctos; la sesión se registra aunque el fabricante retrase los controles |
| 5 | Controles básicos | Play/pausa, siguiente, anterior, seek con el dedo | Estado coherente en app, notificación y lock screen; la barra no salta atrás tras soltar el dedo |
| 6 | Modos | Ciclar repetición (none → all → single) y activar aleatorio; reordenar la cola | El orden de reproducción cambia sin cortar la pista; la notificación sigue viva al terminar la cola |
| 7 | Favoritos e historial | Marcar/desmarcar, reproducir > 30 s, abrir «Recientes» | El favorito persiste tras reiniciar; la reproducción cuenta una sola vez por pista |
| 8 | Playlists | Crear, renombrar, añadir, quitar, reordenar y borrar | Las listas se guardan; una playlist automática no se puede renombrar ni borrar |
| 9 | Gestión de biblioteca | Editar metadatos, marcar audiolibro, quitar pistas, borrar del dispositivo y recuperar | Solo se retiran del dispositivo las pistas confirmadas; «Recuperar ocultas» las reincorpora tras el escaneo |
| 10 | Carátulas | Abrir un álbum sin portada; ejecutar «Buscar carátulas ausentes» | La portada se resuelve desde la caché o la carpeta y se propaga a todas las pistas del álbum |
| 11 | Widget | Añadir el widget, cambiar de pista, pausar, alternar tema claro/oscuro, pulsar los tres botones | Snapshot actualizado en ≤ 1 s; los botones actúan sobre la misma cola; sin archivos huérfanos `media-cover-*` |
| 12 | Degradación y OTA | Revocar notificaciones, reproducir, restaurar sesión tras matar la app, aplicar una OTA `preview` | El aviso explica la capacidad perdida; la sesión se restaura **en pausa**; la OTA se aplica sin cambiar el runtime |

---

## 5. Medición en dispositivo

Estas mediciones son **manuales** y se registran por release. No se simulan en Jest.

| Métrica | Protocolo | Valor |
| --- | --- | --- |
| OTA `preview` aplicada | Relanzar tras publicar, aceptar el diálogo «Actualización disponible» | ✅ Grupo `d69222e3-1967-439b-b949-3bb9a40e2137`, runtime `1.0.0`, 19/11/2026 |
| Carga de biblioteca tras OTA | `uiautomator dump` tras el reinicio | ✅ 1805 canciones · 684 artistas, sin excepciones en `logcat` |
| Reproducción y mini-reproductor | Pulsar una pista, pausar con `input keyevent 127`, volcar la jerarquía | ✅ Tema y controles correctos; etiquetas de accesibilidad presentes |
| Arranque en frío | `am start -W` tras `am force-stop`, 5 repeticiones, mediana | Pendiente de medir en FASE 8 |
| Escaneo de 12 000 pistas | Biblioteca de 12 k archivos, primer arranque, cronómetro desde «enumerate» hasta «done» | Pendiente de medir en FASE 8 |
| Memoria con 5 000 filas | `dumpsys meminfo` con la vista «Canciones» desplazada hasta el final | Pendiente de medir en FASE 8 |
| Batería en 30 min | Reproducción con pantalla apagada, `dumpsys batterystats` | Pendiente de medir en FASE 8 |

El resto del guion de 12 pasos (sección 4) requiere una biblioteca de prueba
específica y capturas largas; se ejecutará al cerrar FASE 8.

Los benchmarks JS equivalentes (escaneo y preparación de listas) sí están automatizados en `src/testing/bench/` y se ejecutan con `npm run bench`.

### 5.1 Benchmarks JS registrados

Medidos con `npm run bench` (20 iteraciones, mediana / p95 en ms) en el entorno de CI local. Son el trabajo previo al render y al escaneo, **no** una simulación del dispositivo; sirven para detectar regresiones de algoritmo.

**Transformaciones del escaneo** (`scan.bench.test.ts`):

| Operación | 1 k (med / p95) | 5 k (med / p95) | 12 k (med / p95) |
| --- | --- | --- | --- |
| `diffScan` incremental | 0.27 / 0.32 | 3.98 / 6.46 | 2.48 / 3.23 |
| `resolveSongMetadata` | 1.06 / 1.29 | 7.06 / 24.70 | 12.06 / 12.79 |
| `parseFilename` | 0.60 / 0.79 | 3.13 / 19.74 | 7.60 / 13.79 |
| `decodeUtf8` | 10.11 / 39.04 | 50.69 / 117.18 | 121.89 / 306.57 |
| `decodeLatin1` | 10.62 / 41.66 | 51.56 / 54.66 | 125.21 / 282.26 |
| `decodeUtf16` | 16.31 / 48.57 | 49.79 / 53.39 | 120.23 / 306.96 |
| Progreso (100 lotes) | 0.10 / 0.12 | 0.25 / 0.26 | 0.10 / 0.22 |
| `describeScanReport` × 100 | 0.07 / 0.12 | 0.14 / 0.15 | 0.14 / 0.21 |

**Preparación de listas** (`list-render.bench.test.ts`). No se renderiza React: se mide el cómputo previo (map a props, filtro, orden y agrupación por letra), que es lo que puede bloquear el hilo JS antes de que la lista aparezca.

| Operación | 1 k (med / p95) | 5 k (med / p95) | 10 k (med / p95) |
| --- | --- | --- | --- |
| Preparar filas `Song → props` | 2.11 / 2.28 | 10.76 / 13.04 | 44.17 / 80.29 |
| `filterSongs` | 0.02 / 0.05 | 0.11 / 0.15 | 0.22 / 0.23 |
| `sortSongs` (Collator) | 0.49 / 0.50 | 2.83 / 3.43 | 5.86 / 27.51 |
| Búsqueda + filas | 0.50 / 1.04 | 4.57 / 21.42 | 6.52 / 24.94 |
| `sectionList` por letra | 0.86 / 1.03 | 5.33 / 21.56 | 9.60 / 38.80 |
| Flujo completo | 3.41 / 4.06 | 25.57 / 81.27 | 81.34 / 99.49 |

**Dominio** (`domain.bench.test.ts`), con 10 k pistas: `filterSongs` con búsqueda 5.76 / 11.84 ms, `sortSongs` por artista (dos claves) 23.19 / 72.33 ms, `JSON.stringify` de la sesión 12.65 / 42.34 ms.

Lectura: el coste crece de forma aproximadamente lineal con el tamaño; el peor caso medido es la decodificación de 12 k etiquetas (~122 ms mediana) y la preparación de 10 k filas (~44 ms mediana). Ambos están por debajo del presupuesto de un frame si se ejecutan por lotes, y son los candidatos a optimizar en FASE 8 si la medición en dispositivo confirma un problema.

---

## 6. Política de `runtimeVersion` (M-09)

**Decisión:** conservar `"runtimeVersion": { "policy": "appVersion" }` en `app.json`.

- Es la configuración recomendada por Expo para proyectos con código nativo: el runtime queda ligado a la versión que ve el usuario (`1.0.0`), no al `versionCode`.
- Las OTA `preview` publicadas hasta FASE 6 usan runtime `1.0.0`; cambiar la política ahora dejaría esas actualizaciones inalcanzables para los dispositivos ya instalados.
- `sdkVersion` se descarta: permitiría aplicar updates entre builds con nativos distintos (splash, iconos, plugins), justo el riesgo que `appVersion` evita.
- `fingerprint` se descarta por ahora: es más seguro, pero obliga a generar un build nativo ante cualquier cambio que altere la huella; se reconsiderará en FASE 8.
- `eas.json` usa `appVersionSource: "remote"` y `autoIncrement` en producción: EAS gestiona la versión de las submissions. **Regla:** toda publicación y todo cambio que afecte al runtime nativo (dependencias con código nativo, config plugins, splash, iconos) debe ir acompañado de un build con nueva versión. Las fases 5.2, 5.1 y 6 fueron cambios solo de JS, por eso viajaron por OTA sin subir de runtime.

---

## 7. Salida de la fase

Se considera cerrada cuando:

1. `npx tsc --noEmit`, `npx expo lint`, `npx jest --coverage` y el CI pasan con los umbrales de la sección 1.1.
2. Existe una prueba por cada hallazgo de la sección 3.
3. Los benchmarks de escaneo y render están registrados con número.
4. Este guion se ha ejecutado en dispositivo y sus resultados están registrados.
5. `runtimeVersion` está decidido (sección 6).
