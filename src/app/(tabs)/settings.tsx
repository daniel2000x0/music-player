import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { LanguagePicker } from '@/components/language-picker';
import { ScreenShell } from '@/components/screen-shell';
import { SectionHeader } from '@/components/section-header';
import { ThemePicker } from '@/components/theme-picker';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { describeScanProgress } from '@/domain/library/scan-progress';
import { describeScanReport } from '@/domain/library/scan-report';
import { useCapabilities } from '@/hooks/use-capabilities';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import type { LiteralKey } from '@/i18n';
import { themeAppIcon } from '@/constants/theme-catalog';
import { canChangeAppIcon, setAppIconForTheme } from '@/services/app-icon.service';
import type { Capability } from '@/services/capabilities';
import {
  checkLatestGithubRelease,
  downloadReleaseApk,
  getCurrentAppVersion,
  type GithubReleaseInfo,
  canInstallApkInCurrentRuntime,
} from '@/services/github-release.service';
import { useLibraryStore } from '@/stores/library.store';
import { useNoticeStore } from '@/stores/notice.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { ThemeMode } from '@/types/settings';

// NOTA (i18n): guardamos la clave tipada del diccionario y la traducimos al
// pintar cada fila, para que el cambio de idioma se refleje sin recargar.
const CAPABILITY_LABELS: readonly { key: Capability; label: LiteralKey }[] = [
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
type ReleaseState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'error'; message: string }
  | { kind: 'up-to-date'; currentVersion: string; latest: GithubReleaseInfo }
  | { kind: 'available'; currentVersion: string; latest: GithubReleaseInfo; downloadedUri?: string; downloading?: boolean; progress?: string };

function UpdateSection() {
  const theme = useTheme();
  const { tr } = useTranslation();
  const [state, setState] = useState<ReleaseState>({ kind: 'idle' });

  const check = useCallback(async () => {
    setState({ kind: 'checking' });
    try {
      const result = await checkLatestGithubRelease();
      if (result.status === 'up-to-date') {
        setState({ kind: 'up-to-date', currentVersion: result.currentVersion, latest: result.latest });
        return;
      }
      if (result.status === 'available') {
        setState({ kind: 'available', currentVersion: result.currentVersion, latest: result.latest });
        return;
      }
      setState({ kind: 'error', message: tr('No se pudo consultar GitHub Releases.') });
    } catch {
      setState({ kind: 'error', message: tr('No se pudo consultar GitHub Releases.') });
    }
  }, [tr]);

  const downloadApk = useCallback(async () => {
    if (state.kind !== 'available') return;
    if (Platform.OS !== 'android') {
      Alert.alert(tr('Actualizaci?n APK'), tr('La descarga del APK no est? disponible en Expo Go. Usa una build instalada para instalar actualizaciones.'));
      return;
    }
    setState({ ...state, downloading: true, progress: tr('Descargando actualizaci?n?') });
    try {
      const file = await downloadReleaseApk(state.latest, (p) => {
        const pct = p.fraction != null ? Math.round(p.fraction * 100) : null;
        setState((prev) => prev.kind === 'available' ? { ...prev, downloading: true, progress: pct != null ? pct + '%' : tr('Descargando actualizaci?n?') } : prev);
      });
      setState((prev) => prev.kind === 'available' ? { ...prev, downloading: false, downloadedUri: file.uri, progress: tr('APK descargado. Confirma la instalaci?n en Android.') } : prev);
      if (!canInstallApkInCurrentRuntime()) {
        Alert.alert(
          tr('Actualizaci?n APK'),
          tr('La descarga del APK no est? disponible en Expo Go. Usa una build instalada para instalar actualizaciones.'),
          [
            { text: tr('Cancelar'), style: 'cancel' },
            { text: tr('Abrir p?gina de descarga'), onPress: () => void Linking.openURL(state.latest.htmlUrl) },
          ]
        );
      } else {
        Alert.alert(
          tr('Actualizaci?n APK'),
          tr('La instalaci?n autom?tica no est? disponible en este entorno. Se abri? la descarga para que puedas instalarla manualmente.'),
          [
            { text: tr('Despu?s'), style: 'cancel' },
            { text: tr('Abrir p?gina de descarga'), onPress: () => void Linking.openURL(state.latest.htmlUrl) },
          ]
        );
      }
    } catch {
      setState((prev) => prev.kind === 'available' ? { ...prev, downloading: false, progress: tr('Error al descargar la actualizaci?n.') } : prev);
      Alert.alert(tr('Actualizaci?n APK'), tr('Error al descargar la actualizaci?n.'));
    }
  }, [state, tr]);

  const latest = state.kind === 'available' || state.kind === 'up-to-date' ? state.latest : null;
  const currentVersion = state.kind === 'available' || state.kind === 'up-to-date' ? state.currentVersion : getCurrentAppVersion();

  return (
    <View style={[styles.updateCard, { backgroundColor: theme.backgroundElement }]}> 
      <View style={styles.updateHeaderRow}>
        <View style={styles.updateIcon}>
          {state.kind === 'checking' ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Ionicons name="cloud-download-outline" size={25} color={theme.accent} />
          )}
        </View>
        <View style={styles.updateInfo}>
          <ThemedText type="smallBold">{tr('Buscar actualizaci?n APK')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {state.kind === 'checking'
              ? tr('Buscando actualizaciones...')
              : state.kind === 'error'
                ? state.message
                : state.kind === 'available'
                  ? tr('?ltima versi?n') + ': ' + state.latest.version
                  : state.kind === 'up-to-date'
                    ? tr('Ya tienes la ?ltima versi?n instalada.')
                    : tr('Consulta si hay novedades disponibles')}
          </ThemedText>
        </View>
      </View>

      <View style={styles.updateMeta}>
        <ThemedText type="small" themeColor="textSecondary">{tr('Versi?n instalada')}: {currentVersion}</ThemedText>
        {latest ? <ThemedText type="small" themeColor="textSecondary">{tr('?ltima versi?n')}: {latest.version}</ThemedText> : null}
        {latest?.apkAsset ? <ThemedText type="small" themeColor="textSecondary">{tr('Tama?o')}: {(latest.apkAsset.size / (1024 * 1024)).toFixed(1)} MB</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">{tr('Fuente')}: GitHub Releases</ThemedText>
      </View>

      {latest?.body ? (
        <View style={styles.releaseNotes}>
          <ThemedText type="smallBold">{tr('Notas de la versi?n')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={6}>{latest.body}</ThemedText>
        </View>
      ) : null}

      {state.kind === 'available' && !state.latest.apkAsset ? (
        <ThemedText type="small" style={{ color: theme.danger }}>{tr('No se encontr? un APK en la ?ltima release.')}</ThemedText>
      ) : null}

      {state.kind === 'available' && state.downloading ? (
        <ThemedText type="small" themeColor="textSecondary">{state.progress ?? tr('Descargando actualizaci?n?')}</ThemedText>
      ) : null}

      <View style={styles.updateActions}>
        <Pressable
          onPress={() => void check()}
          disabled={state.kind === 'checking' || (state.kind === 'available' && !!state.downloading)}
          accessibilityRole="button"
          accessibilityLabel={tr('Buscar actualizaciones')}
          style={[styles.updateActionBtn, { borderColor: theme.border }]}> 
          <ThemedText type="smallBold">{tr('Buscar actualizaciones')}</ThemedText>
        </Pressable>

        {state.kind === 'available' && state.latest.apkAsset ? (
          <Pressable
            onPress={() => void downloadApk()}
            disabled={!!state.downloading}
            accessibilityRole="button"
            accessibilityLabel={tr('Descargar APK')}
            style={[styles.updateActionBtn, { backgroundColor: theme.accent, borderColor: theme.accent }]}> 
            <ThemedText type="smallBold" style={{ color: theme.accentText }}>{tr('Descargar APK')}</ThemedText>
          </Pressable>
        ) : null}

        {latest ? (
          <Pressable
            onPress={() => void Linking.openURL(latest.htmlUrl)}
            accessibilityRole="button"
            accessibilityLabel={tr('Abrir p?gina de descarga')}
            style={[styles.updateActionBtn, { borderColor: theme.border }]}> 
            <ThemedText type="smallBold">{tr('Abrir p?gina de descarga')}</ThemedText>
          </Pressable>
        ) : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {tr('La descarga del APK no est? disponible en Expo Go. Usa una build instalada para instalar actualizaciones.')}
      </ThemedText>
    </View>
  );
}
/** Pantalla de configuración: apariencia y administración. */
export default function SettingsScreen() {
  const theme = useTheme();
  const { tr, t, language } = useTranslation();
  const capabilities = useCapabilities();

  const themeMode = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const pushNotice = useNoticeStore((state) => state.push);

  const handleThemeChange = useCallback(
    async (value: ThemeMode) => {
      const nextAppIcon = themeAppIcon(value);
      const currentAppIcon = themeAppIcon(themeMode);
      const willChangeLauncherIcon = nextAppIcon !== currentAppIcon;

      const applyThemeChange = async () => {
        await setTheme(value);
        const result = await setAppIconForTheme(value);

        if (result === 'unsupported' || result === 'error') {
          pushNotice({
            code: 'theme.app-icon-unavailable',
            severity: 'warning',
            title: tr('Icono del launcher no disponible'),
            message: canChangeAppIcon()
              ? tr('El tema se aplicó, pero el sistema no permitió cambiar el icono.')
              : tr('El tema se aplicó. Cambiar el icono requiere una build de desarrollo/EAS; Expo Go no incluye ese módulo nativo.'),
          });
        }
      };

      // En Android, cambiar el icono alternativo puede hacer que el sistema
      // cierre la tarea/app. No es posible reabrirla automáticamente desde JS
      // si el proceso muere, así que avisamos antes para evitar la sorpresa.
      if (willChangeLauncherIcon && canChangeAppIcon()) {
        Alert.alert(
          tr('El icono puede cerrar la app'),
          tr('Al cambiar el icono del launcher, Android puede cerrar la aplicación. Si ocurre, ábrela de nuevo desde el icono nuevo. ¿Quieres continuar?'),
          [
            { text: tr('Cancelar'), style: 'cancel' },
            {
              text: tr('Cambiar tema'),
              onPress: () => {
                void applyThemeChange();
              },
            },
          ]
        );
        return;
      }

      await applyThemeChange();
    },
    [pushNotice, setTheme, themeMode, tr]
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

  // Barrido manual de carátulas ausentes (`FASE 5.1`): revisa las pistas sin
  // portada (FLAC incluidos) y las carpetas con `cover.jpg`.
  const confirmBackfillArtwork = () => {
    Alert.alert(
      tr('Buscar carátulas faltantes'),
      tr('Se volverán a leer las canciones que no muestran portada, incluidos los FLAC y las carpetas con cover.jpg. Puede tardar unos minutos.'),
      [
        { text: tr('Cancelar'), style: 'cancel' },
        {
          text: tr('Buscar'),
          onPress: () => {
            void backfillArtwork().then((report) => {
              const message =
                report.resolved > 0
                  ? t('artworkFound', { count: report.resolved })
                  : report.candidates === 0
                    ? tr('Todas las canciones ya tienen carátula o ya se revisaron.')
                    : tr('No se encontraron carátulas nuevas en los archivos revisados.');
              Alert.alert(tr('Búsqueda terminada'), message);
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
      tr('Restaurar pistas quitadas'),
      t('restoreHidden', { count: hiddenCount }),
      [
        { text: tr('Cancelar'), style: 'cancel' },
        {
          text: tr('Restaurar'),
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
      tr('Borrar historial'),
      tr('Se eliminarán las reproducciones recientes y los contadores de escucha. Tus canciones y playlists se conservan.'),
      [
        { text: tr('Cancelar'), style: 'cancel' },
        {
          text: tr('Borrar'),
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
      tr('Borrar datos administrativos'),
      tr('Se eliminarán favoritos, playlists, historial y estadísticas. Los archivos de audio del dispositivo no se borran.'),
      [
        { text: tr('Cancelar'), style: 'cancel' },
        {
          text: tr('Borrar todo'),
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
      title={tr('Configuración')}
      subtitle={tr('Apariencia y administración de la biblioteca')}
    >
      {/* APARIENCIA */}
      <View>
        <SectionHeader title={tr('Apariencia')} />

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <ThemedText type="smallBold">
            {tr('Tema de la aplicación')}
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            {tr('Elige claro, oscuro o una familia de superhéroe. Cada héroe cambia los colores y, en builds nativos, el icono de la app.')}
          </ThemedText>

          <ThemePicker
            value={themeMode}
            onChange={(value) => void handleThemeChange(value)}
          />
        </View>
      </View>

      {/* IDIOMA: afecta a menús, filtros, ajustes y al resto de la app. */}
      <View>
        <SectionHeader title={tr('Idioma')} />
        <View style={styles.section}>
          <LanguagePicker />
        </View>
      </View>

      {/* BIBLIOTECA */}
      <View>
        <SectionHeader title={tr('Biblioteca')} />

        <View style={styles.section}>
          <ActionRow
            icon="musical-notes-outline"
            title={t('songsCount', { count: songs.filter((song) => !song.isAudiobook).length })}
            description={`${playlists.length} ${tr('playlists')} · ${
              hasPermission
                ? tr('permiso concedido')
                : tr('sin permiso de audio')
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
                ? tr('Volver a escanear')
                : tr('Conceder permiso de audio')
            }
            description={
              hasPermission
                ? tr('Busca canciones nuevas o eliminadas en el dispositivo.')
                : tr('Necesario para leer la música almacenada.')
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
            title={tr('Buscar carátulas faltantes')}
            description={tr('Relee la portada de las canciones que no la muestran (FLAC incluidos).')}
            onPress={confirmBackfillArtwork}
          />

          {hiddenCount > 0 ? (
            <ActionRow
              icon="arrow-undo-outline"
              title={t('restoreHiddenTitle', { count: hiddenCount })}
              description={tr('Vuelve a añadir las canciones que quitaste de la biblioteca sin borrar el archivo.')}
              onPress={confirmRestoreHidden}
            />
          ) : null}

          {isBackfilling ? (
            <View style={styles.scanning}>
              <ActivityIndicator color={theme.accent} />

              <ThemedText type="small" themeColor="textSecondary">
                {scanProgress ? describeScanProgress(scanProgress, language) : tr('Buscando carátulas…')}
              </ThemedText>
            </View>
          ) : null}

          {isScanning ? (
            <View style={styles.scanning}>
              <ActivityIndicator color={theme.accent} />

              <ThemedText type="small" themeColor="textSecondary">
                {scanProgress ? describeScanProgress(scanProgress, language) : tr('Escaneando biblioteca…')}
              </ThemedText>
            </View>
          ) : lastScanReport ? (
            <View style={styles.scanSummary}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('lastScan', { report: describeScanReport(lastScanReport, language) })}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      {/* DATOS */}
      <View>
        <SectionHeader title={tr('Datos')} />

        <View style={styles.section}>
          <ActionRow
            icon="time-outline"
            title={tr('Borrar historial de reproducción')}
            description={tr('Reinicia contadores e historial, conserva playlists.')}
            onPress={confirmClearHistory}
          />

          <ActionRow
            icon="trash-outline"
            title={tr('Borrar datos administrativos')}
            description={tr('Favoritos, playlists, historial y estadísticas.')}
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
        <SectionHeader title={tr('Diagnóstico')} />

        <View style={styles.section}>
          <ActionRow
            icon="bug-outline"
            title={tr('Registro de errores')}
            description={tr('Errores y advertencias guardados en el dispositivo.')}
            onPress={() => router.push('/logs')}
          />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement, marginTop: Spacing.sm },
          ]}
        >
          <ThemedText type="smallBold">{tr('Capacidades del dispositivo')}</ThemedText>

          {CAPABILITY_LABELS.map(({ key, label }) => (
            <View key={key} style={styles.capabilityRow}>
              <Ionicons
                name={capabilities[key] ? 'checkmark-circle' : 'close-circle'}
                size={16}
                color={capabilities[key] ? theme.accent : theme.danger}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {tr(label)}
              </ThemedText>
            </View>
          ))}

          <ThemedText type="small" themeColor="textSecondary">
            {tr('Se actualizan cuando cambian los permisos.')}
          </ThemedText>
        </View>
      </View>

      {/* ACERCA DE */}
      <View>
        <SectionHeader title={tr('Acerca de')} />

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement },
          ]}
        >
          <ThemedText type="smallBold">
            {tr('Mi Música')}
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            {tr('Versión')} {Constants.expoConfig?.version ?? '1.0.0'} ·
            {tr('Biblioteca local con SQLite')}
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            {tr('La reproducción en segundo plano y los controles de pantalla bloqueada requieren un development build (no funcionan en Expo Go).')}
          </ThemedText>
        </View>
      </View>

      {/* ACTUALIZACIONES */}
      <View>
        <SectionHeader title={tr('Actualizaciones')} />

        <View style={styles.section}>
          <UpdateSection />
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
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.medium,
  },
  updateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  updateMeta: { gap: 2 },
  releaseNotes: { gap: 4, paddingTop: Spacing.xs },
  updateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  updateActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.medium,
    borderWidth: 1,
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
