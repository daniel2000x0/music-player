import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import type { Song } from '@/types/song';

/**
 * Motor de audio de bajo nivel.
 *
 * LÓGICA: mantiene un único `AudioPlayer` fuera del ciclo de React para que
 * la reproducción sobreviva a la navegación. El estado de la cola vive en
 * Zustand (`player.store`) y este módulo solo ejecuta comandos nativos.
 */

let player: AudioPlayer | null = null;

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
  instance.setActiveForLockScreen(true, {
    title: song.title,
    artist: song.artist,
    albumTitle: song.album,
  });
  instance.play();
}

export function updateLockScreenMetadata(song: Song): void {
  getPlayer().updateLockScreenMetadata({
    title: song.title,
    artist: song.artist,
    albumTitle: song.album,
  });
}
