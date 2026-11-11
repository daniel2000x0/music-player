import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioLockScreenOptions,
  type AudioMetadata,
  type AudioPlayer,
} from 'expo-audio';

import { logError } from '@/services/error-log.service';
import type { Song } from '@/types/song';

/**
 * Motor de audio de bajo nivel.
 *
 * LÓGICA: mantiene un único `AudioPlayer` fuera del ciclo de React para que
 * la reproducción sobreviva a la navegación. El estado de la cola vive en
 * Zustand (`player.store`) y este módulo solo ejecuta comandos nativos.
 */

/**
 * Botones visibles en notificación y pantalla bloqueada.
 *
 * LÓGICA: el `AudioPlayer` de una pista no implementa cola nativa, así que
 * los botones next/previous nativos no aplican (requieren `AudioPlaylist`,
 * verificado en `AudioControlsService.kt`); en su lugar se ofrecen los
 * botones de salto ±10 s, que sí operan sobre la pista actual. El salto de
 * 10 s coincide con el icono numerado nativo (5/10/15/30 s).
 */
const LOCK_SCREEN_OPTIONS: AudioLockScreenOptions = {
  showSeekBackward: true,
  showSeekForward: true,
  seekBackwardIntervalSeconds: 10,
  seekForwardIntervalSeconds: 10,
};

/** Metadatos que alimentan la sesión de medios (notificación + lock screen). */
function lockScreenMetadata(song: Song): AudioMetadata {
  return {
    title: song.title,
    artist: song.artist,
    albumTitle: song.album,
    artworkUrl: song.artwork ?? undefined,
  };
}

let player: AudioPlayer | null = null;

/**
 * `false` tras el primer fallo de los controles de pantalla de bloqueo.
 *
 * En Expo Go el servicio nativo `AudioControlsService` no existe (los config
 * plugins solo aplican a builds propias), así que `setActiveForLockScreen`
 * falla; recordar el fallo evita reintentar en cada cambio de pista.
 */
let lockScreenControlsSupported = true;

function withLockScreenGuard(action: string, run: () => void): void {
  if (!lockScreenControlsSupported) {
    return;
  }
  try {
    run();
  } catch (error) {
    lockScreenControlsSupported = false;
    logError('audio-engine', action, error);
    if (__DEV__) {
      console.warn(
        '[audio-engine] Controles de pantalla de bloqueo no disponibles ' +
          '(esperado en Expo Go; requieren development build):',
        error
      );
    }
  }
}

export function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 500 });
  }
  return player;
}

export function registerPlayer(instance: AudioPlayer): void {
  player = instance;
}

export async function configureAudioSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });
}

export function loadAndPlay(song: Song): void {
  const instance = getPlayer();
  instance.replace({ uri: song.uri });
  withLockScreenGuard('setActiveForLockScreen', () => {
    instance.setActiveForLockScreen(true, lockScreenMetadata(song), LOCK_SCREEN_OPTIONS);
  });
  instance.play();
}

export function updateLockScreenMetadata(song: Song): void {
  withLockScreenGuard('updateLockScreenMetadata', () => {
    getPlayer().updateLockScreenMetadata(lockScreenMetadata(song));
  });
}

/** Retira la notificación de medios y los controles del lock screen. */
export function clearLockScreenControls(): void {
  withLockScreenGuard('clearLockScreenControls', () => {
    getPlayer().clearLockScreenControls();
  });
}
