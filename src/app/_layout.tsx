import {
  Stack,
  ThemeProvider,
  usePathname,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AudioBridge } from '@/components/audio-bridge';
import { MiniPlayer } from '@/components/mini-player';
import { NoticeBanner } from '@/components/notice-banner';
import { TabBarBaseHeight } from '@/constants/theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useAppUpdatePrompt } from '@/hooks/use-app-update-prompt';
import { useEffectiveColorScheme } from '@/hooks/use-effective-color-scheme';
import { useNavigationTheme } from '@/hooks/use-navigation-theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { setAppIconForTheme } from '@/services/app-icon.service';
import { logError } from '@/services/error-log.service';

// El store nace en `dark` hasta que SQLite responde. Retener el splash evita
// que se vea un destello oscuro cuando el usuario guardó otro tema.
void SplashScreen.preventAutoHideAsync();

/**
 * Layout raíz. Hidrata SQLite y los stores globales (biblioteca, ajustes y
 * motor de audio) y mantiene el mini-reproductor sobre toda la navegación.
 *
 * ORDEN: la sesión de reproducción se restaura después de la biblioteca,
 * porque sus ids se filtran contra las canciones que existen hoy (`A-01`).
 */
export default function RootLayout() {
  useAppUpdatePrompt();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const palette = useTheme();
  const scheme = useEffectiveColorScheme();
  const navigationTheme = useNavigationTheme();
  const reducedMotion = useReducedMotion();
  const hydrated = useSettingsStore((state) => state.hydrated);
  const showMiniPlayer = pathname !== '/player';

  // El mini-reproductor se apoya justo encima de la barra de pestañas
  // (49 px + área segura). En las pantallas fuera de las pestañas no hay
  // barra, así que solo respeta el área segura inferior.
  const isTabScreen = segments[0] === '(tabs)';
  const miniPlayerBottom = isTabScreen
    ? TabBarBaseHeight + insets.bottom
    : insets.bottom;

  useEffect(() => {
    void useSettingsStore
      .getState()
      .hydrate()
      // Reafirma el icono guardado. El SO ya lo conserva entre reinicios, pero
      // si un launcher o el sistema lo resetea, la app lo restaura. El servicio
      // compara con `getAppIconName()` y no toca nada si ya coincide.
      .then(() => setAppIconForTheme(useSettingsStore.getState().theme))
      .then(() => useLibraryStore.getState().hydrate())
      .then(() => usePlayerStore.getState().hydrateSession())
      .catch((error: unknown) => {
        // Ante un fallo de SQLite se muestra igualmente la app con el tema por
        // defecto; quedarse en blanco sería peor que perder la personalización.
        logError('settings', 'hydrate-failed', error);
        useSettingsStore.setState({ hydrated: true });
      })
      .finally(() => SplashScreen.hide());
  }, []);

  // En web, `color-scheme` alinea las barras de desplazamiento y los
  // controles del navegador con el tema elegido dentro de la app.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    document.documentElement.style.setProperty('color-scheme', scheme);
  }, [scheme]);

  // La UI no se monta hasta conocer el tema real; el splash sigue visible.
  if (!hydrated) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <StatusBar
          animated={!reducedMotion}
          style={scheme === 'dark' ? 'light' : 'dark'}
        />
        <AudioBridge />
        <NoticeBanner />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="player"
            options={{
              presentation: 'modal',
              animation: reducedMotion ? 'none' : 'slide_from_bottom',
            }}
          />
        </Stack>
        {showMiniPlayer ? <MiniPlayer bottomOffset={miniPlayerBottom} /> : null}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
