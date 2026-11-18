# Historial de cambios

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
versionado sigue [Versionado semántico](https://semver.org/lang/es/).

El detalle de ejecución por fases (problemas, archivos, criterios de salida y
verificación en dispositivo) vive en
[`docs/audit/06-development-roadmap.md`](docs/audit/06-development-roadmap.md).

## [Sin publicar]

Fases 1 a 5.2 de la hoja de ruta (aún sin versión publicada; `app.json` sigue en
`1.0.0` y se sella al publicar en FASE 8).

### Añadido

- **Gestión de la biblioteca (FASE 5.2):** editar el título, el artista y el álbum
  de una pista (corrección local, no reescribe el archivo) y eliminarla — quitarla
  de la biblioteca sin tocar el archivo o borrarla del dispositivo — desde el menú
  de cada pista, con **selección múltiple** (pulsación larga) en Canciones, álbum,
  artista y playlist. Incluye renombrar un álbum (con fusión si ya existe) y una
  válvula de seguridad en Ajustes («Restaurar pistas quitadas»).
- **Carátulas ausentes (FASE 5.1):** lectura de arte embebido y etiquetas de texto
  en **FLAC** (`PICTURE` y `VORBIS_COMMENT`), con arte de carpeta (`cover.jpg`,
  `folder.png`…) como respaldo y barrido de pistas ya guardadas sin portada
  (columna `songs.artwork_checked_at`, migración **V7**), automático una vez por
  pista y manual con `force` desde Ajustes («Buscar carátulas faltantes»).
- Firmas de imagen reconocidas ampliadas a **WebP** y **GIF** (además de JPEG y PNG).
- **Notificaciones, pantalla de bloqueo y widget (FASE 5):** tema coherente,
  controles del sistema fiables, metadatos correctos y honestidad sobre lo que el
  widget puede hacer; permiso contextual.
- **Sesión de reproducción persistente (FASE 4):** restauración sin auto-play,
  máquina de estados completa y control de volumen.
- **Biblioteca (FASE 3):** escaneo como pipeline por fases, incremental y
  observable, con persistencia por lotes y poda lógica.
- **Arquitectura (FASE 2):** capacidades del entorno y canal de avisos.

### Cambiado

- `MAX_ATTEMPTS_PER_ALBUM` sube de 2 a **5** en la resolución de portada: en discos
  donde la primera pista no trae arte ya no se rinde tan pronto.
- `upsertBatch` conserva la portada previa (`COALESCE`) para no perderla si una
  extracción falla.

### Corregido

- Los **FLAC** dejaban de leerse por completo (arte y etiquetas): cada archivo
  quedaba como «Archivo» en «Sin álbum» y fragmentaba el álbum.
- Las pistas guardadas antes de saber leer FLAC o arte de carpeta quedaban con
  `artwork_uri = null` para siempre: el escaneo incremental no las volvía a tocar.
- **ANR** al publicar miles de pistas en la cola, resuelto con una ventana de cola
  y sin pausar la reproducción al recentrar.
- Tiempos del widget: etiqueta centrada, soporte de horas y avance del reloj cada
  **1 s** (antes cada 5).
- Pantalla de bloqueo con reintentos y escaneo completo sin tope (FASE 1).

### Eliminado

- `audio-engine.ts`: repartido en módulos con una sola responsabilidad (FASE 2) y
  eliminado al cerrar la FASE 4.
- Dependencias y permisos innecesarios (FASE 2).

### Notas

- Limitaciones conocidas y diferidas de la FASE 5.2: la corrección de metadatos es
  local (no reescribe las etiquetas del archivo), el modo selección solo elimina y
  borrar el archivo en Android 10 o anterior fallará por el permiso de escritura
  bloqueado (se avisa en pantalla).
- Limitaciones conocidas y diferidas de la FASE 5.1: arte embebido en **OGG/OPUS**,
  **BMP** como portada y agrupación de recopilatorios multi-artista.

## [1.0.1] - 2026-11-12

### Añadido

- Índice alfabético compartido (`AlphabetBar`) anclado al borde derecho en Canciones
  y Audiolibros.
- Scrollbar temático con carril propio en Canciones, Audiolibros, Álbumes y Cola.
- Mini-reproductor anclado a la tab bar y mejoras en la fila de canción.
- Actualizaciones OTA.

### Corregido

- Carga robusta de la mediateca y selecciones puras de biblioteca.
- «Ver todo» ya no se corta en los encabezados de sección.

### Rendimiento

- Sincronización de arranque silenciosa e incremental.

## [1.0.0] - 2026-11-11

### Añadido

- Biblioteca local de canciones, álbumes, artistas y audiolibros.
- Reproductor completo y minimizado, con aleatorio, repetición y cola.
- Notificación de reproducción con carátula y controles.
- Controles en la pantalla de bloqueo mediante una sesión de medios (Media3).
- Widget de pantalla de inicio con portada, título, artista, progreso y controles.
- Favoritos, playlists manuales y automáticas, historial y contadores.
- Búsqueda, filtros y ordenamientos.
- Temas claro y oscuro, configuración y registro local de errores.
- Funcionamiento sin conexión a Internet.

### Rendimiento

- Optimizaciones generales y carga de carátulas embebidas.

[Sin publicar]: https://github.com/daniel2000x0/music-player/compare/v.1.0.1...HEAD
[1.0.1]: https://github.com/daniel2000x0/music-player/compare/v1.0.0...v.1.0.1
[1.0.0]: https://github.com/daniel2000x0/music-player/releases/tag/v1.0.0
