import type { ImageSource } from 'expo-image';

import type { ThemeMode } from '@/types/settings';

/**
 * Fondos de pantalla propios por tema.
 *
 * LÓGICA: cada héroe tiene su imagen en `assets/images/background/` y se
 * asocia por id de tema. Claro y Oscuro no tienen imagen y siguen pintando el
 * fondo plano de siempre. La imagen se combina con una veladura (`backdropScrim`)
 * para mantener el texto legible.
 */
const BACKDROPS: Partial<Record<ThemeMode, ImageSource>> = {
  ironman: require('../../assets/images/background/ironman/ironman.jpg'),
  avengers: require('../../assets/images/background/avengers.jpg'),
  capitanAmerica: require('../../assets/images/background/capitan america.jpg'),
  spiderman: require('../../assets/images/background/spiderman.jpg'),
  superman: require('../../assets/images/background/superman.jpg'),
  greenLantern: require('../../assets/images/background/greenlantern.jpg'),
};

export function themeBackdrop(theme: ThemeMode): ImageSource | null {
  return BACKDROPS[theme] ?? null;
}

export function hasThemeBackdrop(theme: ThemeMode): boolean {
  return themeBackdrop(theme) != null;
}
