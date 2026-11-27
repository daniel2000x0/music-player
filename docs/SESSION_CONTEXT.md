# SESSION_CONTEXT — mi-music-player

> Estado verificado el 2026-11-27 con `git status`, `git log`, lectura del código,
> `npm run verify` y documentación de EAS. Continuidad de sesión: **no modifica
> código fuente**. El detalle cronológico está en [`CHANGELOG.md`](../CHANGELOG.md).

## 1. Objetivo y estado

Reproductor de música local (Expo SDK ~58, RN 0.88, Expo Router, TypeScript,
Zustand, SQLite) con temas visuales, iconos propios, widget y builds Android.
La tanda de cambios de 2026-11-26/27 quedó **publicada en GitHub** y verificada
en local. Falta únicamente el APK firmado por EAS, bloqueado por cupo hasta el
2026-12-01.

## 2. Git

```
Rama:   master
Remoto: origin  https://github.com/daniel2000x0/music-player.git
HEAD:   commit de publicación de esta tanda (ver `git log -1`)
Base:   14948ea fix: iconos de temas claro/oscuro y assets Hunger Games
```

Se publicaron versión de código, documentación y pruebas. Se excluyeron
deliberadamente los artefactos locales de herramientas (`.agents/`,
`.claude/skills/`, `agent/`, `opencode.json`, `skills-lock.json`, `my-expo-app/`),
ahora ignorados en `.gitignore`.

## 3. Cambios publicados

| Área | Resumen |
|---|---|
| Letras | Extracción `USLT`/`ULT`/`SYLT`/`SLT`, `©lyr` y comentarios Vorbis; `cleanLyrics()` (8 000 chars); migración V13 `songs.lyrics`. |
| Reproductor | `LyricsSheet` (completa) e `InlineLyrics` (vista previa fija bajo la carátula, 2 líneas / 1 en pantallas cortas). La carátula se reduce el mismo alto para no mover controles. |
| Reubicación | `content_key`, `matchRelocations`, `remapArtworkUri`, `relocateSong`, backfill y disparadores AppState/MediaStore. |
| Estabilidad | `migrationPromise` deduplicado en `migrateLegacyLibrary()`; test que reproduce la transacción anidada real de SQLite; chunk de upsert de 50 → 45 filas. |
| Tema / assets | Acento Oscuro `#FF3D1F`; `defaultLogo.png` sustituye a `app-icon.svg` y `defaultLogo.jpg`. |
| Carátulas | Placeholder del tema, firma validada, recuperación legacy por `mediaId`, prefijos lazy para SSR. |
| Herramientas | `npm run verify` y `npm run build:apk`; guion en [`docs/EAS_APK.md`](EAS_APK.md). |

## 4. Decisiones vigentes

1. **Letras planas (Opción A)**: texto sin sincronización; descartadas SYLT/LRC
   karaoke y archivos `.lrc` sidecar. `cleanText()` no se usa nunca para letras
   porque colapsa saltos de línea.
2. **Sin librerías nuevas** para la extracción: se reutilizan los parsers de
   bytes ya existentes sobre `expo-file-system`.
3. **Development build obligatorio**: Expo Go 58.0.5 no incluye `expo-sqlite`.
   El dev client instalado es `com.abelo.mimusicplayer`.
4. **Widget con glifos Unicode**: `expo-widgets` no soporta `IconView`.
5. **APK de producción con EAS**, perfil `production` (ya configurado con
   `buildType: apk`); el build local solo sirve para pruebas y queda firmado con
   debug.
6. **Responder y documentar en español**; usar `npx` (no `bunx`).
7. **No editar `android/` ni `ios/` a mano**: son carpetas generadas
   (Continuous Native Generation); configurar en `app.json`/plugins.
8. **Compuerta de publicación**: no `eas update`, `eas build` ni release sin
   autorización. La autorización actual cubre solo el commit/push de esta tanda.

## 5. Verificación

`npm run verify` (equivalente a los cuatro comandos obligatorios):

- `npx tsc --noEmit` ✅
- `npx expo lint` ✅ sin avisos
- `npx jest --runInBand --silent` ✅ **81 suites / 760 pruebas**
- `npx expo-doctor` ✅ **20/20**

## 6. Pendiente

1. **APK firmado**: ejecutar `npm run build:apk` cuando se reinicie el cupo de
   `abeladoor` (2026-12-01). Procedimiento completo en
   [`docs/EAS_APK.md`](EAS_APK.md). El intento del 2026-11-26 incrementó el
   `versionCode` de 8 a 9 en el servidor; verificar el número final.
2. **En dispositivo**: relanzar Metro con `npx expo start --dev-client`, abrir el
   dev client y ejecutar **Volver a escanear** para poblar `songs.lyrics` en la
   biblioteca existente. Después validar la vista previa, la hoja completa y el
   acento `#FF3D1F`.
3. **Carátulas**: vigilar `E/ExpoImage ... FileNotFoundException` al desplazar
   listas; ruido previo a ignorar salvo que aparezca en el stack de la app.

## 7. Reglas que no romper

- `collectInitials` y `scrollToLetter` deben usar la misma clave (`initialKey`).
- Los tests que importan `constants/theme` necesitan
  `jest.mock('@/global.css', () => ({}))` (Metro transforma el CSS; Jest no).
- Los cambios en `app.json` (icono, plugins, permisos) son nativos: no se aplican
  por OTA, exigen build nuevo y reinstalación.
- Antes de dar por terminada cualquier tarea: `npm run verify`.
- No borrar ni publicar archivos sin trackear sin confirmación.

## 8. Referencias

- [`CHANGELOG.md`](../CHANGELOG.md) — detalle de todos los cambios.
- [`docs/TESTING.md`](TESTING.md) — guion de verificación manual y cobertura.
- [`docs/EAS_APK.md`](EAS_APK.md) — build de producción y reintento.
- [`docs/audit/06-development-roadmap.md`](audit/06-development-roadmap.md) —
  ejecución por fases.
- Memoria Engram: `#70` (letras e vista previa), resumen `#71` (tanda de letras).

---

**Estado en una frase:** código publicado y verificado; dev build funcional;
APK de producción preparado para generarse en cuanto EAS tenga cupo (2026-12-01).
