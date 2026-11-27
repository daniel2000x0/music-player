import {
  Asset,
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';

import type { DeviceTrack } from '@/domain/library/scan-diff';
import { resolveSongMetadata } from '@/domain/metadata';
import { tr } from '@/i18n';
import { getCurrentLanguage } from '@/i18n/current-language';
import { computeContentKey } from '@/services/content-key.service';
import { logError, logWarning } from '@/services/error-log.service';
import { readAudioTags } from '@/services/tag.service';
import type { ScannedSong } from '@/types/song';
import { normalizeAudioFormat } from '@/utils/format';

/**
 * Servicio de acceso al almacenamiento de audio del dispositivo.
 *
 * RESPONSABILIDAD ÚNICA: permisos, enumeración de la mediateca y lectura del
 * asset. El orden de las fases, la comparación con SQLite y la persistencia
 * viven en `library-scan.service`.
 *
 * LÓGICA: en el SDK 58 `expo-media-library` expone la API nueva basada en
 * `Query`/`Asset`. La mediateca NO expone etiquetas ID3/MP4, así que
 * `readAudioTags` las lee del archivo y `resolveSongMetadata` aplica la
 * cadena tag → nombre de archivo → carpeta.
 */

/**
 * Tamaño de página al recorrer la mediateca.
 *
 * LÓGICA: la API nueva de `expo-media-library` pagina con `limit`/`offset`
 * (no expone cursor). Antes había un `.limit(5000)` fijo que truncaba la
 * biblioteca en silencio (`C-02`); ahora se recorre hasta la última página.
 * El coste es tiempo de escaneo, no pérdida de canciones.
 */
export const AUDIO_PAGE_SIZE = 1000;

/** Tope defensivo: 1 000 000 de pistas, evita un bucle si se ignora `offset`. */
const MAX_PAGES = 1000;

/** Archivos leídos en paralelo durante la hidratación. */
export const TAG_CONCURRENCY = 4;

function audioQuery(offset: number): Query {
  return new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.AUDIO)
    .orderBy(AssetField.CREATION_TIME)
    .limit(AUDIO_PAGE_SIZE)
    .offset(offset);
}

/**
 * Recorre todas las páginas de la mediateca y deduplica por id.
 *
 * Si una página viene completa pero no aporta ids nuevos, el proveedor está
 * ignorando `offset`: se detiene y se registra, en lugar de iterar sin fin.
 */
async function collectPages<T extends { id: string }>(
  fetchPage: (offset: number) => Promise<T[]>
): Promise<T[]> {
  const collected: T[] = [];
  const seen = new Set<string>();

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const page = await fetchPage(pageIndex * AUDIO_PAGE_SIZE);
    let added = 0;
    for (const item of page) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      collected.push(item);
      added += 1;
    }
    if (page.length < AUDIO_PAGE_SIZE) {
      return collected;
    }
    if (added === 0) {
      logWarning(
        'media-service',
        'collectPages',
        'La página no aportó ids nuevos; se detiene el recorrido para evitar un bucle.'
      );
      return collected;
    }
  }

  logWarning(
    'media-service',
    'collectPages',
    `Se alcanzó el tope defensivo de ${MAX_PAGES} páginas (${MAX_PAGES * AUDIO_PAGE_SIZE} pistas).`
  );
  return collected;
}

export async function hasAudioPermission(): Promise<boolean> {
  try {
    const { granted } = await getPermissionsAsync(false, ['audio']);
    return granted;
  } catch (error) {
    logError('media-service', 'getPermissionsAsync', error);
    return false;
  }
}

export async function requestAudioAccess(): Promise<boolean> {
  try {
    const { granted } = await requestPermissionsAsync(false, ['audio']);
    return granted;
  } catch (error) {
    logError('media-service', 'requestPermissionsAsync', error);
    return false;
  }
}

/**
 * Pistas de audio presentes en la mediateca (consulta liviana).
 *
 * LÓGICA: `exeForMetadata` no resuelve rutas ni lee etiquetas; devuelve id y
 * fecha de modificación en una sola consulta paginada. Es la entrada del
 * escaneo incremental (`M-04`). Devuelve `null` si la consulta falla, para
 * que el llamador NO toque SQLite por un fallo transitorio.
 */
export async function enumerateDeviceAudio(): Promise<DeviceTrack[] | null> {
  try {
    const metadata = await collectPages((offset) => audioQuery(offset).exeForMetadata());
    return metadata.map((item) => ({
      mediaId: item.id,
      modificationTime: item.modificationTime,
      // `exeForMetadata` expone ambos campos sin resolver la URI del asset; el
      // diff los usa para detectar renombrados y el apareamiento de reubicación
      // los necesita cuando la huella de contenido aún no existe.
      filename: item.filename ?? null,
      durationMs: item.duration ? Math.round(item.duration * 1000) : 0,
    }));
  } catch (error) {
    logError('media-service', 'query.exeForMetadata', error);
    return null;
  }
}

/**
 * Ids de los audios presentes en la mediateca.
 *
 * Se mantiene como utilidad liviana para diagnósticos; el escaneo usa
 * `enumerateDeviceAudio` porque necesita además la fecha de modificación.
 */
export async function listDeviceAudioIds(): Promise<Set<string> | null> {
  const tracks = await enumerateDeviceAudio();
  return tracks ? new Set(tracks.map((track) => track.mediaId)) : null;
}

/**
 * Carpeta contenedora según el URI.
 *
 * LÓGICA: `file://` expone la ruta real y los documentos SAF (`content://…
 * /document/primary%3AMusic%2FBook%2Fpista.mp3`) llevan la ruta codificada
 * en el id del documento; ambos casos permiten deducir la carpeta. Los URI
 * de MediaStore (`content://media/…`) y `ph://` de iOS no la exponen.
 * La decisión de usar la carpeta como álbum (o ignorarla si es genérica)
 * vive en `resolveSongMetadata`.
 */
export function folderFromUri(uri: string): string | null {
  try {
    const clean = uri.split('?')[0];
    if (!clean) {
      return null;
    }
    if (clean.startsWith('content://media/')) {
      return null;
    }
    const documentMarker = '/document/';
    const documentIndex = clean.indexOf(documentMarker);
    if (!clean.startsWith('file://') && documentIndex < 0) {
      return null;
    }

    const path =
      documentIndex >= 0
        ? decodeURIComponent(clean.slice(documentIndex + documentMarker.length))
        : decodeURIComponent(clean.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''));
    const segments = path.split('/').filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    return segments[segments.length - 2] ?? null;
  } catch {
    return null;
  }
}

/** Resultado de borrar archivos del dispositivo. */
export type DeleteDeviceAssetsResult = {
  /** Cantidad de archivos cuya eliminación se confirmó. */
  deleted: number;
  /** Mensaje legible si el borrado no se completó. */
  error?: string;
};

/**
 * Borra archivos de audio del dispositivo (`FASE 5.2`).
 *
 * LÓGICA: `Asset.delete` pide al sistema la eliminación del lote. En Android 11+
 * el sistema muestra un único diálogo de confirmación para todo el lote y no
 * hace falta permiso de escritura; en Android 10 o anterior la ruta heredada
 * exige `WRITE_EXTERNAL_STORAGE` (bloqueado en esta app), así que el borrado
 * fallará y se informa. Nunca lanza: devuelve el resultado para que la UI lo
 * comunique con honestidad.
 */
export async function deleteDeviceAssets(
  mediaIds: string[]
): Promise<DeleteDeviceAssetsResult> {
  if (mediaIds.length === 0) {
    return { deleted: 0 };
  }
  try {
    await Asset.delete(mediaIds.map((id) => new Asset(id)));
    return { deleted: mediaIds.length };
  } catch (error) {
    logError('media-service', 'asset.delete', error);
    return {
      deleted: 0,
      error: tr(
        getCurrentLanguage(),
        'El sistema no confirmó el borrado. Puede que hayas cancelado el diálogo o que tu versión de Android exija un permiso que la app no solicita.'
      ),
    };
  }
}

/**
 * Lee una pista concreta: asset → etiquetas → metadatos resueltos.
 *
 * Devuelve `null` si el archivo ya no se puede leer; el llamador lo omite sin
 * marcar la biblioteca como vacía. `modificationTime` se copia del listado
 * (no del asset) para que la siguiente comparación sea exacta.
 */
export async function readDeviceTrack(track: DeviceTrack): Promise<ScannedSong | null> {
  try {
    const info = await new Asset(track.mediaId).getInfo();
    const filename = info.filename ?? '';
    const folder = folderFromUri(info.uri);
    const durationSeconds = info.duration ? info.duration / 1000 : 0;
    const tags = await readAudioTags(info.uri, durationSeconds);
    const metadata = resolveSongMetadata({ filename, folder, tags });

    return {
      mediaId: info.id,
      uri: info.uri,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      track: metadata.track,
      folder,
      duration: durationSeconds,
      // El formato es informativo: se toma de la extensión real y se normaliza.
      fileFormat: normalizeAudioFormat(info.filename ?? info.uri),
      bitDepth: tags?.bitDepth ?? null,
      sampleRate: tags?.sampleRate ?? null,
      bitrate: tags?.bitrate ?? null,
      hasLyrics: tags?.hasLyrics ?? false,
      lyrics: tags?.lyrics ?? null,
      artwork: null,
      modificationTime: track.modificationTime,
      // Solo se calcula para pistas que el diff marcó como nuevas o cambiadas;
      // nunca para las que ya están sin cambios.
      contentKey: await computeContentKey(info.uri, durationSeconds),
    };
  } catch (error) {
    logError('media-service', 'asset.getInfo', error);
    return null;
  }
}
