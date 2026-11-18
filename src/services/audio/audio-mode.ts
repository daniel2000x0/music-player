import { requestNotificationPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Linking, Platform } from 'react-native';

import { getCapabilities, setPermissionSnapshot } from '@/services/capabilities';
import { logError } from '@/services/error-log.service';
import { useNoticeStore } from '@/stores/notice.store';

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

/** Código del aviso de permiso: deduplica y permite reemplazarlo al denegar. */
const NOTIFICATION_NOTICE_CODE = 'playback.notifications';

/** El aviso se ofrece una sola vez por sesión: no se insiste al reproducir. */
let notificationPromptShown = false;

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

/**
 * Ofrece el permiso de notificaciones en contexto, en la primera reproducción.
 *
 * LÓGICA (`M-01`): pedirlo al montar la app no explica para qué sirve y el
 * usuario lo deniega sin información. Aquí se explica y se ofrece una acción;
 * si la deniega, el aviso pasa a advertencia y ofrece «Abrir ajustes», así la
 * decisión es visible y reversible. `capabilities` refleja el resultado y el
 * resto de la UI puede degradar con honestidad.
 */
export function promptNotificationPermission(): void {
  if (Platform.OS !== 'android' || notificationPromptShown) {
    return;
  }
  if (getCapabilities()['playback.notifications']) {
    return;
  }
  notificationPromptShown = true;
  useNoticeStore.getState().push({
    code: NOTIFICATION_NOTICE_CODE,
    severity: 'info',
    title: 'Controles en la pantalla de bloqueo',
    message:
      'Permite las notificaciones para controlar la reproducción desde la pantalla de bloqueo y la barra de notificaciones.',
    action: { label: 'Permitir', onPress: () => void grantNotificationPermission() },
  });
}

/** Resuelve el diálogo del sistema y actualiza el aviso con el resultado. */
async function grantNotificationPermission(): Promise<void> {
  await requestNotificationPermission();
  if (getCapabilities()['playback.notifications']) {
    useNoticeStore.getState().dismiss(NOTIFICATION_NOTICE_CODE);
    return;
  }
  useNoticeStore.getState().push({
    code: NOTIFICATION_NOTICE_CODE,
    severity: 'warning',
    title: 'Notificaciones desactivadas',
    message:
      'Sin notificaciones, los controles del sistema no aparecerán. Actívalas en los ajustes del sistema.',
    action: { label: 'Abrir ajustes', onPress: () => void Linking.openSettings() },
  });
}
