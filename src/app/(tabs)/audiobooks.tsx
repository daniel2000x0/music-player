import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Artwork } from '@/components/artwork';
import { EmptyState } from '@/components/empty-state';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { collectAudiobooks, type Audiobook } from '@/domain/library/audiobooks';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import { formatDuration } from '@/utils/format';

function pluralizeChapters(count: number): string {
  return count === 1 ? '1 capítulo' : `${count} capítulos`;
}

const BOOK_ACTIONS: readonly Option<'remove'>[] = [
  {
    value: 'remove',
    label: 'Remover de audiolibros',
    description: 'Sus capítulos vuelven a aparecer en la pestaña Canciones.',
    destructive: true,
  },
];

/** Altura fija de una fila de audiolibro (artwork 56 + padding 8×2). */
const ROW_HEIGHT = 72;

const BookRow = memo(function BookRow({
  book,
  onPlay,
  onOptions,
}: {
  book: Audiobook;
  onPlay: (book: Audiobook) => void;
  onOptions: (book: Audiobook) => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => book.albumId !== null && router.push(`/album/${book.albumId}`)}
      style={({ pressed }) => [styles.book, pressed && styles.pressed]}
      accessibilityLabel={`Abrir audiolibro ${book.title}`}>
      <Artwork uri={book.chapters[0]?.artwork ?? null} size={56} radius={Radius.small} />

      <View style={styles.bookInfo}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {book.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {book.author}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {pluralizeChapters(book.chapters.length)} · {formatDuration(book.totalDuration)}
        </ThemedText>
      </View>

      <Pressable
        hitSlop={8}
        onPress={() => onOptions(book)}
        style={styles.action}
        accessibilityLabel={`Opciones de ${book.title}`}>
        <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
      </Pressable>

      <Pressable
        hitSlop={8}
        onPress={() => onPlay(book)}
        style={[styles.playButton, { backgroundColor: theme.accent }]}
        accessibilityLabel={`Reproducir ${book.title}`}>
        <Ionicons name="play" size={18} color={theme.accentText} />
      </Pressable>
    </Pressable>
  );
});

/** Pantalla "Audiolibros": contenido marcado como audiolibro, agrupado por carpeta. */
export default function AudiobooksScreen() {
  const theme = useTheme();
  const songs = useLibraryStore((state) => state.songs);
  const albums = useLibraryStore((state) => state.albums);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const requestAccess = useLibraryStore((state) => state.requestAccess);
  const setAudiobook = useLibraryStore((state) => state.setAudiobook);
  const play = usePlayerStore((state) => state.play);

  const [query, setQuery] = useState('');
  const [optionsBook, setOptionsBook] = useState<Audiobook | null>(null);

  const books = useMemo(() => collectAudiobooks(songs, albums), [songs, albums]);
  // El filtrado corre sobre el texto "asentado" (ver `useDebouncedValue`).
  const debouncedQuery = useDebouncedValue(query);

  const visibleBooks = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    if (!term) {
      return books;
    }
    return books.filter(
      (book) =>
        book.title.toLowerCase().includes(term) || book.author.toLowerCase().includes(term)
    );
  }, [books, debouncedQuery]);

  const handlePlay = useCallback(
    (book: Audiobook) => {
      const first = book.chapters[0];
      if (first) {
        play(first, book.chapters);
      }
    },
    [play]
  );
  const keyExtractor = useCallback(
    (book: Audiobook) => `${book.title}-${book.author}`,
    []
  );

  const header = (
    <View style={styles.header}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar audiolibros"
        placeholderTextColor={theme.textSecondary}
        returnKeyType="search"
        style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />
    </View>
  );

  if (!hasPermission) {
    return (
      <ScreenShell title="Audiolibros" scroll={false}>
        <EmptyState
          icon="book-outline"
          title="Sin acceso a tu música"
          message="Concede permiso de audio para detectar audiolibros."
          actionLabel="Conceder permiso"
          onAction={() => void requestAccess()}
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title="Audiolibros"
        subtitle={`${books.length} títulos`}
        scroll={false}
        header={header}>
      {isLoading ? (
        <ActivityIndicator color={theme.accent} style={styles.loader} />
      ) : books.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title="Sin audiolibros"
          message="Marca canciones desde su menú de opciones o deja que el escaneo detecte contenido largo."
        />
      ) : visibleBooks.length === 0 ? (
        <EmptyState title="Sin resultados" message="No hay audiolibros que coincidan." />
      ) : (
        <FlatList
          data={visibleBooks}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => (
            <BookRow book={item} onPlay={handlePlay} onOptions={setOptionsBook} />
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
          showsVerticalScrollIndicator={false}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
        />
      )}
    </ScreenShell>

    <OptionSheet
      visible={optionsBook !== null}
      title={optionsBook?.title ?? 'Opciones de audiolibro'}
      options={BOOK_ACTIONS}
      onSelect={() => {
        if (optionsBook) {
          void setAudiobook(
            optionsBook.chapters.map((chapter) => chapter.id),
            false
          );
        }
      }}
      onClose={() => setOptionsBook(null)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: Spacing.two,
  },
  search: {
    height: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  bookInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  action: {
    padding: Spacing.one,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Ajuste óptico: el triángulo de "play" se ve mejor un poco a la derecha.
    paddingLeft: 2,
  },
  flex: {
    flex: 1,
  },
  listContent: {
    paddingBottom: BottomTabInset + 110,
  },
  loader: {
    marginTop: Spacing.five,
  },
});
