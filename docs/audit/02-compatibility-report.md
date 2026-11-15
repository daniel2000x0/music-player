# 02 · Informe de compatibilidad

**Objetivo:** clasificar cada dependencia y cada capacidad nativa según el entorno donde funciona realmente, y detectar configuraciones que no coinciden con el comportamiento esperado.

**Método:** versiones leídas de `node_modules`, comportamiento verificado contra la documentación oficial versionada de Expo SDK 58 (`docs.expo.dev/versions/v58.0.0/`) y contra el código del proyecto. No se asume nada por memoria.

**Entornos considerados:**

| Entorno | Qué aplica | Qué no aplica |
| --- | --- | --- |
| **Expo Go** | Módulos incluidos en el binario de Expo Go; JS de la app | Config plugins, permisos personalizados, servicios nativos, widgets, OTA propio |
| **Development Build** (`expo run:android` / `eas build --profile development`) | Todo el JS + el código nativo generado por los plugins + dev client | — |
| **Build de producción** (`eas build --profile production`) | Todo, sin dev menu | — |

---

## 1. Conclusión de compatibilidad

> **La aplicación no puede validarse plenamente en Expo Go.** El widget y la reproducción sostenida en segundo plano dependen de código nativo que Expo Go no incluye o no configura. El entorno de referencia para este proyecto **es el Development Build**, exactamente como exige `RNF-005` del SRS («validación de funcionalidades avanzadas mediante Development Builds»).

Estado de alineación con SDK 58: **correcto**. `npx expo-doctor` reporta **20/20** comprobaciones aprobadas y las versiones instaladas coinciden con las recomendadas para SDK 58.

---

## 2. Matriz de compatibilidad por dependencia

Clasificación:

- 🟢 **Expo Go OK** — funciona en Expo Go sin configuración adicional.
- 🟡 **Expo Go parcial** — el módulo existe, pero la capacidad del producto requiere plugin/build.
- 🔴 **Solo Development Build** — módulo nativo ausente en Expo Go.
- ⚪ **Sin impacto en runtime** — herramienta de desarrollo o dependencia de build.
- ❓ **Sin confirmar** — no verificable con las fuentes disponibles.

| Paquete | Versión | Clase | Detalle verificado |
| --- | --- | --- | --- |
| `expo` | 58.0.25 | 🟢 | Base SDK 58 |
| `react` | 19.3.0 | 🟢 | — |
| `react-native` | 0.88.1 | 🟢 | — |
| `expo-router` | 58.0.31 | 🟢 | Rutas tipadas y tabs funcionan en Go |
| `expo-status-bar` | 58.0.5 | 🟢 | Usado en `_layout.tsx` |
| `expo-constants` | 58.0.16 | 🟢 | Usado para `appOwnership` |
| `expo-image` | 58.0.18 | 🟢 | Carátulas |
| `expo-file-system` | 58.0.13 | 🟢 | Lectura binaria de tags |
| `expo-sqlite` | 58.0.17 | 🟢 | Persistencia local |
| `expo-media-library` | 58.0.14 | 🟡 | El módulo está en Go, pero el permiso granular y la lectura de audio del dispositivo pueden comportarse distinto al manifest propio |
| `expo-audio` | 58.0.12 | 🟡 | Reproducción en Go sí; **servicio en primer plano y lock screen NO** (los aporta el plugin `enableBackgroundPlayback`) |
| `@expo/ui` | 58.0.28 | 🟢 | Documentación SDK 58: *Included in Expo Go* |
| `expo-widgets` | 58.0.28 | 🔴 | Documentación: *not available in the Expo Go app*. Requiere `enableAndroid` + `android.package` + prebuild |
| `expo-updates` | 58.0.22 | 🔴 | OTA no se evalúa en Expo Go; requiere build con `runtimeVersion` y canal |
| `expo-dev-client` | 58.0.20 | ⚪ | Es el cliente de desarrollo; no aplica a Go |
| `@expo/ngrok` | 4.1.3 | ⚪ | Túnel para `expo start --tunnel`; no entra al APK |
| `expo-splash-screen` | 58.0.14 | 🟡 | El módulo existe; el color/imagen configurados en `app.json` solo se aplican en build |
| `expo-web-browser` | 58.0.8 | ⚪ | Declarado como plugin y en dependencias; **no se importa en `src/`** |
| `expo-asset` | 58.0.20 | ⚪ | Declarado como plugin; **no se importa en `src/`** |
| `expo-font` | 58.0.11 | ⚪ | **Sin uso** (la app usa fuentes del sistema) |
| `expo-device` | 58.0.5 | ⚪ | **Sin uso** |
| `expo-system-ui` | 58.0.7 | ⚪ | **Sin uso** en `src/` |
| `expo-symbols` | 58.0.5 | ⚪ | **Sin uso**; peer opcional de `expo-router` |
| `expo-glass-effect` | 58.0.5 | ⚪ | **Sin uso**; además es dependencia directa de `expo-router` (se instala igual) |
| `expo-linking` | 58.0.17 | 🟢 | Peer **no opcional** de `expo-router`; se conserva |
| `react-native-screens` | 4.30.1 | 🟢 | Dependencia dura de `expo-router`; se conserva |
| `react-native-safe-area-context` | 5.11.1 | 🟢 | Usado directamente (3 importaciones) |
| `react-native-gesture-handler` | 3.3.0 | ⚪ | Peer **opcional** de `expo-router`; **sin uso** |
| `react-native-reanimated` | 4.7.1 | ⚪ | Peer **opcional**; **sin uso** |
| `react-native-worklets` | 0.13.0 | ⚪ | Peer **opcional** de Reanimated 4; **sin uso** |
| `react-native-web` + `react-dom` | 0.21.4 / 19.3.0 | ⚪ | Solo target web; peers opcionales de `expo-router` |
| `@expo/vector-icons` | 15.0.2 | 🟢 | 20 usos |
| `zustand` | 5.0.16 | 🟢 | JS puro |

> Corrección importante respecto de una lectura superficial de `package.json`: **`react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `expo-symbols`, `react-native-web`, `react-dom` y `@expo/ui` figuran como peers de `expo-router`**, aunque los seis primeros están marcados como **opcionales**. Es decir: no son «dependencias fantasma» en el sentido estricto, pero sí son **prescindibles** dado que el código no las usa. Ver el veredicto en `07-dependencies-and-tools.md`.

---

## 3. Plugins de configuración y su efecto real

`app.json` declara estos plugins:

| Plugin | Configuración | Efecto nativo | ¿Necesario? |
| --- | --- | --- | --- |
| `expo-router` | headers COEP/COOP | Solo web (SharedArrayBuffer para wasm) | ⚠️ Innecesario para un producto Android/iOS |
| `expo-splash-screen` | fondo `#0B0B0F`, icono 76 px | Splash nativo | ✅ Sí |
| `expo-media-library` | `granularPermissions: ["audio"]`, sin ubicación | Permisos de audio | ✅ Sí |
| `expo-audio` | `enableBackgroundPlayback: true`, sin micrófono | **Servicio `AudioControlsService`, `FOREGROUND_SERVICE*`**, `UIBackgroundModes audio` | ✅ **Crítico** |
| `expo-sqlite` | — | Módulo nativo | ✅ Sí |
| `expo-asset` | — | Sin assets empaquetados configurables | ❌ Prescindible |
| `expo-status-bar` | — | Sin efecto de plugin relevante | ⚠️ Prescindible como plugin |
| `expo-web-browser` | — | Ninguno usado | ❌ Prescindible |
| `expo-widgets` | `enableAndroid: true`, widget `MediaWidget` | Genera el `AppWidgetProvider` de Glance | ✅ Sí (para el widget) |

**Consecuencia funcional del plugin de `expo-audio`:** sin `enableBackgroundPlayback`, Android **no** declara `AudioControlsService` ni `FOREGROUND_SERVICE_MEDIA_PLAYBACK`. La documentación oficial de SDK 58 lo dice explícitamente: si no se habilitan los controles de pantalla de bloqueo mediante `setActiveForLockScreen`, **el audio se detiene a los ~3 minutos** en segundo plano. En Expo Go ese plugin no se aplica, así que el comportamiento en Go **nunca** representa al de producción.

---

## 4. Auditoría de permisos Android

Declarados en `app.json`:

| Permiso | ¿Lo usa el código? | Veredicto |
| --- | --- | --- |
| `READ_MEDIA_AUDIO` | Sí (escaneo) | ✅ Necesario (Android 13+) |
| `READ_EXTERNAL_STORAGE` | Sí, para Android ≤ 12 | ✅ Necesario como compatibilidad |
| `POST_NOTIFICATIONS` | Sí (`requestNotificationPermission`) | ✅ Necesario para la notificación de reproducción |
| `FOREGROUND_SERVICE` | Aportado también por el plugin de audio | ✅ Necesario |
| `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Aportado también por el plugin | ✅ Necesario |
| `MODIFY_AUDIO_SETTINGS` | No se manipula audio del sistema | ⚠️ Prescindible |
| `WRITE_EXTERNAL_STORAGE` | **No** (la app no escribe en almacenamiento externo) | ❌ **Eliminar**: viola `RNF-006` |
| `READ_MEDIA_VISUAL_USER_SELECTED` | **No** (es para imágenes/vídeo) | ❌ **Eliminar**: viola `RNF-006` |

Riesgo concreto: un revisor de Google Play puede cuestionar `WRITE_EXTERNAL_STORAGE` en una app que solo lee audio. Además, declarar permisos innecesarios aumenta la fricción en la instalación y contradice un requisito no funcional escrito.

---

## 5. Riesgos de compatibilidad y su estado

| ID | Riesgo | Estado | Evidencia |
| --- | --- | --- | --- |
| `A-02` | Widget ignorado en Expo Go | **Confirmado** | `expo-widgets` no está en Go; el código lo detecta con `requireOptionalNativeModule('ExpoWidgets')` y degrada a no-op |
| `C-01` | Audio se detiene a los ~3 min en Android si el lock screen no se activa | **Confirmado (documentación + código)** | El motor desactiva el lock screen para siempre tras el primer fallo |
| `M-08` | Permisos declarados de más | **Confirmado** | `app.json` |
| `M-09` | `runtimeVersion.policy: "appVersion"` + `version: 1.0.0` fija: cada OTA debe subir versión o no llegará | **Confirmado por configuración** | `app.json` |
| `R-01` | Diferencias de comportamiento de `expo-media-library` entre Go y build propio (permiso granular) | **Riesgo no verificado en dispositivo** | Requiere prueba manual |
| `R-02` | Widget en Android: `environment` solo expone `colorScheme` | **Confirmado por documentación** | El widget no lo usa → no adapta tema |
| `R-03` | `expo-widgets` en Android soporta un subconjunto de componentes/modificadores | **Confirmado** | El widget usa solo el subconjunto soportado (`Column`, `Row`, `Text`, `Button`, `Image`, `LinearProgressIndicator`, `background`, `cornerRadius`, `fillMaxWidth`, `height`, `padding`, `size`) |
| `R-04` | Target web declarado (`web.output: static`, `.web.tsx`, `react-native-web`) pero sin validación | **Riesgo** | No hay pruebas ni build web documentado |

---

## 6. Qué se puede y qué no se puede probar en cada entorno

| Capacidad | Expo Go | Development Build | Producción |
| --- | --- | --- | --- |
| Navegación y pantallas | ✅ | ✅ | ✅ |
| Escaneo de biblioteca | ✅ (limitado) | ✅ | ✅ |
| SQLite | ✅ | ✅ | ✅ |
| Reproducción en primer plano | ✅ | ✅ | ✅ |
| Cola / aleatorio / repetición | ✅ | ✅ | ✅ |
| Notificación con controles | ❌ | ✅ | ✅ |
| Pantalla de bloqueo | ❌ | ✅ | ✅ |
| Reproducción sostenida en segundo plano | ❌ (~3 min) | ✅ | ✅ |
| Widget de pantalla de inicio | ❌ | ✅ | ✅ |
| OTA | ❌ | ⚠️ con canal | ✅ |
| Permisos exactos de producción | ❌ | ✅ | ✅ |

**Recomendación operativa:** usar Expo Go solo para iterar UI y lógica de dominio. **Toda** validación de `RF-002` (reproducción en segundo plano, notificación, pantalla de bloqueo, widget) debe hacerse en Development Build sobre un dispositivo físico.

---

## 7. Limitaciones de esta auditoría

| Recurso | Estado |
| --- | --- |
| Expo MCP | ❌ No expuesto en el entorno de ejecución. Sustituido por documentación oficial versionada vía `webfetch` |
| GitHub MCP | ❌ No expuesto. No se pudieron revisar issues/PRs del repositorio de Expo ni del proyecto |
| Skills de Expo | ⚠️ 44 skills declarados en `skills-lock.json` y presentes en disco (`.agents/skills`, `.claude/skills`), pero solo 4 skills están registrados como herramienta en esta sesión (`context7-mcp`, `find-skills`, `opencode`, `report`) |
| Dispositivo físico / emulador | ❌ No disponible en esta auditoría. Las pruebas de runtime nativo quedan pendientes y se reflejan como criterio de salida en la fase correspondiente |
| Context7 | ✅ Parcial: funcionó con `/websites/expo_dev_versions_sdk`; falló para consultas de audio con el ID versionado `/expo/expo/expo_58.0.22` |

Ninguna conclusión de este informe se basa en una herramienta que no estuviera disponible: cuando no se pudo verificar algo, se marca como **riesgo** o **sin confirmar**.
