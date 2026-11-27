/**
 * Capa de internacionalización de la app (ES / EN).
 *
 * Diseño deliberadamente simple y sin dependencias nativas:
 * - ESPAÑOL es el idioma fuente. Las claves del diccionario `EN` son los
 *   propios textos españoles, así que `tr('Canciones')` devuelve "Songs"
 *   en inglés y "Canciones" en español. TypeScript comprueba que la clave
 *   exista (`LiteralKey`), evitando traducciones huérfanas.
 * - Los textos con variables usan `t(clave, params)` (ver `TEMPLATES`),
 *   con interpolación `{nombre}` y plurales mediante `Intl.PluralRules`
 *   cuando el motor lo trae; si no (Hermes de Expo Go), se usa un fallback
 *   `one`/`other` para que la UI nunca se caiga.
 *
 * Todo esto es JavaScript puro: el cambio de idioma funciona en un OTA y
 * no obliga a generar un nuevo APK. El idioma se elige en Ajustes y se
 * persiste junto al tema en `app_settings` (ver `settings.repository`).
 */

export const APP_LANGUAGES = ['es', 'en'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

/** Español por defecto: la app nació en español y evita depender de un módulo nativo. */
export const DEFAULT_LANGUAGE: AppLanguage = 'es';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return APP_LANGUAGES.includes(value as AppLanguage);
}

/** Traducciones de literales fijos. Clave = texto español tal cual aparece en la UI. */
export const EN = {
  'Con letras': 'With lyrics',
  'Abre la pantalla completa del reproductor.': 'Open the full player screen.',
  'Abre las opciones Todas, Favoritos, Con letras, Escuchadas y Sin reproducir':
    'Opens All, Favorites, With lyrics, Played and Unplayed options',
  'Abre las opciones Todas, Favoritos, Escuchadas y Sin reproducir':
    'Opens All, Favorites, Played and Unplayed options',
  'Abre las opciones Lista, Compacto e Iconos pequeños':
    'Opens List, Compact and Small icons options',
  'Abrir ajustes': 'Open settings',
  'Abrir ajustes del sistema': 'Open system settings',
  'Acerca de': 'About',
  'Actualización descargada': 'Update downloaded',
  'Actualización descargada. Reinicia la app para aplicarla.':
    'Update downloaded. Restart the app to apply it.',
  'Al cambiar el icono del launcher, Android puede cerrar la aplicación. Si ocurre, ábrela de nuevo desde el icono nuevo. ¿Quieres continuar?':
    'Changing the launcher icon may cause Android to close the app. If that happens, open it again from the new icon. Do you want to continue?',
  'Actualización disponible': 'Update available',
  'Actualización disponible. Puedes instalarla más tarde.':
    'Update available. You can install it later.',
  'Actualizar biblioteca': 'Refresh library',
  'Agrega archivos de audio al dispositivo y vuelve a escanear para detectar audiolibros.':
    'Add audio files to the device and scan again to detect audiobooks.',
  'Agrega canciones desde el menú de cada pista.': "Add songs from each track's menu.",
  'Agregados recientemente': 'Recently added',
  'Agregar a playlist': 'Add to playlist',
  'Agregar como audiolibro': 'Add as audiobook',
  'Agrupación por álbum/carpeta': 'Album/folder grouping',
  'Álbum': 'Album',
  'Álbum no encontrado': 'Album not found',
  'Álbumes': 'Albums',
  'álbumes': 'albums',
  'Álbumes recientes': 'Recent albums',
  'Apariencia': 'Appearance',
  'Apariencia y administración de la biblioteca': 'Appearance and library management',
  'Artista': 'Artist',
  'Artistas': 'Artists',
  'Artista (A-Z)': 'Artist (A-Z)',
  'Artista (Z-A)': 'Artist (Z-A)',
  'Artista no encontrado': 'Artist not found',
  'Audiolibros': 'Audiobooks',
  'audiolibros': 'audiobooks',
  'Audiolibros sin álbum': 'Audiobooks without album',
  'Automáticas': 'Automatic',
  'Ajustes': 'Settings',
  'Bajar en la lista': 'Move down',
  'Biblioteca': 'Library',
  'Borrar': 'Delete',
  'Borrar datos administrativos': 'Clear administrative data',
  'Borrar del dispositivo': 'Delete from device',
  'Borrar registro': 'Clear log',
  'Borrar todo': 'Delete all',
  'Buscando carátulas…': 'Searching for artwork…',
  'Buscar': 'Search',
  'Buscar actualizaciones': 'Check for updates',
  'Buscar actualizaci?n APK': 'Check APK update',
  'Actualizaci?n APK': 'APK update',
  'Notas de la versi?n': 'Release notes',
  'Descargar APK': 'Download APK',
  'Letras': 'Lyrics',
  'Ver letras': 'View lyrics',
  'Esta canción no tiene letras incrustadas.': 'This song has no embedded lyrics.',
  'Instalar APK': 'Install APK',
  'Descargando actualizaci?n?': 'Downloading update?',
  'Verificando descarga?': 'Verifying download?',
  'Abrir p?gina de descarga': 'Open download page',
  'No se encontr? un APK en la ?ltima release.': 'No APK was found in the latest release.',
  'No se pudo consultar GitHub Releases.': "Couldn't check GitHub Releases.",
  'La descarga del APK no est? disponible en Expo Go. Usa una build instalada para instalar actualizaciones.': 'APK download is not available in Expo Go. Use an installed build to install updates.',
  'La instalaci?n autom?tica no est? disponible en este entorno. Se abri? la descarga para que puedas instalarla manualmente.': 'Automatic installation is not available in this environment. The download was opened so you can install it manually.',
  'APK descargado. Confirma la instalaci?n en Android.': 'APK downloaded. Confirm installation on Android.',
  'La versi?n instalada es m?s reciente o igual a la ?ltima release.': 'Installed version is newer than or equal to the latest release.',
  'Versi?n instalada': 'Installed version',
  '?ltima versi?n': 'Latest version',
  'Tama?o': 'Size',
  'Fuente': 'Source',
  'Buscar audiolibros': 'Search audiobooks',
  'Buscar álbumes o artistas': 'Search albums or artists',
  'Buscar carátulas faltantes': 'Find missing artwork',
  'Buscar por título, artista o álbum': 'Search by title, artist or album',
  'Búsqueda terminada': 'Search finished',
  'Cancelar': 'Cancel',
  'Cambiar tema': 'Change theme',
  'Canción': 'Song',
  'Canciones': 'Songs',
  'canciones': 'songs',
  'Canciones que aún no escuchaste': "Songs you haven't played yet",
  'Cambia el nombre en todas sus pistas.': 'Renames all its tracks.',
  'Cargando contenido': 'Loading content',
  'Cerrar': 'Close',
  'Cola de reproducción': 'Playback queue',
  'Cola vacía': 'Empty queue',
  'Concede permiso de audio para administrar tus playlists.':
    'Grant audio permission to manage your playlists.',
  'Concede permiso de audio para detectar audiolibros.':
    'Grant audio permission to detect audiobooks.',
  'Concede permiso de audio para escanear las canciones de tu dispositivo.':
    'Grant audio permission to scan songs on your device.',
  'Concede permiso de audio para ver tus álbumes.': 'Grant audio permission to see your albums.',
  'Concede permiso de audio para ver tus canciones.': 'Grant audio permission to see your songs.',
  'Conceder permiso': 'Grant permission',
  'Configuración': 'Settings',
  'Controles del sistema': 'System controls',
  'Controles en la pantalla de bloqueo': 'Lock screen controls',
  'Corrige el título, el artista o el álbum solo en esta app.':
    'Correct the title, artist or album in this app only.',
  'Crea una playlist y agrega tus canciones favoritas.':
    'Create a playlist and add your favorite songs.',
  'Crear playlist': 'Create playlist',
  'Crear playlist y agregar la canción': 'Create playlist and add the song',
  'Datos': 'Data',
  'Deja de mostrarse en la app. El archivo permanece en el dispositivo.':
    'It stops showing in the app. The file stays on the device.',
  'Descartar aviso': 'Dismiss notice',
  'Después': 'Later',
  'Diagnóstico': 'Diagnostics',
  'Duración': 'Duration',
  'Editar información': 'Edit info',
  'El icono puede cerrar la app': 'The icon change may close the app',
  'El tema se aplicó, pero el sistema no permitió cambiar el icono.':
    'Theme applied, but the system did not allow changing the icon.',
  'El tema se aplicó. Cambiar el icono requiere una build de desarrollo/EAS; Expo Go no incluye ese módulo nativo.':
    'Theme applied. Changing the icon requires a development/EAS build; Expo Go does not include that native module.',
  'Elimina el archivo del almacenamiento. No se puede deshacer.':
    'Deletes the file from storage. This cannot be undone.',
  'Eliminar': 'Delete',
  'Eliminar álbum': 'Delete album',
  'Eliminar playlist': 'Delete playlist',
  'Eliminar selección': 'Delete selection',
  'Escaneo incremental': 'Incremental scan',
  'Escanear de nuevo': 'Scan again',
  'Español': 'Spanish',
  'Esta lista se llenará a medida que uses la aplicación.':
    'This list will fill up as you use the app.',
  'Este álbum no tiene pistas disponibles.': 'This album has no available tracks.',
  'Este artista no tiene pistas disponibles.': 'This artist has no available tracks.',
  'Este entorno no admite controles del sistema. La reproducción puede detenerse en segundo plano.':
    'This environment does not support system controls. Playback may stop in the background.',
  'Estilo de visualización': 'View style',
  'Favoritos': 'Favorites',
  'Favoritos, playlists, historial y estadísticas.': 'Favorites, playlists, history and stats.',
  'Filtrar canciones por vista': 'Filter songs by view',
  'Hay una nueva versión del reproductor. ¿Deseas descargarla ahora?':
    'A new version of the player is available. Download it now?',
  'Icono del launcher no disponible': 'Launcher icon unavailable',
  'Idioma': 'Language',
  'Incluye esta canción en una playlist existente o nueva.':
    'Add this song to an existing or new playlist.',
  'Inicio': 'Home',
  'Ir a canciones con números u otros caracteres': 'Go to songs with numbers or other characters',
  'La actualización está lista. Reinicia la aplicación para aplicar los cambios.':
    'Update ready. Restart the app to apply the changes.',
  'La actualización está lista. Reinicia la aplicación para aplicarla.':
    'Update ready. Restart the app to apply it.',
  'Las actualizaciones OTA no están disponibles en este entorno.':
    'OTA updates are not available in this environment.',
  'Las actualizaciones OTA no están disponibles en la versión web.':
    'OTA updates are not available in the web version.',
  'Las canciones de tu dispositivo se agruparán por carpeta de álbum.':
    'Songs on your device will be grouped by album folder.',
  'Las canciones que marcaste': 'Songs you marked',
  'Las notificaciones están desactivadas: los controles de reproducción no aparecerán en la pantalla de bloqueo.':
    "Notifications are off: playback controls won't appear on the lock screen.",
  'Las playlists automáticas y las tuyas necesitan canciones en el dispositivo. Agrega música y vuelve a escanear.':
    'Automatic and your playlists need songs on the device. Add music and scan again.',
  'Lectura de la mediateca': 'Media library access',
  'Limpiar filtros': 'Clear filters',
  'Lo último que llegó a tu biblioteca': 'The latest additions to your library',
  'Los controles del sistema no están disponibles. La reproducción puede detenerse en segundo plano.':
    'System controls are not available. Playback may stop in the background.',
  'Más antiguas': 'Oldest',
  'Más canciones': 'Most songs',
  'Más escuchadas': 'Most played',
  'Más opciones': 'More options',
  'Más recientes': 'Newest',
  'Más tarde': 'Later',
  'Mayor duración': 'Longest duration',
  'Mostrar canciones': 'Show songs',
  'Mi Música': 'My Music',
  'Nada en reproducción': 'Nothing playing',
  'Necesario para leer la música almacenada.': 'Required to read stored music.',
  'No hay álbumes que coincidan.': 'No matching albums.',
  'No hay audiolibros que coincidan.': 'No matching audiobooks.',
  'No se borraron los archivos': "Files weren't deleted",
  'No se encontraron archivos de audio en este dispositivo. Copia música y vuelve a escanear.':
    'No audio files found on this device. Copy music and scan again.',
  'No se encontraron carátulas nuevas en los archivos revisados.':
    'No new artwork found in the scanned files.',
  'No se han registrado errores ni advertencias con este filtro.':
    'No errors or warnings logged with this filter.',
  'No se pudo descargar la actualización. Inténtalo nuevamente.':
    "Couldn't download the update. Try again.",
  'No se pudo descargar una nueva actualización.': "Couldn't download a new update.",
  'No se pudo leer tu música': "Couldn't read your music",
  'Nombre (A-Z)': 'Name (A-Z)',
  'Nombre (Z-A)': 'Name (Z-A)',
  'Nombre de la playlist': 'Playlist name',
  'Nombre del álbum': 'Album name',
  'Notificaciones de reproducción': 'Playback notifications',
  'Notificaciones desactivadas': 'Notifications off',
  'Nueva playlist': 'New playlist',
  'Opciones de canción': 'Song options',
  'Opciones de audiolibro': 'Audiobook options',
  'Opciones del álbum': 'Album options',
  'Ordenar álbumes': 'Sort albums',
  'Ordenar canciones': 'Sort songs',
  'Ordenar playlists': 'Sort playlists',
  'Pista sin título': 'Untitled track',
  'Playlist no encontrada': 'Playlist not found',
  'Playlist vacía': 'Empty playlist',
  'Playlists': 'Playlists',
  'playlists': 'playlists',
  'Posición de reproducción': 'Playback position',
  'Puede que hayas eliminado esta playlist.': 'You may have deleted this playlist.',
  'Puede que ya no esté en tu biblioteca.': 'It may no longer be in your library.',
  'Quita o borra todas sus pistas a la vez.': 'Remove or delete all its tracks at once.',
  'Quitar de la biblioteca': 'Remove from library',
  'Quítala de la biblioteca o bórrala del dispositivo.':
    'Remove it from the library or delete it from the device.',
  'Quitar de la playlist': 'Remove from playlist',
  'Registro de errores': 'Error log',
  'Remover de audiolibros': 'Remove from audiobooks',
  'Renombrar': 'Rename',
  'Renombrar playlist': 'Rename playlist',
  'Playlist': 'Playlist',
  'Crear': 'Create',
  'Nueva': 'New',
  'Renombrar álbum': 'Rename album',
  'Reproducción en segundo plano': 'Background playback',
  'Reproduce una canción para llenar la cola.': 'Play a song to fill the queue.',
  'Reproducir a continuación': 'Play next',
  'Reproducir o pausar': 'Play or pause',
  'Reproducir playlist': 'Play playlist',
  'Reproducir todo': 'Play all',
  'Reintentar': 'Retry',
  'No hay canciones en este filtro.': 'No songs in this filter.',
  'Reinicia contadores e historial, conserva playlists.':
    'Resets counters and history, keeps playlists.',
  'Reiniciar ahora': 'Restart now',
  'Relee la portada de las canciones que no la muestran (FLAC incluidos).':
    'Re-reads artwork for songs without it (FLAC included).',
  'Se eliminarán favoritos, playlists, historial y estadísticas. Los archivos de audio del dispositivo no se borran.':
    'Favorites, playlists, history and stats will be deleted. Audio files on the device are not removed.',
  'Se eliminarán las reproducciones recientes y los contadores de escucha. Tus canciones y playlists se conservan.':
    'Recent plays and play counts will be deleted. Your songs and playlists are kept.',
  'Se eliminarán todos los errores y advertencias guardados.':
    'All saved errors and warnings will be deleted.',
  'Se oculta de Canciones y aparece en la pestaña Audiolibros.':
    "It's hidden from Songs and appears in the Audiobooks tab.",
  'Se quitarán las canciones pendientes. La actual seguirá sonando.':
    'Pending songs will be removed. The current one keeps playing.',
  'Se volverán a leer las canciones que no muestran portada y a restaurar las portadas borradas de la caché, incluidos los FLAC y las carpetas con cover.jpg. Puede tardar unos minutos.':
    'Songs without artwork will be read again and cached covers restored, including FLAC and folders with cover.jpg. This may take a few minutes.',
  'Seleccionar todo': 'Select all',
  'Sin acceso a tu música': 'No access to your music',
  'Sin álbum': 'No album',
  'Sin álbumes': 'No albums',
  'Sin audiolibros': 'No audiobooks',
  'Marca canciones desde su menú de opciones o deja que el escaneo detecte contenido largo.':
    'Mark songs from their options menu or let the scan detect long content.',
  'Sin canciones': 'No songs',
  'Sin notificaciones, los controles del sistema no aparecerán. Actívalas en los ajustes del sistema.':
    'Without notifications, system controls will not appear. Enable them in system settings.',
  'Sin playlists': 'No playlists',
  'Sin resultados': 'No results',
  'Sin reproducir': 'Unplayed',
  'Sin sucesos': 'No events',
  'Subir en la lista': 'Move up',
  'Sus capítulos vuelven a aparecer en la pestaña Canciones.':
    'Its chapters appear again in the Songs tab.',
  'Tema de la aplicación': 'App theme',
  'Título': 'Title',
  'Título (A-Z)': 'Title (A-Z)',
  'Título (Z-A)': 'Title (Z-A)',
  'Todas': 'All',
  'Todas las canciones ya tienen carátula o ya se revisaron.':
    'All songs already have artwork or were already checked.',
  'Tu biblioteca está vacía': 'Your library is empty',
  'Tu historial reciente': 'Your recent history',
  'Tus canciones aparecerán agrupadas aquí.': 'Your songs will appear grouped here.',
  'Tus canciones con más reproducciones': 'Your most played songs',
  'Tus playlists': 'Your playlists',
  'Última reproducción': 'Last played',
  'Últimas reproducidas': 'Recently played',
  'Una selección al azar': 'A random selection',
  'Vaciar cola': 'Clear queue',
  'Ver todo': 'See all',
  'Widget de pantalla de inicio': 'Home screen widget',
  'Ya tienes la ?ltima versi?n instalada.': 'You already have the latest version installed.',
  'Agregadas': 'Added',
  'Reproducciones': 'Plays',
  'Escuchadas': 'Played',
  'Guardar': 'Save',
  'Aceptar': 'OK',
  'Deshacer': 'Undo',
  'Lista': 'List',
  'Compacto': 'Compact',
  'Iconos pequeños': 'Small icons',
  '3 columnas': '3 columns',
  '4 columnas': '4 columns',
  'Una fila por elemento': 'One row per item',
  'FLAC · Alta calidad': 'FLAC · High quality',
  'Formato FLAC, alta calidad': 'FLAC format, high quality',
  'English': 'English',
  'Inglés': 'English',
  'España': 'Spain',
  'No se pudieron consultar las actualizaciones.': "Couldn't check for updates.",
  'Error al descargar la actualizaci?n.': 'Error downloading the update.',
  'Error al instalar la actualizaci?n.': 'Error installing the update.',
  'Buscando actualizaciones...': 'Checking for updates...',
  'Consulta si hay novedades disponibles': 'Check for available updates',
  'No disponible en Expo Go ni en modo desarrollo.': 'Unavailable in Expo Go or development mode.',
  'Descargar': 'Download',
  'Despu?s': 'Later',
  'Restaurar pistas quitadas': 'Restore removed tracks',
  'Restaurar': 'Restore',
  'Borrar historial': 'Clear history',
  'Borrar historial de reproducción': 'Clear playback history',
  'Errores y advertencias guardados en el dispositivo.': 'Errors and warnings stored on the device.',
  'Capacidades del dispositivo': 'Device capabilities',
  'Se actualizan cuando cambian los permisos.': 'They update when permissions change.',
  'Versión': 'Version',
  'Biblioteca local con SQLite': 'Local library with SQLite',
  'La reproducción en segundo plano y los controles de pantalla bloqueada requieren un development build (no funcionan en Expo Go).':
    'Background playback and lock screen controls require a development build (they do not work in Expo Go).',
  'Actualizaciones': 'Updates',
  'Elige claro, oscuro o una familia de superhéroe. Cada héroe cambia los colores y, en builds nativos, el icono de la app.':
    'Choose light, dark or a superhero family. Each hero changes the colors and, in native builds, the app icon.',
  'Volver a escanear': 'Scan again',
  'Conceder permiso de audio': 'Grant audio permission',
  'Busca canciones nuevas o eliminadas en el dispositivo.': 'Find new or removed songs on the device.',
  'Vuelve a añadir las canciones que quitaste de la biblioteca sin borrar el archivo.':
    'Adds back songs you removed from the library without deleting the file.',
  'permiso concedido': 'permission granted',
  'sin permiso de audio': 'no audio permission',
  'Escaneando biblioteca…': 'Scanning library…',
  'Cambia el idioma de toda la aplicación': 'Changes the language of the whole app',
  'Permitir': 'Allow',
  'Permite las notificaciones para controlar la reproducción desde la pantalla de bloqueo y la barra de notificaciones.':
    'Allow notifications to control playback from the lock screen and the notification bar.',

  // Etiquetas de accesibilidad y textos cortos que faltaban en la primera pasada.
  'Recientes': 'Recent',
  'Reproducidas recientemente': 'Recently played',
  'Elige una canción de la biblioteca para empezar.': 'Choose a song from your library to start.',
  'Volver': 'Back',
  'Subir': 'Move up',
  'Bajar': 'Move down',
  'Siguiente': 'Next',
  'Aleatorio': 'Shuffle',
  'Anterior': 'Previous',
  'Favorito': 'Favorite',
  'Volumen': 'Volume',
  'Salir de la selección': 'Exit selection',
  'ya incluida': 'already added',
  'ascendente': 'ascending',
  'descendente': 'descending',
  'Cargando…': 'Loading…',
  'Repetir': 'Repeat',

  // Avisos emitidos por stores fuera de React (usan espejo de idioma).
  'Sesión restaurada': 'Session restored',
  'La copia local no está disponible. Reintenta en unos segundos.':
    'The local copy is unavailable. Try again in a few seconds.',
  'No se pudieron buscar las carátulas': "Couldn't search for artwork",

  // Valores por defecto del widget y nombres de temas visibles en Ajustes.
  'Sin reproducción': 'Nothing playing',
  'Abre la app y elige música': 'Open the app and choose music',
  'Capitán América': 'Captain America',
  'Toca de nuevo para alternar el sentido.': 'Tap again to reverse the order.',
  'Toca para seleccionar o deseleccionar.': 'Tap to select or deselect.',
  'Aún no tienes playlists. Crea una abajo.': "You don't have playlists yet. Create one below.",
  'Usa el botón de opciones de cada canción para reordenarla o quitarla.':
    "Use each song's options button to reorder or remove it.",
  'sin repetición': 'off',
  'toda la cola': 'all',
  'una pista': 'one',
  'Vaciar': 'Clear',
  'en reproducción': 'playing',
  'en pausa': 'paused',
  'Claro': 'Light',
  'Oscuro': 'Dark',
  'Avengers': 'Avengers',
  'Iron Man': 'Iron Man',
  'Spider-Man': 'Spider-Man',
  'Superman': 'Superman',
  'Linterna Verde': 'Green Lantern',
  'Hunger Games': 'Hunger Games',
  'Thor': 'Thor',
  'Venom': 'Venom',

  // Avisos de biblioteca/permisos y nombres de listas automáticas.
  'No se pudo cargar la biblioteca': 'Could not load the library',
  'No se pudo actualizar la biblioteca': 'Could not update the library',
  'No se pudo escanear tu música': "Couldn't scan your music",
  'No se pudo leer la mediateca del dispositivo. Inténtalo de nuevo.':
    "Couldn't read the device media library. Try again.",
  'Permiso de audio denegado': 'Audio permission denied',
  'Revisa los permisos de la app en los ajustes del sistema para ver tu música.':
    'Check the app permissions in system settings to see your music.',
  'Una pista de la última cola ya no está disponible.':
    'One track from the last queue is no longer available.',
  'Agregadas recientemente': 'Recently added',
  'Aleatoria': 'Random',
  'Error': 'Error',
  'Actualizar': 'Update',
  'Hay una nueva versión del reproductor. ¿Deseas descargarla?':
    'A new version of the player is available. Download it now?',

  // Textos de degradación, favoritos y metadatos que aparecen en la UI.
  'Controles de pantalla de bloqueo no disponibles': 'Lock screen controls unavailable',
  'Quitar de favoritos': 'Remove from favorites',
  'Agregar a favoritos': 'Add to favorites',
  'Artista desconocido': 'Unknown artist',
  'Autor desconocido': 'Unknown author',
  'Error de reproducción': 'Playback error',
  'No se pudo sincronizar tu biblioteca': "Couldn't sync your library",
  'El sistema no confirmó el borrado. Puede que hayas cancelado el diálogo o que tu versión de Android exija un permiso que la app no solicita.':
    'The system did not confirm the deletion. You may have cancelled the dialog, or your Android version may require a permission the app does not request.',
} as const;

export type LiteralKey = keyof typeof EN;

/** Traduce un literal fijo. En español devuelve la clave tal cual (fuente). */
export function tr(language: AppLanguage, key: LiteralKey): string {
  return language === 'en' ? EN[key] : key;
}

type PluralForms = { one: string; other: string };
type TemplateText = string | PluralForms;
type Template = { es: TemplateText; en: TemplateText };

/**
 * Plantillas con variables. Las que tienen formas singular/plural usan
 * `Intl.PluralRules` si el motor lo trae y, si no (Hermes de Expo Go), un
 * fallback `one`/`other`. Ver `selectPluralForm`.
 */
export const TEMPLATES = {
  songsInLibrary: { es: '{count} en tu biblioteca', en: '{count} in your library' },
  ownPlaylists: {
    es: '{count} playlists propias',
    en: '{count} of your playlists',
  },
  restoreHiddenTitle: {
    es: 'Restaurar pistas quitadas ({count})',
    en: 'Restore removed tracks ({count})',
  },
  albumsArtists: {
    es: '{albums} álbumes · {artists} artistas',
    en: '{albums} albums · {artists} artists',
  },
  bookTitles: {
    es: { one: '{count} título', other: '{count} títulos' },
    en: { one: '{count} title', other: '{count} titles' },
  },
  chapters: {
    es: { one: '{count} capítulo', other: '{count} capítulos' },
    en: { one: '{count} chapter', other: '{count} chapters' },
  },
  artistSummary: {
    es: '{songs} · {albums} álbumes',
    en: '{songs} · {albums} albums',
  },
  noMatchQuery: {
    es: 'Nada coincide con «{query}» en este filtro.',
    en: 'Nothing matches “{query}” in this filter.',
  },
  confirmDeletePlaylist: {
    es: '¿Eliminar "{name}"?',
    en: 'Delete "{name}"?',
  },
  artworkFound: {
    es: { one: 'Se encontraron carátulas para {count} canción.', other: 'Se encontraron carátulas para {count} canciones.' },
    en: { one: 'Found artwork for {count} song.', other: 'Found artwork for {count} songs.' },
  },
  restoreHidden: {
    es: { one: 'Se volverán a añadir {count} pista que quitaste de la biblioteca y sigue en el dispositivo.', other: 'Se volverán a añadir {count} pistas que quitaste de la biblioteca y siguen en el dispositivo.' },
    en: { one: '{count} track you removed from the library will be added back; it is still on your device.', other: '{count} tracks you removed from the library will be added back; they are still on your device.' },
  },
  lastScan: { es: 'Último escaneo: {report}', en: 'Last scan: {report}' },
  songsCount: {
    es: { one: '{count} canción', other: '{count} canciones' },
    en: { one: '{count} song', other: '{count} songs' },
  },
  selectAllCount: { es: 'Seleccionar todo ({count})', en: 'Select all ({count})' },
  deleteSelectionCount: { es: 'Eliminar selección ({count})', en: 'Delete selection ({count})' },
  searchingArtwork: {
    es: 'Buscando carátulas ({processed} de {total})…',
    en: 'Searching for artwork ({processed} of {total})…',
  },
  goToLetters: {
    es: 'Ir a {noun} con números u otros caracteres',
    en: 'Go to {noun} with numbers or other characters',
  },
  openPlaylist: {
    es: 'Abrir playlist {name}, {count}',
    en: 'Open playlist {name}, {count}',
  },
  playAlbum: { es: 'Reproducir álbum {title}', en: 'Play album {title}' },
  openAudiobook: { es: 'Abrir audiolibro {title}, de {author}', en: 'Open audiobook {title}, by {author}' },
  optionsFor: { es: 'Opciones de {title}', en: 'Options for {title}' },
  playTitle: { es: 'Reproducir {title}', en: 'Play {title}' },
  playSong: { es: 'Reproducir {title}, de {artist}', en: 'Play {title}, by {artist}' },
  selectedSong: { es: '{title}, {artist}, seleccionada', en: '{title}, {artist}, selected' },
  unselectedSong: {
    es: '{title}, {artist}, no seleccionada',
    en: '{title}, {artist}, not selected',
  },
  untitledFallback: { es: 'Pista sin título', en: 'Untitled track' },
  errorApplyingUpdate: { es: 'Error aplicando actualización: {error}', en: 'Error applying update: {error}' },
  errorDownloadingUpdate: { es: 'Error descargando actualización: {error}', en: 'Error downloading update: {error}' },
  scanFoundTracks: { es: 'Encontradas {count} pistas en el dispositivo', en: 'Found {count} tracks on the device' },
  scanSearchingFiles: { es: 'Buscando archivos en el dispositivo…', en: 'Searching device files…' },
  scanComparing: { es: 'Comparando con tu biblioteca…', en: 'Comparing with your library…' },
  scanReadingMetadata: { es: 'Leyendo metadatos ({processed} de {total})…', en: 'Reading metadata ({processed} of {total})…' },
  scanSaving: { es: 'Guardando cambios ({processed} de {total})…', en: 'Saving changes ({processed} of {total})…' },
  scanMarkingMissing: { es: 'Marcando pistas ausentes…', en: 'Marking missing tracks…' },
  scanMarkingMissingWithTotal: { es: 'Marcando pistas ausentes ({processed} de {total})…', en: 'Marking missing tracks ({processed} of {total})…' },
  scanDone: { es: 'Biblioteca actualizada', en: 'Library updated' },
  scanAdded: { es: { one: '{count} nueva', other: '{count} nuevas' }, en: { one: '{count} new', other: '{count} new' } },
  scanUpdated: { es: { one: '{count} actualizada', other: '{count} actualizadas' }, en: { one: '{count} updated', other: '{count} updated' } },
  scanMissing: { es: { one: '{count} ausente', other: '{count} ausentes' }, en: { one: '{count} missing', other: '{count} missing' } },
  scanSkipped: { es: { one: '{count} ilegible', other: '{count} ilegibles' }, en: { one: '{count} unreadable', other: '{count} unreadable' } },
  scanNoChanges: { es: 'sin cambios', en: 'no changes' },
  tracksCount: {
    es: { one: '{count} pista', other: '{count} pistas' },
    en: { one: '{count} track', other: '{count} tracks' },
  },
  goToLetter: {
    es: 'Ir a {noun} que empiezan por {letter}',
    en: 'Go to {noun} starting with {letter}',
  },
  songsArtists: {
    es: '{songs} · {artists} artistas',
    en: '{songs} · {artists} artists',
  },
  logOccurrences: { es: '{count} veces', en: '{count} times' },
  logFirstSeen: { es: '(primera: {time})', en: '(first: {time})' },
  logEventsCount: { es: '{count} sucesos', en: '{count} events' },
  removeFromQueue: {
    es: 'Quitar {title} de la cola',
    en: 'Remove {title} from the queue',
  },
  addToPlaylist: { es: 'Agregar a {name}', en: 'Add to {name}' },
  sortAccessibility: { es: '{field}, {direction}', en: '{field}, {direction}' },
  positionOfDuration: { es: '{current} de {duration}', en: '{current} of {duration}' },
  repeatMode: { es: 'Repetir: {mode}', en: 'Repeat: {mode}' },
  restoredTracksMissing: {
    es: {
      one: '{count} pista de la última cola ya no está disponible.',
      other: '{count} pistas de la última cola ya no están disponibles.',
    },
    en: {
      one: '{count} track from the last queue is no longer available.',
      other: '{count} tracks from the last queue are no longer available.',
    },
  },
  widgetStatus: {
    es: '{title} — {artist}, {state}',
    en: '{title} — {artist}, {state}',
  },
  audioFormat: {
    es: 'Formato {format}',
    en: '{format} format',
  },
  audioFormatFlacDetail: {
    es: 'Formato FLAC, {bitDepth} bits, {sampleRate} kHz',
    en: 'FLAC format, {bitDepth}-bit, {sampleRate} kHz',
  },
} as const satisfies Record<string, Template>;

export type TemplateKey = keyof typeof TEMPLATES;
export type TemplateParams = Record<string, string | number>;

function interpolate(text: string, params: TemplateParams): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Selecciona `one`/`other` sin depender de que el motor incluya ICU completo.
 *
 * LÓGICA: Hermes embebido en Expo Go no trae `Intl.PluralRules` y `new`
 * lanza `TypeError: undefined cannot be used as a constructor`. Como este
 * catálogo solo tiene dos formas, el fallback `count === 1` reproduce el
 * resultado para ES/EN. Se conserva `Intl.PluralRules` cuando existe para no
 * perder precisión en motores con ICU completo.
 */
function selectPluralForm(language: AppLanguage, count: number): keyof PluralForms {
  if (typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function') {
    try {
      return new Intl.PluralRules(language).select(count) === 'one' ? 'one' : 'other';
    } catch {
      // Motor sin ICU o implementación incompleta: seguimos con el fallback.
    }
  }
  return count === 1 ? 'one' : 'other';
}

/** Traduce una plantilla con parámetros y, si aplica, selecciona el plural. */
export function t(
  language: AppLanguage,
  key: TemplateKey,
  params: TemplateParams = {}
): string {
  const template: Template = TEMPLATES[key];
  const raw = template[language];
  const rawCount = Number(params.count ?? 0);
  const count = Number.isFinite(rawCount) ? rawCount : 0;
  // `Intl.PluralRules` puede devolver "zero"/"few"... en otros idiomas;
  // solo tenemos formas "one"/"other", así que cualquier otra cae a "other".
  const form = selectPluralForm(language, count);
  const text = typeof raw === 'string' ? raw : raw[form];
  const resolvedParams = params.count === undefined ? params : { ...params, count };
  return interpolate(text, resolvedParams);
}
