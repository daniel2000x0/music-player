import { getDatabase } from '@/data/db/database';
import type { ErrorLogEntry, ErrorLogInput, ErrorLogLevel } from '@/types/error-log';

export const ERROR_LOGS_LIMIT = 200;

export const errorLogRepository = {
  /**
   * Inserta o actualiza un suceso. La huella (nivel+ámbito+acción+mensaje)
   * es única: si se repite, suma una ocurrencia y refresca la fecha.
   */
  async record(input: ErrorLogInput): Promise<void> {
    const db = await getDatabase();
    const now = Date.now();
    const fingerprint = `${input.level}|${input.scope}|${input.action}|${input.message}`;
    await db.runAsync(
      `INSERT INTO error_logs
         (level, scope, action, message, fingerprint, occurrences, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(fingerprint) DO UPDATE SET
         occurrences = occurrences + 1,
         last_seen_at = excluded.last_seen_at`,
      input.level,
      input.scope,
      input.action,
      input.message,
      fingerprint,
      now,
      now
    );
    await db.runAsync(
      `DELETE FROM error_logs
       WHERE id NOT IN (
         SELECT id FROM error_logs ORDER BY last_seen_at DESC LIMIT ?
       )`,
      ERROR_LOGS_LIMIT
    );
  },

  /** Sucesos más recientes primero, opcionalmente filtrados por nivel. */
  async list(level?: ErrorLogLevel): Promise<ErrorLogEntry[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<
      ErrorLogEntry & { level: string; occurrences: number }
    >(
      level
        ? `SELECT id, level, scope, action, message, occurrences, first_seen_at, last_seen_at
           FROM error_logs
           WHERE level = ?
           ORDER BY last_seen_at DESC
           LIMIT ?`
        : `SELECT id, level, scope, action, message, occurrences, first_seen_at, last_seen_at
           FROM error_logs
           ORDER BY last_seen_at DESC
           LIMIT ?`,
      ...(level ? [level, ERROR_LOGS_LIMIT] : [ERROR_LOGS_LIMIT])
    );
    return rows.map((row) => ({ ...row, level: row.level as ErrorLogLevel }));
  },

  async count(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM error_logs');
    return row?.total ?? 0;
  },

  async clear(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM error_logs');
  },
};
