import { Directory, File } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import type { Widget } from 'expo-widgets';

import { resolveArtworkUri } from '@/services/artwork.service';
import { logError } from '@/services/error-log.service';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import {
  MEDIA_WIDGET_NAME,
  MEDIA_WIDGET_TARGETS,
  MEDIA_WIDGET_INITIAL_PROPS,
  type MediaWidgetProps,
} from '@/widgets/media-widget.contract';

/**
 * Sincronización del widget de pantalla de inicio con el reproductor.
 *
 * LÓGICA: el widget es una vista pasiva; la app le empuja un "snapshot" con
 * título, artista, portada y estado cada vez que cambia la pista o el
 * play/pause. Las pulsaciones viajan en sentido contrario: el lado nativo
 * actualiza las props de forma optimista y emite un evento que aquí se traduce
 * a las acciones del store, la misma cola que usan la app y la notificación.
 *
 * `expo-widgets` requiere un módulo nativo que Expo Go no incluye. Tanto el
 * paquete como el componente del widget se cargan con `import()` diferido y
 * protegidos por plataforma/entorno: importarlos en el arranque haría fallar la
 * app en Expo Go. En compilaciones antiguas sin el módulo, la carga falla y el
 * servicio se degrada a no-op (solo se registra el error).
 */

/**
 * El widget es Android-only y necesita el módulo nativo `ExpoWidgets`.
 *
 * LÓGICA: se comprueba el módulo real en vez de adivinar el entorno. En Expo Go
 * el módulo no está incluido y esta comprobación devuelve `null`, así que ni
 * siquiera se ejecuta el `import()` diferido (que en Metro falla con "Requiring
 * unknown module"). En un build standalone o de desarrollo el módulo existe y
 * el servicio funciona. No se usa `expoGoConfig`: en standalone expo-constants
 * puede devolver el app.config completo y desactivaría el widget por error.
 */
const WIDGET_SUPPORTED =
  Platform.OS === 'android' && requireOptionalNativeModule('ExpoWidgets') != null;

/** Prefijo de las portadas copiadas a `widgetsDirectory`. */
const ARTWORK_PREFIX = 'media-cover-';

type LoadedWidget = {
  widget: Widget<MediaWidgetProps>;
  directory: Directory;
  addUserInteractionListener: typeof import('expo-widgets').addUserInteractionListener;
};

let loadPromise: Promise<LoadedWidget | null> | null = null;

function loadWidget(): Promise<LoadedWidget | null> {
  if (!WIDGET_SUPPORTED) {
    return Promise.resolve(null);
  }
  loadPromise ??= (async () => {
    const [widgets, module] = await Promise.all([
      import('expo-widgets'),
      import('@/widgets/media-widget'),
    ]);
    return {
      widget: module.default,
      directory: new Directory(widgets.widgetsDirectory),
      addUserInteractionListener: widgets.addUserInteractionListener,
    };
  })().catch((error: unknown) => {
    logError('media-widget', 'load', error);
    return null;
  });
  return loadPromise;
}

type WidgetRequest = {
  song: Song | null;
  isPlaying: boolean;
  position: number;
  duration: number;
};

/**
 * Estado ya publicado en el widget, usado para descartar ticks de progreso.
 *
 * `expo-audio` reporta la posición cada 500 ms; publicar cada tick obligaría a
 * Glance a recomponer el widget dos veces por segundo. Solo se publica cuando
 * cambia la pista/estado/duración, cuando hay un salto (seek) o cuando la
 * posición avanzó al menos este intervalo.
 */
type WidgetState = {
  songId: number | null;
  isPlaying: boolean;
  position: number;
  duration: number;
};

const PROGRESS_SNAPSHOT_INTERVAL_SECONDS = 5;

let pendingRequest: WidgetRequest | null = null;
let publishedState: WidgetState | null = null;
let draining = false;
let lastSnapshotKey: string | null = null;

/** Normaliza el estado y redondea los segundos para no generar ruido. */
function toWidgetState(
  song: Song | null,
  isPlaying: boolean,
  position: number,
  duration: number
): WidgetState {
  return {
    songId: song ? song.id : null,
    isPlaying,
    position: Math.max(0, Math.round(position)),
    duration: Math.max(0, Math.round(duration)),
  };
}

function shouldPublish(next: WidgetState): boolean {
  if (!publishedState) {
    return true;
  }
  if (next.songId !== publishedState.songId || next.isPlaying !== publishedState.isPlaying) {
    return true;
  }
  if (next.duration !== publishedState.duration) {
    return true;
  }
  const delta = next.position - publishedState.position;
  // Retroceso o salto grande = seek: se refleja al instante.
  if (delta < 0 || delta >= PROGRESS_SNAPSHOT_INTERVAL_SECONDS) {
    return true;
  }
  return false;
}

/**
 * Publica el estado actual en el widget. Varias llamadas seguidas se
 * colapsan: solo se aplica el último estado pedido. Los ticks de progreso se
 * filtran con `shouldPublish` para no recomponer el widget en cada uno.
 */
export function syncMediaWidget(
  song: Song | null,
  isPlaying: boolean,
  position = 0,
  duration = 0
): void {
  if (!WIDGET_SUPPORTED) {
    return;
  }
  const next = toWidgetState(song, isPlaying, position, duration);
  if (!shouldPublish(next)) {
    return;
  }
  pendingRequest = { song, isPlaying, position: next.position, duration: next.duration };
  void drain();
}

async function drain(): Promise<void> {
  if (draining) {
    return;
  }
  draining = true;
  try {
    while (pendingRequest) {
      const request = pendingRequest;
      pendingRequest = null;
      const applied = await applySnapshot(request);
      // Llegó otro estado mientras se copiaba la portada: el snapshot recién
      // escrito ya es viejo y el siguiente ciclo publicará el correcto.
      if (!applied) {
        continue;
      }
    }
  } catch (error) {
    logError('media-widget', 'drain', error);
  } finally {
    draining = false;
    if (pendingRequest) {
      void drain();
    }
  }
}

/** Devuelve `false` si el snapshot quedó obsoleto antes de publicarse. */
async function applySnapshot(request: WidgetRequest): Promise<boolean> {
  const loaded = await loadWidget();
  if (!loaded) {
    return true;
  }

  const artwork = await prepareArtwork(loaded.directory, request.song);
  if (pendingRequest) {
    return false;
  }

  const props: MediaWidgetProps = request.song
    ? {
        title: request.song.title,
        artist: request.song.artist,
        artwork,
        isPlaying: request.isPlaying,
        hasSong: true,
        position: request.position,
        duration: request.duration,
      }
    : { ...MEDIA_WIDGET_INITIAL_PROPS };

  const key = JSON.stringify(props);
  if (key !== lastSnapshotKey) {
    lastSnapshotKey = key;
    loaded.widget.updateSnapshot(props);
  }
  publishedState = toWidgetState(
    request.song,
    request.isPlaying,
    request.position,
    request.duration
  );
  pruneArtwork(loaded.directory, artwork);
  return true;
}

/**
 * Copia la portada a `widgetsDirectory` (el runtime del widget no puede leer
 * la caché de la app ni URLs remotas). Reutiliza el archivo si ya existe.
 */
async function prepareArtwork(directory: Directory, song: Song | null): Promise<string | null> {
  if (!song) {
    return null;
  }
  try {
    const source = await resolveArtworkSource(song);
    if (!source) {
      return null;
    }
    const extension = source.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
    const destination = new File(directory, `${ARTWORK_PREFIX}${song.id}.${extension}`);
    if (!destination.exists || destination.size === 0) {
      await new File(source).copy(destination, { overwrite: true });
    }
    return destination.exists ? destination.uri : null;
  } catch (error) {
    logError('media-widget', 'prepareArtwork', error);
    return null;
  }
}

/** Prefiere la URI cacheada por la app y la regenera si la caché se limpió. */
async function resolveArtworkSource(song: Song): Promise<string | null> {
  if (song.artwork) {
    try {
      const cached = new File(song.artwork);
      if (cached.exists && cached.size > 0) {
        return cached.uri;
      }
    } catch (error) {
      logError('media-widget', 'resolveArtworkSource', error);
    }
  }
  return resolveArtworkUri(song);
}

/** Elimina portadas de pistas anteriores para no acumular archivos. */
function pruneArtwork(directory: Directory, keep: string | null): void {
  try {
    for (const entry of directory.list()) {
      if (!(entry instanceof File) || !entry.name.startsWith(ARTWORK_PREFIX)) {
        continue;
      }
      if (keep && entry.uri === keep) {
        continue;
      }
      entry.delete();
    }
  } catch (error) {
    logError('media-widget', 'pruneArtwork', error);
  }
}

/**
 * Conecta las pulsaciones del widget con las acciones del reproductor compartido.
 * Devuelve la función para retirar el oyente.
 */
export function registerMediaWidgetInteractions(): () => void {
  if (!WIDGET_SUPPORTED) {
    return () => undefined;
  }

  let cancelled = false;
  let subscription: { remove: () => void } | null = null;

  void loadWidget().then((loaded) => {
    if (!loaded || cancelled) {
      return;
    }
    subscription = loaded.addUserInteractionListener((event) => {
      if (event.source !== MEDIA_WIDGET_NAME) {
        return;
      }
      const player = usePlayerStore.getState();
      switch (event.target) {
        case MEDIA_WIDGET_TARGETS.previous:
          player.previous();
          break;
        case MEDIA_WIDGET_TARGETS.toggle:
          player.toggle();
          break;
        case MEDIA_WIDGET_TARGETS.next:
          player.next();
          break;
      }
    });
  });

  return () => {
    cancelled = true;
    subscription?.remove();
    subscription = null;
  };
}
