import { useEffect } from 'react';
import { AppState } from 'react-native';

import { tr } from '@/i18n';
import { getCurrentLanguage } from '@/i18n/current-language';
import {
  clearDegradation,
  configureAudioSession,
  degradeSession,
  getSession,
  promptNotificationPermission,
  subscribeLockScreenHealth,
  subscribePlaylistStatus,
  subscribeSession,
  subscribeTrackChange,
} from '@/services/audio';
import { flushSessionPersistence } from '@/services/audio/session-persistence';
import { watchMediaLibraryChanges } from '@/services/media-library-observer.service';
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
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Puente entre `expo-audio` y Zustand. El motor crea una única
 * `AudioPlaylist` fuera de React; aquí solo se configura la sesión de audio y
 * se publican los eventos nativos en el store.
 *
 * También mantiene el widget de pantalla de inicio: le empuja pista/estado y
 * traduce sus botones a las mismas acciones del store (un solo motor para la
 * app, la notificación, la pantalla de bloqueo y el widget). El permiso de
 * notificaciones se pide en la primera reproducción, con explicación (`M-01`).
 *
 * La sesión de reproducción se persiste en segundo plano (`A-01`): al pasar a
 * `background` se vuelca lo pendiente, porque el proceso puede morir sin más.
 */
export function AudioBridge() {
  const syncStatus = usePlayerStore((state) => state.syncStatus);
  const syncTrack = usePlayerStore((state) => state.syncTrack);
  const syncLockScreen = usePlayerStore((state) => state.syncLockScreen);
  const syncSessionState = usePlayerStore((state) => state.syncSessionState);

  useEffect(() => {
    void configureAudioSession();

    // El motor conserva la cola entre montajes; las suscripciones solo
    // conectan los eventos nativos con el estado de la app.
    const unsubscribeStatus = subscribePlaylistStatus(syncStatus);
    const unsubscribeTrack = subscribeTrackChange(syncTrack);
    // La máquina de estados publica cada transición: la UI puede comunicar una
    // sesión degradada (`C-01`) en vez de fallar en silencio.
    const unsubscribeSession = subscribeSession(syncSessionState);
    // La salud del lock screen se publica de inmediato y en cada reintento:
    // si se degrada, la sesión de UI lo refleja; si se recupera, vuelve al
    // estado real de reproducción.
    const unsubscribeLockScreen = subscribeLockScreenHealth((health) => {
      syncLockScreen(health);
      if (health.status === 'degraded') {
        degradeSession(
          health.lastError ??
            tr(getCurrentLanguage(), 'Controles de pantalla de bloqueo no disponibles')
        );
        return;
      }
      if (health.status === 'active' || health.status === 'unsupported') {
        clearDegradation(usePlayerStore.getState().isPlaying);
      }
    });

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
    // El permiso de notificaciones se pide en contexto (`M-01`): al arrancar la
    // primera reproducción, con explicación y acción, no al montar la app.
    const unsubscribeNotificationPrompt = usePlayerStore.subscribe((state, previous) => {
      if (state.isPlaying && !previous.isPlaying) {
        promptNotificationPermission();
      }
    });
    // Tema e idioma se resuelven al publicar; al cambiar cualquiera hay que
    // reescribir el snapshot aunque la reproducción esté en pausa (el servicio
    // detecta el cambio y no lo descarta por deduplicación).
    const unsubscribeWidgetSettings = useSettingsStore.subscribe((state, previous) => {
      if (state.theme === previous.theme && state.language === previous.language) {
        return;
      }
      const player = usePlayerStore.getState();
      syncMediaWidget(
        player.currentSong,
        player.isPlaying,
        getPlaybackPosition(),
        getPlaybackDuration()
      );
    });
    // El progreso se publica por separado: el servicio filtra los ticks y solo
    // escribe cuando cambia la pista/estado, hay un seek o pasa 1 segundo (para
    // que el reloj del widget avance segundo a segundo).
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
      // Una reubicación conserva el id de SQLite pero cambia la URI y la
      // carátula. Refrescar la cola evita que la notificación siga apuntando al
      // archivo (o al arte) que ya no existe.
      if (state.songs !== previous.songs) {
        const before = new Map(previous.songs.map((song) => [song.id, song]));
        const moved = state.songs.some((song) => {
          const previousSong = before.get(song.id);
          return (
            previousSong &&
            (previousSong.uri !== song.uri || previousSong.artwork !== song.artwork)
          );
        });
        if (moved) {
          usePlayerStore.getState().applyLibraryRefresh();
        }
      }
    });
    // Un cambio en MediaStore (mover/renombrar un archivo mientras la app está
    // abierta) dispara el mismo escaneo incremental que el arranque. El observador
    // agrupa las ráfagas de eventos de Android en una sola sincronización.
    const unsubscribeMediaChanges = watchMediaLibraryChanges(() => {
      void useLibraryStore.getState().sync();
    });
    // Al pasar a segundo plano se fuerza la escritura de la sesión pendiente:
    // Android puede matar el proceso sin dar otra oportunidad (`05` §7.3). Al
    // volver al primer plano se reproduce el escaneo que pudo perderse en background.
    let wasInBackground = AppState.currentState !== 'active';
    const appStateSubscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        wasInBackground = true;
        void flushSessionPersistence();
        return;
      }
      if (wasInBackground) {
        wasInBackground = false;
        void useLibraryStore.getState().sync();
      }
    });

    // Estado inicial de la sesión: si el motor ya arrancó antes de montar el
    // puente, la UI no debe quedarse en `idle`.
    syncSessionState(getSession());

    return () => {
      unsubscribeStatus();
      unsubscribeTrack();
      unsubscribeSession();
      unsubscribeLockScreen();
      unsubscribeWidgetState();
      unsubscribeNotificationPrompt();
      unsubscribeWidgetSettings();
      unsubscribeWidgetProgress();
      unsubscribeWidgetReconcile();
      unsubscribeWidgetInteractions();
      unsubscribeMediaChanges();
      appStateSubscription.remove();
    };
  }, [syncStatus, syncTrack, syncLockScreen, syncSessionState]);

  return null;
}
