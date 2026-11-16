import { requestNotificationPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { setPermissionSnapshot } from '@/services/capabilities';
import { logError } from '@/services/error-log.service';

/**
 * Configuración del modo de audio y permisos del sistema.
 *
 * RESPONSABILIDAD ÚNICA: preparar la sesión de audio para reproducción en
 * segundo plano y resolver el permiso de notificaciones. Los fallos se
 * reintentan con espera acotada y quedan en `error_logs`; no se propaga la
 * excepción porque un build sin soporte no debe impedir reproducir.
 */

/** Esperas antes de reintentar la configuración de la sesión de audio. */
const AUDIO_MODE_RETRY_DELAYS_MS = [1000, 3000] as const;

let configuring: Promise<void> | null = null;

async function applyAudioMode(attempt: number): Promise<void> {
  try {
    // `doNotMix` es obligatorio para que Android asocie la sesión de medios a
    // la playlist (requisito documentado de `setActiveForLockScreen`).
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  } catch (error) {
    logError('audio/mode', 'setAudioModeAsync', error);
    const delay = AUDIO_MODE_RETRY_DELAYS_MS[attempt];
    if (delay === undefined) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    await applyAudioMode(attempt + 1);
  }
}

/**
 * Configura la sesión de audio una sola vez.
 *
 * RENDIMIENTO: el puente de React puede montarse varias veces; se comparte la
 * misma promesa en vuelo y se evita repetir la llamada nativa.
 */
export function configureAudioSession(): Promise<void> {
  if (!configuring) {
    configuring = applyAudioMode(0).finally(() => {
      configuring = null;
    });
  }
  return configuring;
}

/**
 * Pide permiso de notificaciones en Android (API 33+).
 *
 * Sin este permiso el sistema puede ocultar los controles de reproducción de
 * la bandeja de notificaciones aunque el servicio de medios esté activo.
 */
export async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    const { granted } = await requestNotificationPermissionsAsync();
    setPermissionSnapshot({ notifications: granted });
    if (!granted && __DEV__) {
      console.warn(
        '[audio/mode] Permiso de notificaciones denegado: los controles de reproducción podrían no mostrarse.'
      );
    }
  } catch (error) {
    logError('audio/mode', 'requestNotificationPermissionsAsync', error);
  }
}
