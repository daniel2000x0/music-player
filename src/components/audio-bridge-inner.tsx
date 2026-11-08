import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect } from 'react';

import { configureAudioSession, registerPlayer } from '@/services/audio-engine';
import { usePlayerStore } from '@/stores/player.store';

/**
 * Puente entre `expo-audio` y Zustand. Monta un único reproductor cuyo ciclo
 * de vida coincide con la app y publica el estado nativo en el store.
 */
export function AudioBridge() {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const syncStatus = usePlayerStore((state) => state.syncStatus);
  const handleDidFinish = usePlayerStore((state) => state.handleDidFinish);

  useEffect(() => {
    registerPlayer(player);
    void configureAudioSession();
  }, [player]);

  useEffect(() => {
    syncStatus(status);
  }, [status, syncStatus]);

  useEffect(() => {
    if (status.didJustFinish) {
      handleDidFinish();
    }
  }, [status.didJustFinish, handleDidFinish]);

  return null;
}
