import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Colors } from '@/constants/theme';
import { useSettingsStore } from '@/stores/settings.store';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  function TabBarIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} size={size} color={typeof color === 'string' ? color : undefined} />;
  }
  return TabBarIcon;
}

/**
 * Las pestañas principales: Inicio, Canciones, Álbumes, Audiolibros,
 * Playlists y Configuración. Los detalles (álbum, artista, playlist, cola)
 * viven fuera del grupo para que el tab bar no aparezca en ellos.
 */
export default function TabsLayout() {
  const theme = useSettingsStore((state) => state.theme);
  const palette = Colors[theme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarStyle: {
          backgroundColor: palette.backgroundElement,
          borderTopColor: palette.border,
        },
        sceneStyle: { backgroundColor: palette.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="songs" options={{ title: 'Canciones', tabBarIcon: icon('musical-notes') }} />
      <Tabs.Screen name="albums" options={{ title: 'Álbumes', tabBarIcon: icon('albums') }} />
      <Tabs.Screen name="audiobooks" options={{ title: 'Audiolibros', tabBarIcon: icon('book') }} />
      <Tabs.Screen name="playlists" options={{ title: 'Playlists', tabBarIcon: icon('list') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
