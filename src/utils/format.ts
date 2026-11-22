/**
 * Utilidades de formato de la app.
 *
 * NOTA (i18n): los conteos usan el catálogo, que aplica `Intl.PluralRules`
 * cuando está disponible y un fallback `one`/`other` en Hermes/Expo Go; el
 * idioma se lee del store global para que las pantallas no tengan que pasarlo.
 */

import { t, tr, type AppLanguage, type LiteralKey } from '@/i18n';
import { getCurrentLanguage } from '@/i18n/current-language';


/**
 * Formatea unos segundos como reloj: "m:ss" o "h:mm:ss" si supera 1 h.
 * A diferencia de `formatDuration`, siempre devuelve un reloj (0 -> "0:00"),
 * porque se usa para la posición, que sí se conoce desde el principio.
 */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  const seconds = Math.floor(safe % 60);
  const minutes = Math.floor((safe / 60) % 60);
  const hours = Math.floor(safe / 3600);

  const pad = (value: number) => value.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** Formatea una duración en segundos como "m:ss" (o "h:mm:ss" si supera 1 h). */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '--:--';
  }
  return formatClock(totalSeconds);
}

/** Convierte contadores de canciones al idioma activo. */
export function formatSongCount(count: number, language?: AppLanguage): string {
  return t(language ?? getCurrentLanguage(), 'songsCount', { count });
}

/** Formatos de archivo que exponemos como etiqueta informativa en la UI. */
const SUPPORTED_FILE_FORMATS = new Set([
  'flac',
  'mp3',
  'm4a',
  'aac',
  'wav',
  'ogg',
  'opus',
  'wma',
  'aiff',
  'alac',
]);

/**
 * Normaliza una extensión/formato de audio a minúsculas.
 *
 * LÓGICA: el formato viene de la URI o del nombre de archivo del escaneo.
 * Solo se aceptan extensiones conocidas para no mostrar basura en la etiqueta.
 */
export function normalizeAudioFormat(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const clean = value.split('?')[0].split('#')[0].toLowerCase();
  const dot = clean.lastIndexOf('.');
  const ext = dot === -1 ? clean : clean.slice(dot + 1);
  return SUPPORTED_FILE_FORMATS.has(ext) ? ext : null;
}

type AudioQualityInput = {
  format: string | null | undefined;
  bitDepth?: number | null;
  sampleRate?: number | null;
  bitrate?: number | null;
};

function formatSampleRateKhz(sampleRate: number): string {
  const khz = sampleRate / 1000;
  // 44100 -> 44.1, 48000 -> 48, 96000 -> 96
  return Number.isInteger(khz) ? String(khz) : khz.toFixed(1).replace(/\.0$/, '');
}

/** Texto visible: ej. `FLAC 16/44.1 kHz · 1411 kbps` o `MP3 · 320 kbps`. */
export function formatAudioQualityLabel(
  input: string | null | undefined | AudioQualityInput,
  language: AppLanguage = getCurrentLanguage()
): string | null {
  const format = typeof input === 'string' || input == null ? input : input.format;
  const normalized = normalizeAudioFormat(format);
  if (!normalized) {
    return null;
  }
  const bitDepth = typeof input === 'object' && input ? input.bitDepth : null;
  const sampleRate = typeof input === 'object' && input ? input.sampleRate : null;
  const bitrate = typeof input === 'object' && input ? input.bitrate : null;

  const parts: string[] = [];
  if (normalized === 'flac') {
    if (bitDepth && sampleRate) {
      parts.push(`FLAC ${bitDepth}/${formatSampleRateKhz(sampleRate)} kHz`);
    } else {
      parts.push(tr(language, 'FLAC · Alta calidad'));
    }
  } else {
    parts.push(normalized.toUpperCase());
  }
  if (bitrate && bitrate > 0) {
    parts.push(`${bitrate} kbps`);
  }
  return parts.join(' · ');
}

/** Descripción accesible: explica el formato sin usar solo el color. */
export function describeAudioQuality(
  input: string | null | undefined | AudioQualityInput,
  language: AppLanguage = getCurrentLanguage()
): string | null {
  const format = typeof input === 'string' || input == null ? input : input.format;
  const normalized = normalizeAudioFormat(format);
  if (!normalized) {
    return null;
  }
  const bitDepth = typeof input === 'object' && input ? input.bitDepth : null;
  const sampleRate = typeof input === 'object' && input ? input.sampleRate : null;
  const bitrate = typeof input === 'object' && input ? input.bitrate : null;
  const bitrateText = bitrate && bitrate > 0 ? `, ${bitrate} kbps` : '';

  if (normalized === 'flac') {
    if (bitDepth && sampleRate) {
      return `${t(language, 'audioFormatFlacDetail', {
        bitDepth,
        sampleRate: formatSampleRateKhz(sampleRate),
      })}${bitrateText}`;
    }
    return `${tr(language, 'Formato FLAC, alta calidad')}${bitrateText}`;
  }
  return `${t(language, 'audioFormat', { format: normalized.toUpperCase() })}${bitrateText}`;
}

/**
 * Los valores de relleno de metadatos se guardan en español para no alterar la
 * agrupación de la biblioteca al cambiar de idioma. Aquí se traducen solo al
 * pintarlos; cualquier título real se devuelve tal cual.
 */
const METADATA_FALLBACK_KEYS: Readonly<Record<string, LiteralKey>> = {
  'Artista desconocido': 'Artista desconocido',
  'Autor desconocido': 'Autor desconocido',
  'Sin álbum': 'Sin álbum',
  'Pista sin título': 'Pista sin título',
  'Audiolibros sin álbum': 'Audiolibros sin álbum',
  'Nueva playlist': 'Nueva playlist',
};

export function displayMetadata(value: string): string {
  const key = METADATA_FALLBACK_KEYS[value];
  return key ? tr(getCurrentLanguage(), key) : value;
}
