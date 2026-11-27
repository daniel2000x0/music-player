import { File, FileMode, type FileHandle } from 'expo-file-system';

import {
  CONTENT_SAMPLE_BYTES,
  buildContentKey,
} from '@/domain/library/content-key';

/**
 * Calcula la huella de una pista leyendo solo los extremos del archivo.
 *
 * Los URI `content://media/...` no se pueden abrir como `File`, así que se
 * devuelve `null` y el apareamiento usa la alternativa nombre + duración. Un
 * archivo desaparecido o ilegible también devuelve `null`: nunca se usa una
 * huella incompleta para fusionar canciones distintas.
 */
export async function computeContentKey(
  uri: string,
  durationSeconds: number
): Promise<string | null> {
  if (!uri.startsWith('file://')) {
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

    const head = (await handle.readBytes(CONTENT_SAMPLE_BYTES)) ?? new Uint8Array(0);
    const tailOffset = Math.max(0, size - CONTENT_SAMPLE_BYTES);
    handle.offset = tailOffset;
    const tail = (await handle.readBytes(CONTENT_SAMPLE_BYTES)) ?? new Uint8Array(0);

    return buildContentKey({
      size,
      durationMs: Math.round(durationSeconds * 1000),
      head,
      tail,
    });
  } catch {
    return null;
  } finally {
    handle?.close();
  }
}
