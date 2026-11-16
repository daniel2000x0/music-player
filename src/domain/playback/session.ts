/**
 * Sesión de reproducción serializable (`A-01`).
 *
 * RESPONSABILIDAD ÚNICA: describir la forma persistible de la sesión (qué
 * sonaba, en qué orden, en qué punto y con qué modos), validarla y filtrarla
 * contra la biblioteca real.
 *
 * LÓGICA: es lógica pura — sin SQLite, sin expo-audio y sin React — para poder
 * probarla y para que el repositorio solo se ocupe de guardar y leer. La cola
 * se guarda como ids, nunca como `Song` completos: `song.repository` es la
 * fuente de verdad de la biblioteca.
 */

export const REPEAT_MODES = ['none', 'all', 'single'] as const;

export type RepeatMode = (typeof REPEAT_MODES)[number];

export type PlaybackSession = {
  /** Cola visible, en orden. Puede repetir ids si la cola los tuviera. */
  queueSongIds: number[];
  /** Pista que sonaba; `null` si la cola no tenía pista actual. */
  currentSongId: number | null;
  /** Posición dentro de la pista, en segundos. */
  positionSeconds: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
  /** Marca de tiempo de la última escritura (diagnóstico). */
  updatedAt: number;
};

/**
 * Escritura de la posición: throttle de 5 s (`05` §7.3).
 *
 * Sin él, un tick de 500 ms escribiría 7200 filas por hora; con él, la pérdida
 * máxima al morir el proceso son 5 segundos de posición.
 */
export const POSITION_THROTTLE_MS = 5_000;

/** Escritura de la cola: debounce de 1 s (`05` §7.3). */
export const QUEUE_DEBOUNCE_MS = 1_000;

export function emptySession(now = Date.now()): PlaybackSession {
  return {
    queueSongIds: [],
    currentSongId: null,
    positionSeconds: 0,
    repeatMode: 'none',
    shuffle: false,
    updatedAt: now,
  };
}

function isRepeatMode(value: unknown): value is RepeatMode {
  return typeof value === 'string' && (REPEAT_MODES as readonly string[]).includes(value);
}

/** Id de canción válido: entero positivo (los ids de SQLite empiezan en 1). */
function toSongId(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function toSongIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: number[] = [];
  for (const item of value) {
    const id = toSongId(item);
    if (id !== null) {
      ids.push(id);
    }
  }
  return ids;
}

export function serializeSession(session: PlaybackSession): string {
  return JSON.stringify(session);
}

/**
 * Valida un payload guardado.
 *
 * Devuelve `null` cuando no hay nada restaurable (payload corrupto, formato
 * desconocido o cola vacía): el llamador limpia la fila y arranca en `idle`.
 * Los campos sueltos inválidos se normalizan en vez de descartar la sesión
 * entera, porque perder la cola por una posición corrupta sería peor.
 */
export function parseSession(raw: string | null | undefined): PlaybackSession | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const value = parsed as Partial<PlaybackSession>;
  const queueSongIds = toSongIds(value.queueSongIds);
  if (queueSongIds.length === 0) {
    return null;
  }
  const currentSongId = toSongId(value.currentSongId);
  const positionSeconds =
    typeof value.positionSeconds === 'number' && Number.isFinite(value.positionSeconds)
      ? Math.max(0, value.positionSeconds)
      : 0;
  const updatedAt =
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : Date.now();
  return {
    queueSongIds,
    currentSongId: currentSongId ?? queueSongIds[0] ?? null,
    positionSeconds,
    repeatMode: isRepeatMode(value.repeatMode) ? value.repeatMode : 'none',
    shuffle: value.shuffle === true,
    updatedAt,
  };
}

/**
 * Filtra la sesión contra los ids que existen hoy en la biblioteca.
 *
 * LÓGICA: los archivos pueden haberse borrado entre sesiones. Si la pista
 * actual desapareció, la sesión pasa a la primera superviviente; si no queda
 * ninguna, la cola resultante es vacía y el llamador limpia la fila.
 */
export function filterSessionToAvailable(
  session: PlaybackSession,
  availableIds: ReadonlySet<number>
): { session: PlaybackSession; removed: number } {
  const queueSongIds = session.queueSongIds.filter((id) => availableIds.has(id));
  const currentSongId =
    session.currentSongId !== null && queueSongIds.includes(session.currentSongId)
      ? session.currentSongId
      : (queueSongIds[0] ?? null);
  return {
    session: { ...session, queueSongIds, currentSongId },
    removed: session.queueSongIds.length - queueSongIds.length,
  };
}
