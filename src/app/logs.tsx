import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { CategoryBar, type CategoryOption } from '@/components/category-bar';
import { EmptyState } from '@/components/empty-state';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { errorLogRepository } from '@/data/repositories/error-log.repository';
import { OnDanger, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ErrorLogEntry, ErrorLogLevel } from '@/types/error-log';
import { useTranslation } from '@/hooks/use-translation';

type LevelFilter = 'all' | ErrorLogLevel;

const FILTERS: readonly CategoryOption<LevelFilter>[] = [
  { key: 'all', label: 'Todos' },
  { key: 'error', label: 'Errores' },
  { key: 'warning', label: 'Advertencias' },
];

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

function LogRow({ entry }: { entry: ErrorLogEntry }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isError = entry.level === 'error';
  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isError ? theme.danger : theme.backgroundSelected },
        ]}>
        <Ionicons
          name={isError ? 'alert-circle' : 'warning'}
          size={16}
          color={isError ? OnDanger : theme.textSecondary}
        />
      </View>
      <View style={styles.rowInfo}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {entry.scope} · {entry.action}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {entry.message}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.meta}>
          {formatTimestamp(entry.lastSeenAt)}
          {entry.occurrences > 1
            ? ` · ${t('logOccurrences', { count: entry.occurrences })}`
            : ''}
          {entry.occurrences > 1
            ? ` ${t('logFirstSeen', { time: formatTimestamp(entry.firstSeenAt) })}`
            : ''}
        </ThemedText>
      </View>
    </View>
  );
}

/** Visor del registro de errores y advertencias persistido en SQLite. */
export default function LogsScreen() {
  const theme = useTheme();

  const { tr, t } = useTranslation();
  const [entries, setEntries] = useState<ErrorLogEntry[] | null>(null);
  const [filter, setFilter] = useState<LevelFilter>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    errorLogRepository
      .list(filter === 'all' ? undefined : filter)
      .then((rows) => {
        if (!cancelled) {
          setEntries(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filter, refreshKey]);

  const reload = useCallback(() => {
    setEntries(null);
    setRefreshKey((key) => key + 1);
  }, []);

  const confirmClear = () => {
    Alert.alert(tr('Borrar registro'), tr('Se eliminarán todos los errores y advertencias guardados.'), [
      { text: tr('Cancelar'), style: 'cancel' },
      {
        text: tr('Borrar'),
        style: 'destructive',
        onPress: () => {
          void errorLogRepository.clear().then(reload);
        },
      },
    ]);
  };

  const total = entries?.length ?? 0;

  return (
    <ScreenShell
      title={tr('Registro de errores')}
      subtitle={
        entries === null ? tr('Cargando…') : t('logEventsCount', { count: total })
      }
      leading={<BackButton onPress={() => router.back()} />}
      action={
        total > 0 ? (
          <Pressable
            onPress={confirmClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={tr('Borrar registro')}>
            <Ionicons name="trash-outline" size={22} color={theme.danger} />
          </Pressable>
        ) : null
      }
      header={
        <View style={styles.filters}>
          <CategoryBar options={FILTERS} value={filter} onChange={setFilter} />
        </View>
      }>
      {entries === null ? (
        <ActivityIndicator color={theme.accent} style={styles.loader} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="checkmark-circle-outline"
          title={tr('Sin sucesos')}
          message={tr('No se han registrado errores ni advertencias con este filtro.')}
        />
      ) : (
        entries.map((entry) => <LogRow key={entry.id} entry={entry} />)
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  filters: {
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.medium,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  rowInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  meta: {
    fontSize: 12,
  },
  loader: {
    marginTop: Spacing.xxl,
  },
});
