import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { CategoryBar, type CategoryOption } from '@/components/category-bar';
import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { ThemeMode } from '@/types/settings';

const THEMES: readonly CategoryOption<ThemeMode>[] = [
  { key: 'dark', label: 'Oscuro' },
  { key: 'light', label: 'Claro' },
];

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  destructive?: boolean;
  onPress: () => void;
};

function ActionRow({ icon, title, description, destructive, onPress }: RowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={22} color={destructive ? theme.danger : theme.textSecondary} />
      <View style={styles.rowInfo}>
        <ThemedText type="smallBold" style={destructive ? { color: theme.danger } : undefined}>
          {title}
        </ThemedText>
        {description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

/** Pantalla "Configuración": tema, biblioteca y datos administrativos. */
export default function SettingsScreen() {
  const theme = useTheme();
  const themeMode = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const songs = useLibraryStore((state) => state.songs);
  const playlists = useLibraryStore((state) => state.playlists);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isScanning = useLibraryStore((state) => state.isScanning);
  const requestAccess = useLibraryStore((state) => state.requestAccess);
  const refresh = useLibraryStore((state) => state.refresh);
  const clearHistory = useLibraryStore((state) => state.clearHistory);
  const clearAdministrativeData = useLibraryStore((state) => state.clearAdministrativeData);
  const [working, setWorking] = useState(false);

  const confirmClearHistory = () => {
    Alert.alert(
      'Borrar historial',
      'Se eliminarán las reproducciones recientes y los contadores de escucha. Tus canciones y playlists se conservan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: () => {
            setWorking(true);
            void clearHistory().finally(() => setWorking(false));
          },
        },
      ]
    );
  };

  const confirmClearAll = () => {
    Alert.alert(
      'Borrar datos administrativos',
      'Se eliminarán favoritos, playlists, historial y estadísticas. Los archivos de audio del dispositivo no se borran.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: () => {
            setWorking(true);
            void clearAdministrativeData().finally(() => setWorking(false));
          },
        },
      ]
    );
  };

  return (
    <ScreenShell title="Configuración" subtitle="Apariencia y administración de la biblioteca">
      <View>
        <SectionHeader title="Apariencia" />
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Tema de la aplicación</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Elige entre modo oscuro o claro. Se guarda en tu dispositivo.
          </ThemedText>
          <CategoryBar options={THEMES} value={themeMode} onChange={(value) => void setTheme(value)} />
        </View>
      </View>

      <View>
        <SectionHeader title="Biblioteca" />
        <View style={styles.section}>
          <ActionRow
            icon="musical-notes-outline"
            title={`${songs.length} canciones`}
            description={`${playlists.length} playlists · ${
              hasPermission ? 'permiso concedido' : 'sin permiso de audio'
            }`}
            onPress={() => {
              if (hasPermission) {
                void refresh();
              } else {
                void requestAccess();
              }
            }}
          />
          <ActionRow
            icon={hasPermission ? 'refresh' : 'lock-open-outline'}
            title={hasPermission ? 'Volver a escanear' : 'Conceder permiso de audio'}
            description={
              hasPermission
                ? 'Busca canciones nuevas o eliminadas en el dispositivo.'
                : 'Necesario para leer la música almacenada.'
            }
            onPress={() => {
              if (hasPermission) {
                void refresh();
              } else {
                void requestAccess();
              }
            }}
          />
          {isScanning ? (
            <View style={styles.scanning}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="small" themeColor="textSecondary">
                Escaneando biblioteca…
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <View>
        <SectionHeader title="Datos" />
        <View style={styles.section}>
          <ActionRow
            icon="time-outline"
            title="Borrar historial de reproducción"
            description="Reinicia contadores e historial, conserva playlists."
            onPress={confirmClearHistory}
          />
          <ActionRow
            icon="trash-outline"
            title="Borrar datos administrativos"
            description="Favoritos, playlists, historial y estadísticas."
            destructive
            onPress={confirmClearAll}
          />
          {working ? (
            <View style={styles.scanning}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : null}
        </View>
      </View>

      <View>
        <SectionHeader title="Acerca de" />
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">Mi Música</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Versión {Constants.expoConfig?.version ?? '1.0.0'} · Biblioteca local con SQLite
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            La reproducción en segundo plano y los controles de pantalla bloqueada requieren
            un development build (no funcionan en Expo Go).
          </ThemedText>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  rowInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
  scanning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
