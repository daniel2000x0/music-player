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

import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader } from '@/components/section-header';
import { ThemePicker } from '@/components/theme-picker';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { describeScanProgress } from '@/domain/library/scan-progress';
import { describeScanReport } from '@/domain/library/scan-report';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useTheme } from '@/hooks/use-theme';
import { canChangeAppIcon, setAppIconForTheme } from '@/services/app-icon.service';
import type { Capability } from '@/services/capabilities';
import {
  applyAppUpdate,
  checkForAppUpdate,
  downloadAppUpdate,
} from '@/services/update.service';
import { useLibraryStore } from '@/stores/library.store';
import { useNoticeStore } from '@/stores/notice.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { ThemeMode } from '@/types/settings';

const CAPABILITY_LABELS: readonly { key: Capability; label: string }[] = [
  { key: 'playback.background', label: 'Reproducción en segundo plano' },
  { key: 'playback.lockScreen', label: 'Controles del sistema' },
  { key: 'playback.notifications', label: 'Notificaciones de reproducción' },
  { key: 'mediaLibrary.read', label: 'Lectura de la mediateca' },
  { key: 'widget.homeScreen', label: 'Widget de pantalla de inicio' },
  { key: 'library.incrementalScan', label: 'Escaneo incremental' },
  { key: 'library.albumFolderGrouping', label: 'Agrupación por álbum/carpeta' },
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
  const capabilities = useCapabilities();

  const themeMode = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const pushNotice = useNoticeStore((state) => state.push);

  const handleThemeChange = useCallback(
    async (value: ThemeMode) => {
      await setTheme(value);
      const result = await setAppIconForTheme(value);

      if (result === 'unsupported' || result === 'error') {
        pushNotice({
          code: 'theme.app-icon-unavailable',
          severity: 'warning',
          title: 'Icono del launcher no disponible',
          message: canChangeAppIcon()
            ? 'El tema se aplicó, pero el sistema no permitió cambiar el icono.'
            : 'El tema se aplicó. Cambiar el icono requiere una build de desarrollo/EAS; Expo Go no incluye ese módulo nativo.',
        });
      }
    },
    [pushNotice, setTheme]
  );

  const songs = useLibraryStore((state) => state.songs);
  const playlists = useLibraryStore((state) => state.playlists);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isScanning = useLibraryStore((state) => state.isScanning);
  const scanProgress = useLibraryStore((state) => state.scanProgress);
  const lastScanReport = useLibraryStore((state) => state.lastScanReport);

  const requestAccess = useLibraryStore((state) => state.requestAccess);
  const refresh = useLibraryStore((state) => state.refresh);
  const backfillArtwork = useLibraryStore((state) => state.backfillArtwork);
  const isBackfilling = useLibraryStore((state) => state.isBackfilling);
  const clearHistory = useLibraryStore((state) => state.clearHistory);
  const clearAdministrativeData = useLibraryStore(
    (state) => state.clearAdministrativeData
  );
  const hiddenCount = useLibraryStore((state) => state.hiddenCount);
  const restoreHiddenSongs = useLibraryStore((state) => state.restoreHiddenSongs);

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

  // Barrido manual de carátulas ausentes (`FASE 5.1`): revisa las pistas sin
  // portada (FLAC incluidos) y las carpetas con `cover.jpg`.
  const confirmBackfillArtwork = () => {
    Alert.alert(
      'Buscar carátulas faltantes',
      'Se volverán a leer las canciones que no muestran portada, incluidos los FLAC y las carpetas con cover.jpg. Puede tardar unos minutos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Buscar',
          onPress: () => {
            void backfillArtwork().then((report) => {
              const message =
                report.resolved > 0
                  ? `Se encontraron carátulas para ${report.resolved} ${
                      report.resolved === 1 ? 'canción' : 'canciones'
                    }.`
                  : report.candidates === 0
                    ? 'Todas las canciones ya tienen carátula o ya se revisaron.'
                    : 'No se encontraron carátulas nuevas en los archivos revisados.';
              Alert.alert('Búsqueda terminada', message);
            });
          },
        },
      ]
    );
  };

  // Restaura las pistas que el usuario quitó de la biblioteca sin borrar el
  // archivo (`FASE 5.2`): olvida el filtro y vuelve a escanear.
  const confirmRestoreHidden = () => {
    Alert.alert(
      'Restaurar pistas quitadas',
      `Se volverán a añadir ${hiddenCount} ${
        hiddenCount === 1 ? 'pista' : 'pistas'
      } que quitaste de la biblioteca y siguen en el dispositivo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          onPress: () => {
            setWorking(true);
            void restoreHiddenSongs().finally(() => setWorking(false));
          },
        },
      ]
    );
  };

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
            Elige claro, oscuro o una familia de superhéroe. Cada héroe cambia
            los colores y, en builds nativos, el icono de la app.
          </ThemedText>

          <ThemePicker
            value={themeMode}
            onChange={(value) => void handleThemeChange(value)}
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

          <ActionRow
            icon="image-outline"
            title="Buscar carátulas faltantes"
            description="Relee la portada de las canciones que no la muestran (FLAC incluidos)."
            onPress={confirmBackfillArtwork}
          />

          {hiddenCount > 0 ? (
            <ActionRow
              icon="arrow-undo-outline"
              title={`Restaurar pistas quitadas (${hiddenCount})`}
              description="Vuelve a añadir las canciones que quitaste de la biblioteca sin borrar el archivo."
              onPress={confirmRestoreHidden}
            />
          ) : null}

          {isBackfilling ? (
            <View style={styles.scanning}>
              <ActivityIndicator color={theme.accent} />

              <ThemedText type="small" themeColor="textSecondary">
                {scanProgress ? describeScanProgress(scanProgress) : 'Buscando carátulas…'}
              </ThemedText>
            </View>
          ) : null}

          {isScanning ? (
            <View style={styles.scanning}>
              <ActivityIndicator color={theme.accent} />

              <ThemedText type="small" themeColor="textSecondary">
                {scanProgress ? describeScanProgress(scanProgress) : 'Escaneando biblioteca…'}
              </ThemedText>
            </View>
          ) : lastScanReport ? (
            <View style={styles.scanSummary}>
              <ThemedText type="small" themeColor="textSecondary">
                Último escaneo: {describeScanReport(lastScanReport)}
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

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement, marginTop: Spacing.sm },
          ]}
        >
          <ThemedText type="smallBold">Capacidades del dispositivo</ThemedText>

          {CAPABILITY_LABELS.map(({ key, label }) => (
            <View key={key} style={styles.capabilityRow}>
              <Ionicons
                name={capabilities[key] ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={capabilities[key] ? theme.accent : theme.danger}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {label}
              </ThemedText>
            </View>
          ))}

          <ThemedText type="small" themeColor="textSecondary">
            Se actualizan cuando cambian los permisos.
          </ThemedText>
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
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  card: {
    borderRadius: Radius.medium,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },

  section: {
    gap: Spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.medium,
  },

  rowInfo: {
    flex: 1,
    gap: Spacing.xs,
  },

  pressed: {
    opacity: 0.7,
  },

  scanning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },

  scanSummary: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },

  updateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
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
    gap: Spacing.xs,
  },
});
