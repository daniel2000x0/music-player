import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { BackButton } from '@/components/back-button';
import { EdgeScrollIndicator } from '@/components/edge-scroll-indicator';
import { EmptyState } from '@/components/empty-state';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import {
  BottomTabInset,
  MiniPlayerInset,
  Radius,
  ScrollbarEdgeMargin,
  ScrollbarGutter,
  Spacing,
} from '@/constants/theme';
import { useScrollIndicator } from '@/hooks/use-scroll-indicator';
import { useTheme } from '@/hooks/use-theme';
import { usePlayerStore } from '@/stores/player.store';
import type { Song } from '@/types/song';
import { useTranslation } from '@/hooks/use-translation';

/** Canción con su índice en la cola embebido (viaja con el item para `memo`). */
type QueueItem = Song & { queueIndex: number };

/** Altura fija de una fila de cola (artwork 44 + padding 8×2). */
const ROW_HEIGHT = 60;

const QueueRow = memo(function QueueRow({
  song,
  isCurrent,
  canMoveUp,
  canMoveDown,
  onPlay,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  song: QueueItem;
  isCurrent: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPlay: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const theme = useTheme();
  const { tr, t } = useTranslation();
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: isCurrent ? theme.backgroundSelected : theme.backgroundElement,
        },
      ]}>
      <Pressable
        onPress={() => onPlay(song.queueIndex)}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={t('playSong', {
          title: song.title,
          artist: song.artist,
        })}>
        <Artwork uri={song.artwork} size={44} />
        <View style={styles.info}>
          <ThemedText
            type="smallBold"
            numberOfLines={1}
            themeColor={isCurrent ? 'accent' : 'text'}>
            {song.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {song.artist}
          </ThemedText>
        </View>
      </Pressable>

      <Pressable
        hitSlop={6}
        disabled={!canMoveUp}
        onPress={() => onMoveUp(song.queueIndex)}
        style={[styles.control, !canMoveUp && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canMoveUp }}
        accessibilityLabel={tr('Subir')}>
        <Ionicons name="chevron-up" size={20} color={theme.textSecondary} />
      </Pressable>
      <Pressable
        hitSlop={6}
        disabled={!canMoveDown}
        onPress={() => onMoveDown(song.queueIndex)}
        style={[styles.control, !canMoveDown && styles.disabled]}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canMoveDown }}
        accessibilityLabel={tr('Bajar')}>
        <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
      </Pressable>
      <Pressable
        hitSlop={6}
        onPress={() => onRemove(song.queueIndex)}
        style={styles.control}
        accessibilityRole="button"
        accessibilityLabel={t('removeFromQueue', { title: song.title })}>
        <Ionicons name="close" size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );
});

/** Cola de reproducción: reordena, elimina y salta a cualquier pista. */
export default function QueueScreen() {
  const theme = useTheme();

  const { tr, t } = useTranslation();
  const queue = usePlayerStore((state) => state.queue);
  const currentId = usePlayerStore((state) => state.currentSong?.id);
  const playQueueIndex = usePlayerStore((state) => state.playQueueIndex);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const moveInQueue = usePlayerStore((state) => state.moveInQueue);
  const clearQueue = usePlayerStore((state) => state.clearQueue);
  const scrollIndicator = useScrollIndicator();

  const confirmClear = () => {
    Alert.alert(tr('Vaciar cola'), tr('Se quitarán las canciones pendientes. La actual seguirá sonando.'), [
      { text: tr('Cancelar'), style: 'cancel' },
      { text: tr('Vaciar'), style: 'destructive', onPress: clearQueue },
    ]);
  };

  // Las filas reciben su índice dentro de la cola embebido en el item para
  // que `memo` no lo invalide al reordenar: el índice viaja con la canción.
  const items = queue.map((song, index) => ({ ...song, queueIndex: index }));
  const keyExtractor = useCallback((item: QueueItem) => `${item.id}-${item.queueIndex}`, []);
  const handlePlay = useCallback((index: number) => playQueueIndex(index), [playQueueIndex]);
  const handleMoveUp = useCallback((index: number) => moveInQueue(index, index - 1), [moveInQueue]);
  const handleMoveDown = useCallback(
    (index: number) => moveInQueue(index, index + 1),
    [moveInQueue]
  );
  const handleRemove = useCallback((index: number) => removeFromQueue(index), [removeFromQueue]);
  const lastIndex = queue.length - 1;

  return (
    <ScreenShell
      title={tr('Cola de reproducción')}
      subtitle={t('songsCount', { count: queue.length })}
      scroll={false}
      leading={<BackButton onPress={() => router.back()} />}
      action={
        queue.length > 1 ? (
          <Pressable
            onPress={confirmClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={tr('Vaciar cola')}>
            <Ionicons name="trash-outline" size={22} color={theme.danger} />
          </Pressable>
        ) : null
      }>
      {queue.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title={tr('Cola vacía')}
          message={tr('Reproduce una canción para llenar la cola.')}
        />
      ) : (
        <View style={styles.listFrame}>
          <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={({ item }) => (
              <QueueRow
                song={item}
                isCurrent={item.id === currentId}
                canMoveUp={item.queueIndex > 0}
                canMoveDown={item.queueIndex < lastIndex}
                onPlay={handlePlay}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onRemove={handleRemove}
              />
            )}
            getItemLayout={(_, index) => ({
              length: ROW_HEIGHT,
              offset: ROW_HEIGHT * index,
              index,
            })}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            {...scrollIndicator.scrollProps}
            style={styles.flex}
            contentContainerStyle={styles.listContent}
          />
          <EdgeScrollIndicator {...scrollIndicator.indicatorProps} />
        </View>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: Radius.medium,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
  },
  control: {
    padding: Spacing.xs,
  },
  disabled: {
    opacity: 0.3,
  },
  listFrame: {
    flex: 1,
    position: 'relative',
    // El marco llega al borde real para que el indicador propio quede pegado a él.
    marginHorizontal: ScrollbarEdgeMargin,
  },

  flex: {
    flex: 1,
  },
  listContent: {
    paddingBottom: BottomTabInset + MiniPlayerInset,
    // Reinserta las filas respecto al área segura...
    paddingLeft: Spacing.xl,
    // ...y deja el carril del indicador nativo de scroll.
    paddingRight: ScrollbarGutter,
  },
});
