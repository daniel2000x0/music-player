import { addListener, type EventSubscription } from 'expo-media-library';
import { AppState } from 'react-native';

import { logError } from '@/services/error-log.service';

/**
 * Observa cambios de la mediateca y avisa una sola vez por ráfaga.
 *
 * LÓGICA: mover un archivo dentro de MediaStore dispara varios eventos
 * (`mediaLibraryDidChange`) en poco tiempo. Android no entrega información
 * incremental útil (`hasIncrementalChanges === false`), así que el evento se
 * usa solo como disparo: se agrupa con un debounce y se resuelve con el
 * escaneo incremental ya existente, que compara por `mediaId` y huella.
 *
 * Mientras la app está en segundo plano no se escanea: el trabajo se retrasa
 * hasta que vuelve al primer plano (donde `AudioBridge` también lo solicita).
 */

/** Milisegundos de calma antes de propagar el evento. */
export const MEDIA_OBSERVER_DEBOUNCE_MS = 1_200;

export function watchMediaLibraryChanges(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      if (AppState.currentState !== 'active') {
        return;
      }
      try {
        onChange();
      } catch (error) {
        logError('media-observer', 'onChange', error);
      }
    }, MEDIA_OBSERVER_DEBOUNCE_MS);
  };

  let subscription: EventSubscription;
  try {
    subscription = addListener(schedule);
  } catch (error) {
    // Expo Go o un motor sin soporte de eventos: el escaneo de arranque y el
    // manual siguen funcionando, simplemente no hay aviso automático.
    logError('media-observer', 'addListener', error);
    return () => undefined;
  }

  return () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    subscription.remove();
  };
}
