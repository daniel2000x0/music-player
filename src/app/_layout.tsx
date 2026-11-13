import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  usePathname,
  useSegments,
} from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AudioBridge } from '@/components/audio-bridge';
import { MiniPlayer } from '@/components/mini-player';
import { Colors, TabBarBaseHeight } from '@/constants/theme';
import { useLibraryStore } from '@/stores/library.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useAppUpdatePrompt } from '@/hooks/use-app-update-prompt';

/**
 * Layout raíz. Hidrata SQLite y los stores globales (biblioteca, ajustes y
 * motor de audio) y mantiene el mini-reproductor sobre toda la navegación.
 */
export default function RootLayout() {
  useAppUpdatePrompt();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const theme = useSettingsStore((state) => state.theme);
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
      .then(() => useLibraryStore.getState().hydrate());
  }, []);

  // En web, `color-scheme` alinea las barras de desplazamiento y los
  // controles del navegador con el tema elegido dentro de la app.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    document.documentElement.style.setProperty('color-scheme', theme);
  }, [theme]);

  const navigationTheme = useMemo(() => {
    const base = theme === 'dark' ? DarkTheme : DefaultTheme;
    const palette = Colors[theme];
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.accent,
        background: palette.background,
        card: palette.backgroundElement,
        text: palette.text,
        border: palette.border,
        notification: palette.danger,
      },
    };
  }, [theme]);

  return (
    <ThemeProvider value={navigationTheme}>
      <View style={[styles.root, { backgroundColor: Colors[theme].background }]}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <AudioBridge />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors[theme].background },
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="player"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
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
