import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Scrim, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import type { Song } from '@/types/song';
import { useTranslation } from '@/hooks/use-translation';

export type PlaylistPickerProps = {
  visible: boolean;
  /** Canción que se va a agregar. */
  song: Song | null;
  onClose: () => void;
};

/**
 * Hoja modal para agregar una canción a una playlist o crear una nueva.
 */
export function PlaylistPicker({ visible, song, onClose }: PlaylistPickerProps) {
  const theme = useTheme();

  const { tr, t } = useTranslation();
  const playlists = useLibraryStore((state) => state.playlists);
  const addToPlaylist = useLibraryStore((state) => state.addToPlaylist);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const [name, setName] = useState('');

  const handleAdd = async (playlistId: number) => {
    if (song) {
      await addToPlaylist(playlistId, song.id);
    }
    onClose();
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const playlist = await createPlaylist(trimmed);
    if (song) {
      await addToPlaylist(playlist.id, song.id);
    }
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}
          onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              {tr('Agregar a playlist')}
            </ThemedText>
            <Pressable hitSlop={8} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('Cerrar')}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {playlists.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {tr('Aún no tienes playlists. Crea una abajo.')}
              </ThemedText>
            ) : (
              playlists.map((playlist) => {
                const contains = song ? playlist.songIds.includes(song.id) : false;
                return (
                  <Pressable
                    key={playlist.id}
                    onPress={() => handleAdd(playlist.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: contains }}
                    accessibilityLabel={t('addToPlaylist', { name: playlist.name })}
                    accessibilityHint={contains ? tr('ya incluida') : undefined}
                    style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
                    <Ionicons name="list" size={20} color={theme.textSecondary} />
                    <ThemedText type="smallBold" numberOfLines={1} style={styles.itemLabel}>
                      {playlist.name}
                    </ThemedText>
                    {contains ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={[styles.createRow, { borderTopColor: theme.border }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={tr('Nueva playlist')}
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={handleCreate}
              returnKeyType="done"
              style={[
                styles.input,
                { backgroundColor: theme.backgroundSelected, color: theme.text },
              ]}
            />
            <Pressable
              onPress={handleCreate}
              accessibilityRole="button"
              accessibilityLabel={tr('Crear playlist y agregar la canción')}
              style={({ pressed }) => [
                styles.createButton,
                { backgroundColor: theme.accent },
                pressed && styles.pressed,
              ]}>
              <Ionicons name="add" size={22} color={theme.accentText} />
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Scrim,
  },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.lg,
  },
  itemLabel: {
    flex: 1,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
