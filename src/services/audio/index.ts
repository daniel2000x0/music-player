/**
 * Fachada del motor de audio.
 *
 * RESPONSABILIDAD ÚNICA: re-exportar la API pública del motor y las
 * capacidades del entorno. La implementación se reparte en módulos con una
 * responsabilidad cada uno: `native-playlist` (ciclo de vida de la playlist y
 * volumen), `playlist-edits` (edición de la cola), `lock-screen` (sesión de
 * medios), `audio-mode` (modo de audio y permisos), `session` (máquina de
 * estados), `session-persistence` (cuándo se guarda la sesión) y `queue`
 * (orquestación de la reproducción).
 */

export type { LockScreenHealth, LockScreenStatus } from '@/services/audio/lock-screen';
export type { PlaybackStatus, RepeatMode } from '@/services/audio/native-playlist';
export type { SessionSnapshot, SessionState } from '@/services/audio/session';
export { getLockScreenHealth, subscribeLockScreenHealth } from '@/services/audio/lock-screen';
export {
  configureAudioSession,
  requestNotificationPermission,
} from '@/services/audio/audio-mode';
export { getCapabilities } from '@/services/capabilities';
export {
  clearDegradation,
  degradeSession,
  getSession,
  subscribeSession,
  transitionTo,
} from '@/services/audio/session';
export {
  getCurrentIndex,
  getTrackCount,
  getVolume,
  hasQueue,
  nextTrack,
  previousTrack,
  seekTo,
  setLoop,
  setVolume,
} from '@/services/audio/native-playlist';
export { appendToPlaylist as appendSong, insertAfterCurrent, removeSongById } from '@/services/audio/playlist-edits';
export {
  subscribePlaylistStatus,
  subscribeTrackChange,
} from '@/services/audio/events';
export {
  maintainWindow,
  pause,
  rebuildQueue,
  startQueue,
  stopPlayback,
  togglePlayback,
} from '@/services/audio/queue';
