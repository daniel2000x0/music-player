import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Campos editables de una pista (corrección local, no reescribe el archivo). */
export type SongMetadataPatch = {
  title: string;
  artist: string;
  album: string;
};

export type SongEditModalProps = {
  visible: boolean;
  initialValues: SongMetadataPatch;
  onConfirm: (patch: SongMetadataPatch) => void;
  onClose: () => void;
};

/** Modal para corregir título, artista y álbum de una pista (`FASE 5.2`). */
export function SongEditModal({ visible, ...props }: SongEditModalProps) {
  if (!visible) {
    return null;
  }
  return <SongEditContent {...props} />;
}

function SongEditContent({
  initialValues,
  onConfirm,
  onClose,
}: Omit<SongEditModalProps, 'visible'>) {
  const theme = useTheme();
  const [title, setTitle] = useState(initialValues.title);
  const [artist, setArtist] = useState(initialValues.artist);
  const [album, setAlbum] = useState(initialValues.album);

  const trimmedTitle = title.trim();
  const canSave = trimmedTitle.length > 0;

  const confirm = () => {
    if (!canSave) {
      return;
    }
    onConfirm({ title: trimmedTitle, artist: artist.trim(), album: album.trim() });
    onClose();
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundSelected, color: theme.text },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}
          onPress={(event) => event.stopPropagation()}>
          <ThemedText type="smallBold" style={styles.title}>
            Editar información
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary">
            Se guarda solo en esta app; no modifica el archivo. Un campo vacío no cambia el valor
            actual.
          </ThemedText>

          <Field label="Título">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Título"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              returnKeyType="next"
              style={inputStyle}
            />
          </Field>

          <Field label="Artista">
            <TextInput
              value={artist}
              onChangeText={setArtist}
              placeholder="Artista"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              style={inputStyle}
            />
          </Field>

          <Field label="Álbum">
            <TextInput
              value={album}
              onChangeText={setAlbum}
              placeholder="Álbum"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              onSubmitEditing={confirm}
              style={inputStyle}
            />
          </Field>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.button}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancelar
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={confirm}
              disabled={!canSave}
              style={[
                styles.button,
                styles.confirm,
                { backgroundColor: theme.accent, opacity: canSave ? 1 : 0.5 },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                Guardar
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 16,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    height: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
  },
  confirm: {
    minWidth: 88,
    alignItems: 'center',
  },
});
