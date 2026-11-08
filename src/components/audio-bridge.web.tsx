import { useSyncExternalStore } from 'react';

import { AudioBridge as AudioBridgeInner } from '@/components/audio-bridge-inner';

/**
 * En web, `expo-audio` construye un elemento `Audio` durante el render, algo
 * que no existe en el renderizado estático de Node. Montamos el puente solo
 * después de la hidratación para que el HTML estático no falle.
 */

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AudioBridge() {
  const isClient = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  return isClient ? <AudioBridgeInner /> : null;
}
