import { getDatabase } from '@/data/db/database';
import {
  parseSession,
  serializeSession,
  type PlaybackSession,
} from '@/domain/playback/session';

/**
 * Persistencia de la sesión de reproducción (`A-01`).
 *
 * RESPONSABILIDAD ÚNICA: guardar, leer y borrar la fila única de
 * `playback_sessions`. La forma y la validación del payload viven en el
 * dominio (`domain/playback/session`); la política de cuándo escribir vive en
 * `services/audio/session-persistence`.
 */

/** La app reproduce una cosa a la vez: una sola fila. */
const SESSION_ROW_ID = 1;

export const playbackSessionRepository = {
  /** Sesión guardada, o `null` si no hay o el payload no es válido. */
  async load(): Promise<PlaybackSession | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT payload FROM playback_sessions WHERE id = ?',
      SESSION_ROW_ID
    );
    return row ? parseSession(row.payload) : null;
  },

  /** Upsert de la sesión única. */
  async save(session: PlaybackSession): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO playback_sessions (id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      SESSION_ROW_ID,
      serializeSession(session),
      session.updatedAt
    );
  },

  /** Borra la sesión (nada restaurable, o el usuario vació la cola). */
  async clear(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM playback_sessions WHERE id = ?', SESSION_ROW_ID);
  },
};
