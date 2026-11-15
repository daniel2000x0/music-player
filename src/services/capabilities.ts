import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Capacidades del entorno.
 *
 * RESPONSABILIDAD ÚNICA: decir qué puede prometer la app antes de pintar la
 * UI, para degradar con honestidad (`A-04`) en vez de fallar en silencio.
 *
 * LÓGICA: no hace red ni escaneos. Solo consulta `Platform`, el entorno de
 * ejecución de expo-constants y los permisos ya resueltos que los servicios
 * publican con `setPermissionSnapshot`. Es reactivo porque los permisos
 * cambian en tiempo de ejecución.
 */

export type Capability =
  | 'playback.background'
  | 'playback.lockScreen'
  | 'playback.notifications'
  | 'mediaLibrary.read'
  | 'widget.homeScreen'
  | 'library.incrementalScan'
  | 'library.albumFolderGrouping';

export type CapabilityMap = Record<Capability, boolean>;

export type PermissionSnapshot = {
  mediaLibrary: boolean;
  notifications: boolean;
};

const NATIVE = Platform.OS === 'android' || Platform.OS === 'ios';
const IS_EXPO_GO =
  Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

let permissions: PermissionSnapshot = { mediaLibrary: false, notifications: false };
let cached: CapabilityMap | null = null;
const listeners = new Set<(capabilities: CapabilityMap) => void>();

function compute(): CapabilityMap {
  return {
    // La reproducción sigue con la app en segundo plano solo en builds nativos.
    'playback.background': NATIVE,
    // Expo Go no declara el servicio de medios y no puede registrar la sesión.
    'playback.lockScreen': NATIVE && !IS_EXPO_GO,
    // iOS muestra los controles sin permiso explícito; Android 13+ lo exige.
    'playback.notifications': NATIVE && (Platform.OS === 'ios' || permissions.notifications),
    'mediaLibrary.read': NATIVE && permissions.mediaLibrary,
    // El widget se configura para Android en `app.json`.
    'widget.homeScreen': Platform.OS === 'android' && !IS_EXPO_GO,
    // La mediateca expone fecha de modificación en ambas plataformas nativas.
    'library.incrementalScan': NATIVE,
    // En nativo conviven `file://` y `content://`; la agrupación los contempla.
    'library.albumFolderGrouping': NATIVE,
  };
}

function emit(): void {
  const value = getCapabilities();
  for (const listener of listeners) {
    listener(value);
  }
}

/** Fotografía actual; no hace trabajo asíncrono. */
export function getCapabilities(): CapabilityMap {
  if (!cached) {
    cached = compute();
  }
  return cached;
}

/** Actualiza los permisos conocidos y notifica solo si algo cambió. */
export function setPermissionSnapshot(
  next: Partial<PermissionSnapshot>
): CapabilityMap {
  const previous = permissions;
  permissions = { ...permissions, ...next };
  if (
    permissions.mediaLibrary === previous.mediaLibrary &&
    permissions.notifications === previous.notifications
  ) {
    return getCapabilities();
  }
  cached = null;
  emit();
  return getCapabilities();
}

/** Suscribe un oyente; emite el mapa actual de inmediato. */
export function subscribeCapabilities(
  listener: (capabilities: CapabilityMap) => void
): () => void {
  listeners.add(listener);
  listener(getCapabilities());
  return () => {
    listeners.delete(listener);
  };
}
