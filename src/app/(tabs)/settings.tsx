import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { CategoryBar, type CategoryOption } from '@/components/category-bar';
import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  applyAppUpdate,
  checkForAppUpdate,
  downloadAppUpdate,
} from '@/services/update.service';
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

// Fila reutilizable para las opciones de configuración.
function ActionRow({
  icon,
  title,
  description,
  destructive,
  onPress,
}: RowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={destructive ? theme.danger : theme.textSecondary}
      />

      <View style={styles.rowInfo}>
        <ThemedText
          type="smallBold"
          style={destructive ? { color: theme.danger } : undefined}
        >
          {title}
        </ThemedText>

        {description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        ) : null}
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.textSecondary}
      />
    </Pressable>
  );
}

// Sección de actualizaciones OTA.
type UpdateSectionProps = {
  onCheckUpdates: () => Promise<string>;
};

// Componente independiente para consultar actualizaciones.
function UpdateSection({ onCheckUpdates }: UpdateSectionProps) {
  const theme = useTheme();

  // Estado local de la consulta de actualizaciones.
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCheckUpdates = async () => {
    if (loading) return;

    setLoading(true);
    setMessage('');

    try {
      const result = await onCheckUpdates();
      setMessage(result);
    } catch {
      setMessage('No se pudieron consultar las actualizaciones.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={() => void handleCheckUpdates()}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel="Buscar actualizaciones"
      style={({ pressed }) => [
        styles.updateCard,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.updateIcon}>
        {loading ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Ionicons
            name="cloud-download-outline"
            size={25}
            color={theme.accent}
          />
        )}
      </View>

      <View style={styles.updateInfo}>
        <ThemedText type="smallBold">
          {loading
            ? 'Buscando actualizaciones...'
            : 'Buscar actualizaciones'}
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {message || 'Consulta si hay novedades disponibles'}
        </ThemedText>
      </View>

      {!loading && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={theme.textSecondary}
        />
      )}
    </Pressable>
  );
}

/** Pantalla de configuración: apariencia y administración. */
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
  const clearAdministrativeData = useLibraryStore(
    (state) => state.clearAdministrativeData
  );

  const [working, setWorking] = useState(false);

  // Consulta real de OTA: informa el estado y, si hay actualización, ofrece
  // descargarla y reiniciar. En web/Expo Go las actualizaciones no aplican.
  const checkForUpdates = useCallback(async (): Promise<string> => {
    if (Platform.OS === 'web') {
      return 'Las actualizaciones OTA no están disponibles en la versión web.';
    }

    const status = await checkForAppUpdate();

    if (status === 'disabled') {
      return 'No disponible en Expo Go ni en modo desarrollo.';
    }

    if (status === 'not-available') {
      return 'Ya tienes la última versión instalada.';
    }

    const accepted = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Actualización disponible',
        'Hay una nueva versión del reproductor. ¿Deseas descargarla ahora?',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Descargar', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });

    if (!accepted) {
      return 'Actualización disponible. Puedes instalarla más tarde.';
    }

    await downloadAppUpdate();

    Alert.alert(
      'Actualización descargada',
      'La actualización está lista. Reinicia la aplicación para aplicarla.',
      [
        { text: 'Después', style: 'cancel' },
        {
          text: 'Reiniciar ahora',
          onPress: () => {
            void applyAppUpdate();
          },
        },
      ]
    );

    return 'Actualización descargada. Reinicia la app para aplicarla.';
  }, []);

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
            void clearAdministrativeData().finally(() =>
              setWorking(false)
            );
          },
        },
      ]
    );
  };

  return (
    <ScreenShell
      title="Configuración"
      subtitle="Apariencia y administración de la biblioteca"
    >
      {/* APARIENCIA */}
      <View>
        <SectionHeader title="Apariencia" />

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <ThemedText type="smallBold">
            Tema de la aplicación
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            Elige entre modo oscuro o claro. Se guarda en tu dispositivo.
          </ThemedText>

          <CategoryBar
            options={THEMES}
            value={themeMode}
            onChange={(value) => void setTheme(value)}
          />
        </View>
      </View>

      {/* BIBLIOTECA */}
      <View>
        <SectionHeader title="Biblioteca" />

        <View style={styles.section}>
          <ActionRow
            icon="musical-notes-outline"
            title={`${songs.filter((song) => !song.isAudiobook).length} canciones`}
            description={`${playlists.length} playlists · ${
              hasPermission
                ? 'permiso concedido'
                : 'sin permiso de audio'
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
            title={
              hasPermission
                ? 'Volver a escanear'
                : 'Conceder permiso de audio'
            }
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

      {/* DATOS */}
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

      {/* DIAGNÓSTICO */}
      <View>
        <SectionHeader title="Diagnóstico" />

        <View style={styles.section}>
          <ActionRow
            icon="bug-outline"
            title="Registro de errores"
            description="Errores y advertencias guardados en el dispositivo."
            onPress={() => router.push('/logs')}
          />
        </View>
      </View>

      {/* ACERCA DE */}
      <View>
        <SectionHeader title="Acerca de" />

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <ThemedText type="smallBold">
            Mi Música
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            Versión {Constants.expoConfig?.version ?? '1.0.0'} ·
            Biblioteca local con SQLite
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            La reproducción en segundo plano y los controles de pantalla
            bloqueada requieren un development build (no funcionan en Expo Go).
          </ThemedText>
        </View>
      </View>

      {/* ACTUALIZACIONES */}
      <View>
        <SectionHeader title="Actualizaciones" />

        <View style={styles.section}>
          <UpdateSection onCheckUpdates={checkForUpdates} />
        </View>
      </View>
    </ScreenShell>
  );
}

// ESTILOS
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

  updateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },

  updateIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  updateInfo: {
    flex: 1,
    gap: Spacing.half,
  },
});
