import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { EmptyState } from '@/components/empty-state';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayerStore } from '@/stores/player.store';

/** Cola de reproducción: reordena, elimina y salta a cualquier pista. */
export default function QueueScreen() {
  const theme = useTheme();
  const queue = usePlayerStore((state) => state.queue);
  const currentId = usePlayerStore((state) => state.currentSong?.id);
  const playQueueIndex = usePlayerStore((state) => state.playQueueIndex);
  const removeFromQueue = usePlayerStore((state) => state.removeFromQueue);
  const moveInQueue = usePlayerStore((state) => state.moveInQueue);
  const clearQueue = usePlayerStore((state) => state.clearQueue);

  const confirmClear = () => {
    Alert.alert('Vaciar cola', 'Se quitarán las canciones pendientes. La actual seguirá sonando.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Vaciar', style: 'destructive', onPress: clearQueue },
    ]);
  };

  return (
    <ScreenShell
      title="Cola de reproducción"
      subtitle={`${queue.length} canciones`}
      leading={
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={26} color={theme.text} />
        </Pressable>
      }
      action={
        queue.length > 1 ? (
          <Pressable onPress={confirmClear} hitSlop={8} accessibilityLabel="Vaciar cola">
            <Ionicons name="trash-outline" size={22} color={theme.danger} />
          </Pressable>
        ) : null
      }>
      {queue.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title="Cola vacía"
          message="Reproduce una canción para llenar la cola."
        />
      ) : (
        queue.map((song, index) => {
          const isCurrent = song.id === currentId;
          return (
            <View
              key={`${song.id}-${index}`}
              style={[
                styles.row,
                {
                  backgroundColor: isCurrent ? theme.backgroundSelected : theme.backgroundElement,
                },
              ]}>
              <Pressable
                onPress={() => playQueueIndex(index)}
                style={styles.main}
                accessibilityLabel={`Reproducir ${song.title}`}>
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
                disabled={index === 0}
                onPress={() => moveInQueue(index, index - 1)}
                style={[styles.control, index === 0 && styles.disabled]}
                accessibilityLabel="Subir">
                <Ionicons name="chevron-up" size={20} color={theme.textSecondary} />
              </Pressable>
              <Pressable
                hitSlop={6}
                disabled={index === queue.length - 1}
                onPress={() => moveInQueue(index, index + 1)}
                style={[styles.control, index === queue.length - 1 && styles.disabled]}
                accessibilityLabel="Bajar">
                <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
              </Pressable>
              <Pressable
                hitSlop={6}
                onPress={() => removeFromQueue(index)}
                style={styles.control}
                accessibilityLabel="Quitar de la cola">
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Radius.medium,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  control: {
    padding: Spacing.one,
  },
  disabled: {
    opacity: 0.3,
  },
});
