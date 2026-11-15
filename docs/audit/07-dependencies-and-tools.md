# 07 · Dependencias y herramientas

**Proyecto:** `mi-music-player`
**Tipo de documento:** veredicto por dependencia y matriz de herramientas
**Fecha:** 14 de noviembre de 2026

---

## 1. Método

Los veredictos **no** se basan en la memoria del auditor ni en lo que dice `package.json`. Se obtuvieron así:

| Evidencia | Cómo se obtuvo |
| --- | --- |
| Versión realmente instalada | Lectura de `node_modules/<paquete>/package.json` |
| Uso real en el código | `grep` de cada paquete en `src/**/*.ts,tsx` (imports) |
| Compatibilidad con Expo Go | Documentación oficial SDK 58 (`docs.expo.dev/versions/v58.0.0/`) |
| Coherencia del árbol | `npx expo-doctor` → 20/20 |
| Peers de `expo-router` | `node_modules/expo-router/package.json` (`peerDependencies` + `peerDependenciesMeta`) |
| Configuración nativa | Lectura de `app.json` (plugins y permisos) |

**Advertencia de método:** «0 imports» significa *no importado directamente por `src/`*. Varias dependencias son **peers obligatorios** de `expo-router` y su ausencia rompe la app aunque el código no las importe. Esa distinción es la que evita podas incorrectas.

**Política de versiones:** el proyecto está en **SDK 58** y todas las versiones de paquetes `expo-*` fueron resueltas por `expo install`. **No se recomienda actualizar nada de forma aislada.** Subir `expo-audio` o `expo-media-library` por separado rompe la matriz de compatibilidad del SDK; cualquier actualización debe ser `npx expo install --fix` dentro de una actualización completa de SDK, con su propia fase de pruebas.

---

## 2. Veredictos por dependencia

Leyenda de veredicto:

- **MANTENER** — se usa y es correcto.
- **MANTENER (peer)** — no se importa directamente, pero es obligatorio para que otra pieza funcione.
- **RETIRAR** — no se usa, no es peer y no aporta valor previsto.
- **EVALUAR** — no se usa hoy; retirar o conservar depende de una decisión de producto.
- **NO CAMBIAR** — se usa y su versión está acoplada al SDK.

### 2.1 Dependencias de ejecución

| Paquete | Instalada | Importado en `src/` | Rol | Expo Go | Veredicto |
| --- | --- | --- | --- | --- | --- |
| `expo` | 58.0.25 | — | SDK base | ✅ (versión incluida) | **NO CAMBIAR** |
| `react-native` | 0.88.1 | — | Runtime nativo | ✅ | **NO CAMBIAR** |
| `react` | 19.3.0 | — | UI | ✅ | **NO CAMBIAR** |
| `expo-router` | 58.0.31 | 14 archivos | Navegación por archivos | ✅ | **MANTENER** |
| `expo-audio` | 58.0.12 | `services/audio-engine.ts` | Motor de reproducción | ✅ (con límites: background ~3 min sin lock screen) | **MANTENER** · crítico para `C-01` |
| `expo-media-library` | 58.0.14 | `services/media.service.ts` | Consulta de audio del dispositivo | ✅ (permiso runtime) | **MANTENER** · crítico para `C-02` |
| `expo-sqlite` | 58.0.17 | `data/db/database.ts` | Persistencia administrativa | ✅ | **MANTENER** |
| `expo-file-system` | 58.0.13 | `tag.service.ts`, `artwork.service.ts` | Lectura binaria de etiquetas/portadas | ✅ | **MANTENER** |
| `expo-image` | 58.0.18 | `components/artwork.tsx` | Render de carátulas | ✅ | **MANTENER** |
| `expo-widgets` | 58.0.28 | `widgets/media-widget.tsx`, `media-widget.service.ts` | Widget Android (Glance) | ❌ **no incluido** → dev build | **MANTENER** · exige `enableAndroid` + `android.package` + prebuild |
| `@expo/ui` | 58.0.28 | `(tabs)/settings.tsx` | Controles nativos | ✅ incluido | **MANTENER** |
| `expo-updates` | 58.0.22 | `services/update.service.ts` | OTA | ✅ (no en Expo Go) | **MANTENER** · revisar `runtimeVersion` (`M-09`) |
| `expo-constants` | 58.0.16 | `audio-engine.ts`, `update.service.ts` | Detección de entorno / config | ✅ | **MANTENER** · también peer obligatorio de `expo-router` |
| `expo-status-bar` | 58.0.5 | 1 archivo | Barra de estado | ✅ | **MANTENER** |
| `@expo/vector-icons` | 15.0.2 | 20 archivos | Iconografía de la app | ✅ | **MANTENER** · ya empaquetado con `expo` |
| `react-native-safe-area-context` | 5.11.1 | 3 archivos | Safe areas | ✅ | **MANTENER** · peer obligatorio de `expo-router` |
| `react-native-screens` | 4.30.1 | 0 | Pantallas nativas | ✅ | **MANTENER (peer)** · peer **no opcional** de `expo-router`; retirarlo rompe la navegación |
| `expo-linking` | 58.0.17 | 0 | Deep links | ✅ | **MANTENER (peer)** · peer **no opcional** de `expo-router` |
| `zustand` | 5.0.16 | 4 stores | Estado global | n/a | **MANTENER** |
| `expo-dev-client` | 58.0.20 | 0 | Development build | ❌ (es el dev build) | **MANTENER** · necesario para `expo-widgets` y pruebas nativas |
| `@expo/ngrok` | 4.1.3 | 0 | Túnel para `expo start --tunnel` | n/a | **EVALUAR** · herramienta de desarrollo, no de producto |
| `expo-asset` | 58.0.20 | 0 | Empaquetado de assets | ✅ | **EVALUAR** · declarado como plugin sin uso; puede ser requerido por otra pieza |
| `expo-splash-screen` | 58.0.14 | 0 | Control del splash | ✅ | **EVALUAR** · el plugin está configurado; sin uso explícito en código |
| `expo-system-ui` | 58.0.7 | 0 | Color de fondo del sistema | ✅ | **EVALUAR** · útil para `UI-03`/`UI-04`, hoy sin uso |
| `expo-web-browser` | 58.0.8 | 0 | Navegador in-app | ✅ | **RETIRAR** · plugin declarado sin uso |
| `expo-font` | 58.0.11 | 0 | Carga de fuentes | ✅ | **RETIRAR** · no hay fuentes personalizadas; `Fonts` usa familias del sistema |
| `expo-device` | 58.0.5 | 0 | Info del dispositivo | ✅ | **RETIRAR** |
| `expo-symbols` | 58.0.5 | 0 | SF Symbols | ✅ (iOS) | **RETIRAR** · no hay uso; en Android no aporta |
| `expo-glass-effect` | 58.0.5 | 0 | Efecto vidrio iOS | ✅ (iOS 26) | **RETIRAR** |
| `react-native-gesture-handler` | 3.3.0 | 0 | Gestos | ✅ | **RETIRAR** (o MANTENER como peer si `expo-router` lo requiere en la versión instalada) |
| `react-native-reanimated` | 4.7.1 | 0 | Animaciones | ✅ | **RETIRAR** (ídem: verificar peer antes) |
| `react-native-worklets` | 0.13.0 | 0 | Runtime de worklets (peer de Reanimated 4) | ✅ | **RETIRAR** junto con Reanimated |
| `react-dom` | 19.3.0 | 0 | Render web | n/a | **EVALUAR** · solo necesario si se mantiene el objetivo web |
| `react-native-web` | 0.21.4 | 0 | Render web | n/a | **EVALUAR** · idem; `app.json` declara `web.output: static` |

> **Corrección importante respecto a una lectura ingenua:** `expo-linking`, `react-native-safe-area-context`, `react-native-screens` y `expo-constants` son **peers no opcionales** de `expo-router`. `react-dom`, `react-native-web`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, `expo-symbols` y `@expo/ui` son **peers opcionales** en `expo-router@58`. Por eso los primeros se mantienen aunque tengan 0 imports directos, y los segundos son candidatos reales a poda.

### 2.2 Dependencias de desarrollo

| Paquete | Instalada | Veredicto |
| --- | --- | --- |
| `typescript` | 6.0.3 | **NO CAMBIAR** · `tsc` limpio; el rango lo fija el SDK |
| `jest` | 30.5.2 | **MANTENER** |
| `jest-expo` | 58.0.14 | **MANTENER** · preset alineado al SDK |
| `@types/jest` | 30.0.0 | **MANTENER** |
| `@types/react` | 19.3.0 | **MANTENER** |
| `eslint` | 9.x | **MANTENER** |
| `eslint-config-expo` | 58.0.4 | **MANTENER** |
| `@testing-library/react-native` | no instalada | **EVALUAR en FASE 7** · verificar compatibilidad con React 19.3 / RN 0.88 antes de instalar |

### 2.3 Paquetes descartados explícitamente

| Paquete | Por qué no |
| --- | --- |
| `react-native-track-player` | Obliga a development build, foreground service propio y reescribir el motor. `expo-audio` cubre `RF-002` cuando el lock screen funciona. |
| `expo-notifications` | `expo-audio` ya publica la notificación de sesión de medios; añadir otra crea dos controles duplicados. |
| `expo-av` | Deprecado en favor de `expo-audio`. |
| `expo-background-task` / `expo-task-manager` | Escaneo en segundo plano fuera de alcance del SRS; complejidad nativa alta. |
| `drizzle-orm`, `prisma` | 9 repositorios SQL explícitos, probados y suficientes. |
| `nativewind`, `tamagui`, `gluestack` | El sistema de tokens actual funciona; migrar estilos no resuelve ningún hallazgo. |
| `@shopify/flash-list` | `FlatList` con `SongRow` memoizado cubre el caso; reevaluar solo si la FASE 7 mide caídas de FPS. |
| `react-native-mmkv` | `expo-sqlite` con WAL es suficiente y ya está integrado. |
| `expo-haptics` | No aporta a los hallazgos actuales; sería nice-to-have. |

---

## 3. Auditoría de configuración nativa (`app.json`)

### 3.1 Plugins

| Plugin | Configuración | Estado | Comentario |
| --- | --- | --- | --- |
| `expo-router` | Headers COEP/COOP | ⚠️ Revisar | Configuración web en una app Android/iOS (`M-03`) |
| `expo-splash-screen` | `backgroundColor: "#0B0B0F"` | ⚠️ Incoherente | Siempre oscuro con `userInterfaceStyle: automatic` (`UI-03`) |
| `expo-media-library` | `granularPermissions: ["audio"]`, `isAccessMediaLocationEnabled: false` | ✅ Correcto | Mínimo necesario |
| `expo-audio` | `enableBackgroundPlayback: true`, sin micrófono | ✅ Correcto | La clave de `C-01` es el lock screen, no este flag |
| `expo-sqlite` | — | ✅ | — |
| `expo-asset` | — | ⚠️ Sin uso funcional | Retirar o justificar |
| `expo-status-bar` | — | ✅ | — |
| `expo-web-browser` | — | ❌ Sin uso | Retirar |
| `expo-widgets` | `enableAndroid: true`, `MediaWidget` 250×140, `targetCellWidth: 4` | ✅ Correcto | Requiere dev build; iOS deshabilitado (`ios: null`) de forma deliberada |

### 3.2 Permisos Android declarados

| Permiso | ¿Usado por el código/plugins? | Veredicto |
| --- | --- | --- |
| `READ_MEDIA_AUDIO` | Sí, `expo-media-library` (audio) | **MANTENER** (Android 13+) |
| `READ_EXTERNAL_STORAGE` | Sí, necesario en Android ≤ 12 | **MANTENER** |
| `POST_NOTIFICATIONS` | Sí, controles de reproducción | **MANTENER** |
| `FOREGROUND_SERVICE` | Sí, reproducción en segundo plano | **MANTENER** |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Sí | **MANTENER** |
| `WRITE_EXTERNAL_STORAGE` | No | **RETIRAR** (`A-06`) |
| `READ_MEDIA_VISUAL_USER_SELECTED` | No (es para fotos/vídeo) | **RETIRAR** (`A-06`) |
| `MODIFY_AUDIO_SETTINGS` | No necesario para reproducir | **RETIRAR** (`A-06`) |

**Nota de plataforma:** `WRITE_EXTERNAL_STORAGE` está ignorado en Android 11+ y es motivo de fricción/observación en la revisión de Play. Su retirada es segura.

### 3.3 `eas.json`

| Perfil | `distribution` | Android | Problema |
| --- | --- | --- | --- |
| `development` | internal | dev client | ✅ |
| `preview` | internal | APK | ✅ |
| `production` | store | **APK** | ❌ **Google Play exige AAB** |

**Acción:** en FASE 8, `production` debe usar `buildType: "app-bundle"`; `preview` conserva APK para QA interno. Ver `06-development-roadmap.md` FASE 8.

---

## 4. Matriz de disponibilidad de herramientas

Estado **real** de esta sesión de auditoría, sin inventar capacidades:

| Herramienta | Estado | Uso en la auditoría | Impacto de su ausencia |
| --- | --- | --- | --- |
| **Skills del entorno** (`context7-mcp`, `find-skills`, `opencode`, `report`) | ✅ Invocables | Consulta de convenciones y flujo | — |
| **Skills Expo/ingeniería en disco** (`.agents/skills`, `.claude/skills`, `skills-lock.json`) | ❌ **No registrados como herramientas** | No se pudieron invocar | Se sustituyeron por documentación oficial y Context7 |
| **Context7 MCP** | ✅ Disponible | Documentación de librerías | — |
| **Expo MCP** | ❌ **No expuesto** | — | Se usó `webfetch` a `docs.expo.dev/versions/v58.0.0/` |
| **GitHub MCP** | ❌ **No expuesto** | — | No se pudo contrastar issues/PRs del upstream |
| **`webfetch` a docs oficiales** | ✅ | Confirmar límites de background, requisitos de `expo-widgets`, componentes soportados | — |
| **`expo-doctor`** | ✅ Local | 20/20 | — |
| **`tsc` / `jest`** | ✅ Local | 0 errores / 111 pruebas | — |
| **Dispositivo o emulador Android** | ❌ No disponible | — | Todo comportamiento nativo queda como riesgo, no como verificado |
| **`adb`** | ❌ No verificado | — | Sin inspección de permisos efectivos ni logs nativos |
| **`eas-cli`** | ❌ No ejecutado | — | No se validó build real ni firma |

**Consecuencia honesta:** este informe distingue en todo momento entre **«confirmado en código/configuración»** y **«riesgo que requiere dispositivo»**. Nada de lo marcado como riesgo debe presentarse como fallo demostrado.

---

## 5. Herramientas recomendadas por fase

| Fase | Herramientas imprescindibles | Herramientas de verificación |
| --- | --- | --- |
| 1 | `tsc`, `jest`, `git` | `grep`, revisión de diff |
| 2 | `tsc`, `jest`, `expo lint` | `expo-doctor`, `import/no-cycle` |
| 3 | `expo-sqlite` CLI no aplica; `jest` con base en memoria | Dispositivo con biblioteca >5000 pistas |
| 4 | `jest`, benchmarks existentes | Dev build + `adb logcat` |
| 5 | Dev build obligatorio | `adb shell dumpsys appwidget`, captura del widget |
| 6 | `expo lint`, TalkBack | Dispositivos 320 dp / 412 dp, fuente 200 % |
| 7 | `jest --coverage`, GitHub Actions | Benchmark en dispositivo |
| 8 | `npx eas-cli@latest` | `adb shell dumpsys package`, `bundletool` |

---

## 6. Higiene y cadena de suministro

| Aspecto | Estado | Observación |
| --- | --- | --- |
| Lockfile | ✅ `package-lock.json` presente | Commitearlo siempre |
| Secretos en repo | ✅ No hay `.env` ni credenciales | `app.json` solo contiene `projectId` público |
| `node_modules` versionado | ✅ Excluido por `.gitignore` | — |
| Archivos de agente sin commitear | ⚠️ `.agents/`, `agent/`, `opencode.json`, `skills-lock.json` | Decidir si se versionan o se ignoran (`A-09`) |
| Assets de plantilla | ⚠️ `expo-logo.png`, `react-logo*.png`, `tutorial-web.png`, `logo-glow.png`, `expo-badge*.png` | Peso y ruido; retirar en FASE 6 (`UI-09`) |
| Duplicación de gestores | ✅ Solo npm | `npx` es correcto; no hay `bun.lock` ni `yarn.lock` |
| `engines` | ❌ Ausente y documentado como existente | `B-01`; añadirlo o corregir el README |

---

## 7. Recomendaciones concretas y ordenadas

1. **No actualizar ninguna dependencia ahora.** El árbol está coherente con SDK 58 y verde.
2. **Retirar en FASE 2** (una por una, con `expo-doctor` después): `expo-web-browser`, `expo-font`, `expo-device`, `expo-symbols`, `expo-glass-effect`.
3. **Verificar antes de retirar** `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`: comprobar `expo-router@58` `peerDependenciesMeta` en `node_modules`. Si son opcionales, retirar; si no, conservar y documentar.
4. **Decidir sobre web** (`react-dom`, `react-native-web`, `web.output`, headers COEP/COOP): si el producto es Android/iOS, retirar y simplificar `app.json` (`M-03`). Si se mantiene web, justificarlo.
5. **Retirar los 3 permisos sin uso** (`A-06`) en FASE 2.
6. **Instalar solo con `npx expo install`** en el futuro; nunca `npm install <paquete>` a secas, para no romper la matriz del SDK.
7. **Reevaluar `react-native-reanimated`** únicamente si la FASE 6 la necesita de verdad, y entonces reinstalarla con `expo install` y documentar el motivo.
8. **`@expo/ngrok`**: mover a `devDependencies` o retirar; es una herramienta de túnel, no una dependencia de producto.

---

## 8. Resumen del veredicto

| Veredicto | Cantidad | Paquetes |
| --- | --- | --- |
| **NO CAMBIAR** | 4 | `expo`, `react-native`, `react`, `typescript` |
| **MANTENER** | 15 | `expo-router`, `expo-audio`, `expo-media-library`, `expo-sqlite`, `expo-file-system`, `expo-image`, `expo-widgets`, `@expo/ui`, `expo-updates`, `expo-constants`, `expo-status-bar`, `@expo/vector-icons`, `zustand`, `expo-dev-client`, `jest*`/`eslint*` |
| **MANTENER (peer)** | 3 | `expo-linking`, `react-native-safe-area-context`, `react-native-screens` |
| **EVALUAR** | 5 | `@expo/ngrok`, `expo-asset`, `expo-splash-screen`, `expo-system-ui`, `react-dom` + `react-native-web` (decisión web) |
| **RETIRAR** | 8 | `expo-web-browser`, `expo-font`, `expo-device`, `expo-symbols`, `expo-glass-effect`, `react-native-gesture-handler`*, `react-native-reanimated`*, `react-native-worklets`* |
| **RETIRAR (permisos)** | 3 | `WRITE_EXTERNAL_STORAGE`, `READ_MEDIA_VISUAL_USER_SELECTED`, `MODIFY_AUDIO_SETTINGS` |

\* Sujeto a verificación de peers de `expo-router@58` antes de retirar.

**Conclusión:** no hay ninguna dependencia «equivocada». Hay **8 dependencias sobrantes y 3 permisos sobrantes**. El stack elegido es el correcto para SDK 58; el trabajo pendiente es de **poda y verificación**, no de sustitución.

---

**Documentos relacionados:** `02-compatibility-report.md` (matriz completa Expo Go / dev build), `05-architecture-proposal.md` (dónde encaja cada capacidad), `06-development-roadmap.md` (en qué fase se poda cada cosa), `08-testing-strategy.md` (cómo se verifica que la poda no rompe nada).
