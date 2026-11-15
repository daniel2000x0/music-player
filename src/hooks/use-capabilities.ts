import { useSyncExternalStore } from 'react';

import {
  getCapabilities,
  subscribeCapabilities,
  type CapabilityMap,
} from '@/services/capabilities';

/**
 * Capacidades del entorno reactivas.
 *
 * LÓGICA: `capabilities` no vive en Zustand porque se deriva de `Platform`,
 * el entorno de ejecución y los permisos. `useSyncExternalStore` suscribe la
 * pantalla a los cambios sin duplicar el estado en un store.
 */
export function useCapabilities(): CapabilityMap {
  return useSyncExternalStore(
    subscribeCapabilities,
    getCapabilities,
    getCapabilities
  );
}
