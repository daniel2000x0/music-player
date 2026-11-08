import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AudioBridge } from '@/components/audio-bridge';
import { MiniPlayer } from '@/components/mini-player';
import { BottomTabInset, Colors } from '@/constants/theme';
import { useLibraryStore } from '@/stores/library.store';
import { useSettingsStore } from '@/stores/settings.store';

/**
 * Layout raíz. Hidrata SQLite y los stores globales (biblioteca, ajustes y
 * motor de audio) y mantiene el mini-reproductor sobre toda la navegación.
 */
export default function RootLayout() {
  const pathname = usePathname();
  const theme = useSettingsStore((state) => state.theme);
  const showMiniPlayer = pathname !== '/player';

  useEffect(() => {
    void useSettingsStore
      .getState()
      .hydrate()
      .then(() => useLibraryStore.getState().hydrate());
  }, []);

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
        {showMiniPlayer ? <MiniPlayer bottomOffset={BottomTabInset} /> : null}
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
