# Mi Música

Reproductor y administrador de música local para Android, construido con React Native, Expo y TypeScript. Lee la mediateca del dispositivo, guarda la información administrativa en SQLite y permite reproducir, organizar y buscar canciones sin conexión.

## Funcionalidades

- Biblioteca local de canciones, álbumes, artistas y audiolibros.
- Reproductor completo y minimizado con barra de progreso, búsqueda de posición, aleatorio, repetición y cola.
- Notificación de reproducción con carátula y controles anterior/pausar/siguiente.
- Controles en la pantalla de bloqueo mediante una sesión de medios (Media3).
- Widget de pantalla de inicio con portada, título, artista, barra de progreso, tiempos y controles.
- Favoritos, playlists manuales y automáticas, historial y contadores de reproducción.
- Búsqueda, filtros y ordenamientos.
- Temas claro y oscuro, configuración y registro local de errores.
- Letras incrustadas en MP3/MP4/FLAC: vista previa bajo la carátula y lectura completa al tocarla.
- Funciona sin conexión a Internet.

## Requisitos

- Node.js 22.13 o superior (el proyecto fija `engines` en `package.json`).
- Un dispositivo o emulador Android.
- Para las funciones nativas (reproducción en segundo plano, pantalla de bloqueo y widget), un Development Build o una compilación standalone. **Expo Go no las incluye**: allí el widget y la sesión de medios se desactivan automáticamente.

## Puesta en marcha

```bash
npm install
npx expo start
```

> Como el proyecto incluye `expo-dev-client`, `npx expo start` genera el QR
> para un **Development Build** (`exp+mi-music-player://`). Para probar en
> **Expo Go** hay que forzar el modo Go: `npx expo start --go` (o
> `npm run start:go`). Si se escanea el QR de development build con Expo Go,
> la app se queda en el splash blanco con «Music» y no entra.

Comandos útiles:

```bash
npx tsc --noEmit          # verificación de tipos
npx expo lint             # lint
npx jest                  # pruebas
npx jest --coverage       # pruebas con umbrales de cobertura
npm run bench             # benchmarks de dominio, escaneo y listas
npx expo-doctor           # diagnóstico de dependencias y configuración
npm run verify            # los cuatro comandos anteriores en una sola pasada
```

El guion de verificación en dispositivo, los umbrales de cobertura y la
política de `runtimeVersion` están en [`docs/TESTING.md`](docs/TESTING.md).
El workflow `.github/workflows/ci.yml` ejecuta tipado, lint, pruebas y
`expo-doctor` en cada push y pull request.

## Compilación

El proyecto usa EAS. El perfil `production` genera el APK instalable y firmado:

```bash
npm run build:apk
# equivalente: npx eas-cli@latest build -p android --profile production --non-interactive --wait
```

El procedimiento completo, prerrequisitos y la alternativa local están en
[`docs/EAS_APK.md`](docs/EAS_APK.md).

Los cambios de `app.json` (plugins, permisos, icono, configuración del widget)
requieren una compilación nueva; no se pueden aplicar con una actualización OTA.

## Estructura

- `src/app/`: rutas de Expo Router (pantallas y layouts).
- `src/components/`: componentes de interfaz; `audio-bridge-inner.tsx` conecta el motor con los stores y el widget.
- `src/services/`: acceso a la mediateca, motor de audio (`expo-audio`), portadas, persistencia y sincronización del widget.
- `src/stores/`: estado con Zustand (biblioteca, reproductor, ajustes) y el progreso aislado en `playback-progress.ts`.
- `src/widgets/`: contrato y layout del widget de pantalla de inicio (`expo-widgets` + `@expo/ui`).
- `src/domain/`: lógica pura (metadatos, filtros, ordenamientos, playlists automáticas).
- `docs/requirements/`: alcance, SRS, historias de usuario y casos de uso.

## Documentación

- [Alcance](docs/requirements/scope.md)
- [SRS](docs/requirements/SRS.md)
- [Historias de usuario](docs/requirements/user-stories.md)
- [Casos de uso](docs/requirements/uses-cases.md)
- [Guion de verificación](docs/TESTING.md)
- [Compilación de APK con EAS](docs/EAS_APK.md)
- [Historial de cambios](CHANGELOG.md)
