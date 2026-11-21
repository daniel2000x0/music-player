import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';
import type { AlternateAppIcons } from 'expo-alternate-app-icons';

import { themeAppIcon } from '@/constants/theme-catalog';
import { logError } from '@/services/error-log.service';
import type { ThemeMode } from '@/types/settings';

/**
 * Cambia el icono del launcher cuando se elige una familia de superhéroe.
 *
 * LÓGICA: el módulo `expo-alternate-app-icons` incluye código nativo, así que
 * Expo Go no lo tiene. Se comprueba el módulo real antes de importarlo (misma
 * técnica que el widget) y se degrada a `unsupported` sin lanzar. En un build
 * de desarrollo/EAS el icono se cambia en caliente y el sistema lo persiste.
 */
const NATIVE_AVAILABLE =
  Platform.OS !== 'web' && requireOptionalNativeModule('ExpoAlternateAppIcons') != null;

export type AppIconChangeResult = 'changed' | 'unchanged' | 'unsupported' | 'error';

export function canChangeAppIcon(): boolean {
  return NATIVE_AVAILABLE;
}

export async function setAppIconForTheme(theme: ThemeMode): Promise<AppIconChangeResult> {
  if (!NATIVE_AVAILABLE) {
    return 'unsupported';
  }

  try {
    const icons = await import('expo-alternate-app-icons');
    if (!icons.supportsAlternateIcons) {
      return 'unsupported';
    }

    const name = themeAppIcon(theme);
    if (icons.getAppIconName() === name) {
      return 'unchanged';
    }

    await icons.setAlternateAppIcon(name as AlternateAppIcons);
    return 'changed';
  } catch (error) {
    logError('app-icon', 'set-failed', error);
    return 'error';
  }
}
