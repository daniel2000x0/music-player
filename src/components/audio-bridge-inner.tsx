import { useEffect } from 'react';

import {
  configureAudioSession,
  requestNotificationPermission,
  subscribeLockScreenHealth,
  subscribePlaylistStatus,
  subscribeTrackChange,
} from '@/services/audio-engine';
import {
  reconcileMediaWidget,
  registerMediaWidgetInteractions,
  syncMediaWidget,
} from '@/services/media-widget.service';
import {
  getPlaybackDuration,
  getPlaybackPosition,
  subscribePlaybackProgress,
} from '@/stores/playback-progress';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';

/**
 * Puente entre `expo-audio` y Zustand. El motor crea una única
 * `AudioPlaylist` fuera de React; aquí solo se configura la sesión de audio y
 * se publican los eventos nativos en el store.
 *
 * También mantiene el widget de pantalla de inicio: le empuja pista/estado y
 * traduce sus botones a las mismas acciones del store (un solo motor para la
 * app, la notificación, la pantalla de bloqueo y el widget).
 */
export function AudioBridge() {
  const syncStatus = usePlayerStore((state) => state.syncStatus);
  const syncTrack = usePlayerStore((state) => state.syncTrack);
  const syncLockScreen = usePlayerStore((state) => state.syncLockScreen);

  useEffect(() => {
    void configureAudioSession();
    void requestNotificationPermission();

    // El motor conserva la cola entre montajes; las suscripciones solo
    // conectan los eventos nativos con el estado de la app.
    const unsubscribeStatus = subscribePlaylistStatus(syncStatus);
    const unsubscribeTrack = subscribeTrackChange(syncTrack);
    // La salud del lock screen se publica de inmediato y en cada reintento:
    // la UI puede avisar de una sesión degradada en vez de fallar en silencio.
    const unsubscribeLockScreen = subscribeLockScreenHealth(syncLockScreen);

    const unsubscribeWidgetInteractions = registerMediaWidgetInteractions();
    const initial = usePlayerStore.getState();
    syncMediaWidget(
      initial.currentSong,
      initial.isPlaying,
      getPlaybackPosition(),
      getPlaybackDuration()
    );
    const unsubscribeWidgetState = usePlayerStore.subscribe((state, previous) => {
      if (state.currentSong === previous.currentSong && state.isPlaying === previous.isPlaying) {
        return;
      }
      syncMediaWidget(
        state.currentSong,
        state.isPlaying,
        getPlaybackPosition(),
        getPlaybackDuration()
      );
    });
    // El progreso se publica por separado: el servicio filtra los ticks y solo
    // escribe cuando cambia la pista/estado, hay un seek o pasan ~5 segundos.
    const unsubscribeWidgetProgress = subscribePlaybackProgress((position, duration) => {
      const player = usePlayerStore.getState();
      syncMediaWidget(player.currentSong, player.isPlaying, position, duration);
    });
    // El widget nativo sobrevive a la muerte del proceso: al hidratar la
    // biblioteca (o terminar un escaneo) se revalida contra el store (`M-06`).
    const unsubscribeWidgetReconcile = useLibraryStore.subscribe((state, previous) => {
      if (
        state.hydrated !== previous.hydrated ||
        state.lastScanReport !== previous.lastScanReport
      ) {
        reconcileMediaWidget();
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeTrack();
      unsubscribeLockScreen();
      unsubscribeWidgetState();
      unsubscribeWidgetProgress();
      unsubscribeWidgetReconcile();
      unsubscribeWidgetInteractions();
    };
  }, [syncStatus, syncTrack, syncLockScreen]);

  return null;
}
