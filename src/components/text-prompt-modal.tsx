import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Scrim, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextPromptModalProps = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
};

/** Modal pequeño para pedir un texto (crear/renombrar playlist). */
export function TextPromptModal({ visible, ...props }: TextPromptModalProps) {
  if (!visible) {
    return null;
  }
  return <TextPromptContent {...props} />;
}

function TextPromptContent({
  title,
  placeholder,
  initialValue = '',
  confirmLabel = 'Guardar',
  onConfirm,
  onClose,
}: Omit<TextPromptModalProps, 'visible'>) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);

  const confirm = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    onConfirm(trimmed);
    onClose();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}
          onPress={(event) => event.stopPropagation()}>
          <ThemedText type="smallBold" style={styles.title}>
            {title}
          </ThemedText>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={title}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={confirm}
            style={[styles.input, { backgroundColor: theme.backgroundSelected, color: theme.text }]}
          />
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.button} accessibilityRole="button">
              <ThemedText type="smallBold" themeColor="textSecondary">
                Cancelar
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={confirm}
              accessibilityRole="button"
              style={[styles.button, styles.confirm, { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                {confirmLabel}
              </ThemedText>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Scrim,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.large,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  title: {
    fontSize: 16,
  },
  input: {
    height: 44,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  button: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.medium,
  },
  confirm: {
    minWidth: 88,
    alignItems: 'center',
  },
});
