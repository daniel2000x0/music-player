import { File, FileMode, type FileHandle } from 'expo-file-system';

import { ascii } from '@/domain/artwork/bytes';
import { extractFlacTags } from '@/domain/artwork/flac';
import { extractId3Tags, parseId3TagSize } from '@/domain/artwork/id3';
import { extractMp4Tags } from '@/domain/artwork/mp4';
import type { AudioTags } from '@/domain/metadata';

function estimateBitrateKbps(sizeBytes: number, durationSeconds: number | null | undefined): number | null {
  if (!Number.isFinite(durationSeconds) || !durationSeconds || durationSeconds <= 0) {
    return null;
  }
  const kbps = Math.round((sizeBytes * 8) / durationSeconds / 1000);
  return kbps > 0 ? kbps : null;
}

/**
 * Lectura de etiquetas de texto desde el archivo de audio.
 *
 * LÓGICA: la mediateca solo entrega nombre y duración; título, artista,
 * álbum y número de pista viven dentro del archivo. Se lee el contenedor
 * mínimo necesario:
 * - MP3: tag ID3v2 al inicio (`TIT2`, `TPE1`, `TALB`, `TPE2`, `TRCK`).
 * - M4A/M4B/MP4: átomos de `moov/udta/meta/ilst` (`©nam`, `©ART`, `©alb`, `aART`, `trkn`).
 * - FLAC: bloque `VORBIS_COMMENT` (`TITLE`, `ARTIST`, `ALBUM`, ...).
 * Un fallo de lectura no rompe el escaneo: se devuelve `null` y se usan
 * los respaldos de nombre/carpeta.
 */

/** Techo de seguridad para tags ID3 gigantes o corruptos. */
const ID3_TAG_MAX_BYTES = 2 * 1024 * 1024;

/** Contenedores cuyo texto sabemos leer. */
const TAG_EXTENSIONS = new Set(['mp3', 'm4a', 'm4b', 'mp4', 'aac', 'flac']);

function fileExtension(uri: string): string {
  const clean = uri.split('?')[0].toLowerCase();
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot + 1);
}

function shouldAttempt(uri: string): boolean {
  return TAG_EXTENSIONS.has(fileExtension(uri)) || uri.startsWith('content://');
}

/** Lee las etiquetas de texto y técnicas de un archivo; `null` si no hay datos. */
export async function readAudioTags(
  uri: string,
  durationSeconds?: number | null
): Promise<AudioTags | null> {
  if (!shouldAttempt(uri)) {
    return null;
  }

  let handle: FileHandle | null = null;
  try {
    const file = new File(uri);
    if (!file.exists || file.size === 0) {
      return null;
    }

    handle = file.open(FileMode.ReadOnly);
    const size = handle.size ?? file.size;
    if (size <= 0) {
      return null;
    }

    const header = await handle.readBytes(12);
    if (!header || header.length < 8) {
      return null;
    }

    let tags: AudioTags | null = null;

    // "ID3" → MP3 con tag ID3v2.
    if (ascii(header, 0, 3) === 'ID3') {
      const tagSize = parseId3TagSize(header);
      if (tagSize !== null) {
        const total = Math.min(10 + tagSize, ID3_TAG_MAX_BYTES);
        handle.offset = 0;
        const tag = await handle.readBytes(total);
        tags = tag ? extractId3Tags(tag) : null;
      }
    } else if (ascii(header, 4, 4) === 'ftyp') {
      // Átomo "ftyp" en [4..8] → contenedor MP4/M4A/M4B.
      const instance = handle;
      const reader = async (offset: number, length: number) => {
        instance.offset = offset;
        return await instance.readBytes(length);
      };
      tags = await extractMp4Tags(reader, size);
    } else if (ascii(header, 0, 4) === 'fLaC') {
      // Firma "fLaC" → contenedor FLAC.
      const instance = handle;
      const reader = async (offset: number, length: number) => {
        instance.offset = offset;
        return await instance.readBytes(length);
      };
      tags = await extractFlacTags(reader, size);
    }

    const bitrate = estimateBitrateKbps(size, durationSeconds);
    if (!tags) {
      return bitrate ? { title: null, artist: null, album: null, albumArtist: null, track: null, bitDepth: null, sampleRate: null, bitrate } : null;
    }
    return { ...tags, bitrate: tags.bitrate ?? bitrate };
  } catch {
    return null;
  } finally {
    handle?.close();
  }
}
