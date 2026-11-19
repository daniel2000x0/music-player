import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AlphabetChipsProps = {
  /** Letras disponibles, en orden alfabético. */
  letters: string[];
  onSelect: (letter: string) => void;
  /** Sustantivo para el texto accesible (ej. "canciones", "audiolibros"). */
  itemNoun: string;
  /** Inicial activa opcional para resaltar la sección visible. */
  activeLetter?: string | null;
};

/**
 * Índice alfabético horizontal (chips A–Z) para listas largas.
 *
 * Se coloca por encima de la lista y convive con el indicador nativo de
 * desplazamiento en el borde derecho, sin superponerse a él.
 */
export function AlphabetChips({
  letters,
  onSelect,
  itemNoun,
  activeLetter,
}: AlphabetChipsProps) {
  const theme = useTheme();

  if (letters.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        {letters.map((letter) => {
          const active = letter === activeLetter;

          return (
            <Pressable
              key={letter}
              onPress={() => onSelect(letter)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? theme.accent : theme.backgroundElement,
                  borderColor: active ? theme.accent : theme.border,
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Ir a ${itemNoun} con la letra ${letter}`}>
              <ThemedText
                type="smallBold"
                style={[
                  styles.label,
                  { color: active ? theme.accentText : theme.textSecondary },
                ]}>
                {letter}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.sm,
  },

  content: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },

  chip: {
    minWidth: MinTouchTarget,
    minHeight: 32,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    fontSize: 13,
  },

  pressed: {
    opacity: 0.7,
  },
});
