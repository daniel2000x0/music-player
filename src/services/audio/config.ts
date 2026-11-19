/**
 * Constantes de temporalización del motor de audio (`B-05`).
 *
 * Antes estaban repartidas entre `native-playlist`, `lock-screen`,
 * `audio-mode` y `player.store`. Centralizarlas permite ajustar la cadencia
 * de ticks, el backoff y los timeouts en un solo sitio y documentar por qué
 * cada valor existe, sin tocar la lógica que los consume.
 */
export const AUDIO_CONFIG = {
  /** Cadencia de los ticks de posición/duración del motor (ms). */
  updateIntervalMs: 500,
  /** Backoff de la sesión de medios: 1 s → 3 s → 10 s, luego `degraded`. */
  lockScreenRetryDelaysMs: [1000, 3000, 10000],
  /** Backoff de `setAudioModeAsync`: 1 s → 3 s, luego se deja de reintentar. */
  audioModeRetryDelaysMs: [1000, 3000],
  /** Espera máxima a que el nativo confirme un seek antes de aceptar su tick. */
  seekConfirmationTimeoutMs: 1500,
  /** Retardo con el que se persiste el volumen tras el último arrastre. */
  volumePersistDebounceMs: 500,
  /** Código del aviso contextual del permiso de notificaciones. */
  notificationNoticeCode: 'playback.notifications',
} as const;
