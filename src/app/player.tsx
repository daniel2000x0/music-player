import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Artwork } from '@/components/artwork';
import { EmptyState } from '@/components/empty-state';
import { PlaylistPicker } from '@/components/playlist-picker';
import { SeekBar } from '@/components/seek-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlaybackDuration, usePlaybackPosition } from '@/stores/playback-progress';
import { usePlayerStore } from '@/stores/player.store';
import { formatDuration } from '@/utils/format';

/**
 * Bloque de progreso (barra + tiempos). Suscribe posición y duración al
 * almacén aislado: solo este componente se re-renderiza con cada tick de
 * reproducción (2 por segundo), no la pantalla completa.
 */
function PlayerProgress({ onSeek }: { onSeek: (seconds: number) => void }) {
  const position = usePlaybackPosition();
  const duration = usePlaybackDuration();

  return (
    <View style={styles.progressBlock}>
      <SeekBar position={position} duration={duration} onSeek={onSeek} />
      <View style={styles.timeRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDuration(position)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDuration(duration)}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * Reproductor a pantalla completa. El estado vive en el store global, así que
 * la reproducción continúa al cerrar esta pantalla.
 */
export default function PlayerScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isBuffering = usePlayerStore((state) => state.isBuffering);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const toggle = usePlayerStore((state) => state.toggle);
  const next = usePlayerStore((state) => state.next);
  const previous = usePlayerStore((state) => state.previous);
  const seek = usePlayerStore((state) => state.seek);
  const cycleRepeat = usePlayerStore((state) => state.cycleRepeat);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const favoriteIds = useLibraryStore((state) => state.favoriteIds);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);

  const [pickerVisible, setPickerVisible] = useState(false);

  const artworkSize = Math.min(width - Spacing.four * 2, MaxContentWidth - Spacing.four * 2, 360);

  if (!currentSong) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Pressable hitSlop={8} onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="chevron-down" size={28} color={theme.text} />
          </Pressable>
          <EmptyState
            icon="musical-notes-outline"
            title="Nada en reproducción"
            message="Elige una canción de la biblioteca para empezar."
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  const favorite = favoriteIds.includes(currentSong.id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable hitSlop={8} onPress={() => router.back()} accessibilityLabel="Cerrar">
            <Ionicons name="chevron-down" size={28} color={theme.text} />
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary">
            Reproduciendo
          </ThemedText>
          <Pressable
            hitSlop={8}
            onPress={() => router.push('/queue')}
            accessibilityLabel="Cola de reproducción">
            <Ionicons name="list" size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Artwork uri={currentSong.artwork} size={artworkSize} radius={Radius.large} />

          <View style={styles.meta}>
            <ThemedText type="subtitle" numberOfLines={2} style={styles.songTitle}>
              {currentSong.title}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" numberOfLines={1}>
              {currentSong.artist} · {currentSong.album}
            </ThemedText>
          </View>

          <PlayerProgress onSeek={seek} />

          <View style={styles.controls}>
            <Pressable hitSlop={8} onPress={toggleShuffle} accessibilityLabel="Aleatorio">
              <Ionicons
                name="shuffle"
                size={24}
                color={shuffle ? theme.accent : theme.textSecondary}
              />
            </Pressable>

            <Pressable hitSlop={8} onPress={previous} accessibilityLabel="Anterior">
              <Ionicons name="play-skip-back" size={34} color={theme.text} />
            </Pressable>

            <Pressable
              onPress={toggle}
              style={[styles.playButton, { backgroundColor: theme.accent }]}
              accessibilityLabel="Reproducir o pausar">
              {isBuffering ? (
                <ActivityIndicator color={theme.accentText} />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={34}
                  color={theme.accentText}
                  style={styles.playIcon}
                />
              )}
            </Pressable>

            <Pressable hitSlop={8} onPress={next} accessibilityLabel="Siguiente">
              <Ionicons name="play-skip-forward" size={34} color={theme.text} />
            </Pressable>

            <Pressable
              hitSlop={8}
              onPress={cycleRepeat}
              accessibilityLabel={`Repetir: ${repeatMode}`}>
              <View>
                <Ionicons
                  name={repeatMode === 'none' ? 'repeat-outline' : 'repeat'}
                  size={24}
                  color={repeatMode === 'none' ? theme.textSecondary : theme.accent}
                />
                {repeatMode === 'single' ? (
                  <View style={[styles.repeatBadge, { backgroundColor: theme.accent }]}>
                    <ThemedText style={[styles.repeatBadgeText, { color: theme.accentText }]}>
                      1
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Pressable
              hitSlop={8}
              onPress={() => void toggleFavorite(currentSong.id)}
              style={styles.actionItem}
              accessibilityLabel="Favorito">
              <Ionicons
                name={favorite ? 'heart' : 'heart-outline'}
                size={26}
                color={favorite ? theme.accent : theme.textSecondary}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Favorito
              </ThemedText>
            </Pressable>

            <Pressable
              hitSlop={8}
              onPress={() => setPickerVisible(true)}
              style={styles.actionItem}
              accessibilityLabel="Playlist">
              <Ionicons name="add-circle-outline" size={26} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Playlist
              </ThemedText>
            </Pressable>

            <Pressable
              hitSlop={8}
              onPress={() => router.push('/queue')}
              style={styles.actionItem}
              accessibilityLabel="Cola">
              <Ionicons name="list-outline" size={26} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                Cola
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>

      <PlaylistPicker
        visible={pickerVisible}
        song={currentSong}
        onClose={() => setPickerVisible(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  closeButton: {
    alignItems: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  meta: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  songTitle: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  progressBlock: {
    alignSelf: 'stretch',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.half,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: 2,
  },
  repeatBadge: {
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 12,
    height: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBadgeText: {
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.six,
    marginTop: Spacing.two,
  },
  actionItem: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
