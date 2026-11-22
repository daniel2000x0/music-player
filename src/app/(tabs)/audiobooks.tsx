import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { AlphabetChips } from '@/components/alphabet-chips';
import { Artwork } from '@/components/artwork';
import { EdgeScrollIndicator } from '@/components/edge-scroll-indicator';
import { EmptyState } from '@/components/empty-state';
import { MediaTile } from '@/components/media-tile';
import { OptionSheet, type Option } from '@/components/option-sheet';
import { RefreshButton } from '@/components/refresh-button';
import { ScreenShell } from '@/components/screen-shell';
import { SkeletonList } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ViewModePicker } from '@/components/view-mode-picker';
import {
  BottomTabInset,
  MiniPlayerInset,
  Radius,
  ScrollbarEdgeMargin,
  Spacing,
} from '@/constants/theme';
import { collectAudiobooks, type Audiobook } from '@/domain/library/audiobooks';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useScrollIndicator } from '@/hooks/use-scroll-indicator';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { useViewMode } from '@/hooks/use-view-mode';
import { useLibraryStore } from '@/stores/library.store';
import { usePlayerStore } from '@/stores/player.store';
import { collectInitials, initialKey } from '@/utils/alphabet';
import { formatDuration } from '@/utils/format';
import { getGridMetrics } from '@/utils/grid-layout';

// NOTA (i18n): los textos con conteo usan la plantilla `chapters`, que
// aplica el plural correcto en cada idioma mediante Intl.PluralRules.

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
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={() => book.albumId !== null && router.push(`/album/${book.albumId}`)}
      style={({ pressed }) => [styles.book, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('openAudiobook', { title: book.title, author: book.author })}>
      <Artwork uri={book.chapters[0]?.artwork ?? null} size={56} radius={Radius.small} />

      <View style={styles.bookInfo}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {book.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {book.author}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('chapters', { count: book.chapters.length })} · {formatDuration(book.totalDuration)}
        </ThemedText>
      </View>

      <Pressable
        hitSlop={8}
        onPress={() => onOptions(book)}
        style={styles.action}
        accessibilityRole="button"
        accessibilityLabel={t('optionsFor', { title: book.title })}>
        <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
      </Pressable>

      <Pressable
        hitSlop={8}
        onPress={() => onPlay(book)}
        style={[styles.playButton, { backgroundColor: theme.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('playTitle', { title: book.title })}>
        <Ionicons name="play" size={18} color={theme.accentText} />
      </Pressable>
    </Pressable>
  );
});

/** Pantalla "Audiolibros": contenido marcado como audiolibro, agrupado por carpeta. */
export default function AudiobooksScreen() {
  const theme = useTheme();
  const { tr, t } = useTranslation();
  const { mode } = useViewMode('audiobooks');
  const { width } = useWindowDimensions();
  const scrollIndicator = useScrollIndicator();
  const songs = useLibraryStore((state) => state.songs);
  const albums = useLibraryStore((state) => state.albums);
  const hasPermission = useLibraryStore((state) => state.hasPermission);
  const isLoading = useLibraryStore((state) => state.isLoading);
  const isScanning = useLibraryStore((state) => state.isScanning);
  const error = useLibraryStore((state) => state.error);
  const refresh = useLibraryStore((state) => state.refresh);
  const requestAccess = useLibraryStore((state) => state.requestAccess);
  const setAudiobook = useLibraryStore((state) => state.setAudiobook);
  const play = usePlayerStore((state) => state.play);

  const [query, setQuery] = useState('');
  const [optionsBook, setOptionsBook] = useState<Audiobook | null>(null);

  const books = useMemo(() => collectAudiobooks(songs, albums), [songs, albums]);

  // Geometría compartida con el resto de pestañas: paddings simétricos y
  // reparto del píxel suelto para que la rejilla no se desplace a un lado.
  const grid = getGridMetrics(mode, width);

  const bookActions: readonly Option<'remove'>[] = [
    {
      value: 'remove',
      label: tr('Remover de audiolibros'),
      description: tr('Sus capítulos vuelven a aparecer en la pestaña Canciones.'),
      destructive: true,
    },
  ];
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
  const keyExtractor = useCallback((book: Audiobook) => book.key, []);

  const listRef = useRef<FlatList<Audiobook>>(null);

  // Letras presentes en los audiolibros visibles, en orden alfabético.
  const availableLetters = useMemo(
    () => collectInitials(visibleBooks.map((book) => book.title)),
    [visibleBooks]
  );

  // Desplaza la lista hasta el primer audiolibro de la letra elegida.
  const scrollToLetter = useCallback(
    (letter: string) => {
      const index = visibleBooks.findIndex(
        (book) => initialKey(book.title) === letter
      );

      if (index !== -1) {
        listRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0,
        });
      }
    },
    [visibleBooks]
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.toolbar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={tr('Buscar audiolibros')}
          placeholderTextColor={theme.textSecondary}
          returnKeyType="search"
          style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />
        <ViewModePicker tab="audiobooks" />
      </View>
      {/* El índice alfabético solo aplica a la vista de lista. */}
      {mode === 'list' ? (
        <AlphabetChips letters={availableLetters} onSelect={scrollToLetter} itemNoun={tr('audiolibros')} />
      ) : null}
    </View>
  );

  if (!hasPermission) {
    return (
      <ScreenShell title={tr('Audiolibros')} scroll={false}>
        <EmptyState
          icon="book-outline"
          title={tr('Sin acceso a tu música')}
          message={tr('Concede permiso de audio para detectar audiolibros.')}
          actionLabel={tr('Conceder permiso')}
          onAction={() => void requestAccess()}
        />
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title={tr('Audiolibros')}
        subtitle={t('bookTitles', { count: books.length })}
        scroll={false}
        action={<RefreshButton />}
        header={header}>
      {isLoading ? (
        <SkeletonList rows={6} />
      ) : error && songs.length === 0 ? (
        <EmptyState
          icon="alert-circle-outline"
          title={tr('No se pudo leer tu música')}
          message={error}
          actionLabel={tr('Reintentar')}
          onAction={() => void refresh()}
        />
      ) : songs.length === 0 ? (
        <EmptyState
          icon="musical-notes-outline"
          title={tr('Tu biblioteca está vacía')}
          message={tr('Agrega archivos de audio al dispositivo y vuelve a escanear para detectar audiolibros.')}
          actionLabel={tr('Escanear de nuevo')}
          onAction={() => void refresh()}
        />
      ) : books.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title={tr('Sin audiolibros')}
          message={tr('Marca canciones desde su menú de opciones o deja que el escaneo detecte contenido largo.')}
        />
      ) : visibleBooks.length === 0 ? (
        <EmptyState title={tr('Sin resultados')} message={tr('No hay audiolibros que coincidan.')} />
      ) : (
        <View style={styles.listFrame}>
          <FlatList
            ref={listRef}
            data={visibleBooks}
            keyExtractor={keyExtractor}
            numColumns={grid.isGrid ? grid.columns : undefined}
            columnWrapperStyle={
              grid.isGrid
                ? { columnGap: grid.gap, justifyContent: 'center' }
                : undefined
            }
            key={mode}
            renderItem={({ item }) =>
              mode === 'list' ? (
                <BookRow book={item} onPlay={handlePlay} onOptions={setOptionsBook} />
              ) : (
                <MediaTile
                  width={grid.tileWidth}
                  variant={grid.variant}
                  artworkUri={item.chapters[0]?.artwork ?? null}
                  title={item.title}
                  subtitle={`${item.author} · ${t('chapters', { count: item.chapters.length })}`}
                  accessibilityLabel={t('openAudiobook', { title: item.title, author: item.author })}
                  onPress={() => (item.albumId !== null ? router.push(`/album/${item.albumId}`) : undefined)}
                  onLongPress={() => setOptionsBook(item)}
                />
              )
            }
            getItemLayout={
              mode === 'list'
                ? (_, index) => ({
                    length: ROW_HEIGHT,
                    offset: ROW_HEIGHT * index,
                    index,
                  })
                : undefined
            }
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            {...scrollIndicator.scrollProps}
            style={styles.flex}
            contentContainerStyle={[
              styles.listContent,
              { paddingLeft: grid.paddingLeft, paddingRight: grid.paddingRight },
              grid.isGrid && { gap: grid.gap, rowGap: Spacing.xl },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={isScanning}
                onRefresh={() => void refresh()}
                tintColor={theme.accent}
                colors={[theme.accent]}
              />
            }
          />
          <EdgeScrollIndicator {...scrollIndicator.indicatorProps} />
        </View>
      )}
    </ScreenShell>

    <OptionSheet
      visible={optionsBook !== null}
      title={optionsBook?.title ?? tr('Opciones de audiolibro')}
      options={bookActions}
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
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  search: {
    flex: 1,
    height: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
  },
  book: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  bookInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  action: {
    padding: Spacing.xs,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Ajuste óptico: el triángulo de "play" se ve mejor un poco a la derecha.
    paddingLeft: Spacing.xs,
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
    // Los paddings horizontales los fija `getGridMetrics` en cada render.
  },
});
