import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';

export type InlineLyricsProps = {
  /** Texto ya leído del archivo; nunca vuelve a abrir el archivo aquí. */
  lyrics: string;
  /** Alto fijo reservado por `player-layout` para no mover el resto de la UI. */
  height: number;
  /** Líneas visibles en la vista previa; el modal sigue mostrando la letra completa. */
  numberOfLines: number;
  onPress: () => void;
};

/**
 * Vista previa de la letra entre la carátula y el título.
 *
 * LÓGICA: altura fija y `numberOfLines`, sin ScrollView propio: así el bloque
 * no crece con letras largas ni roba espacio a controles/barra de progreso.
 * Un toque abre `LyricsSheet` con el texto completo.
 */
export function InlineLyrics({ lyrics, height, numberOfLines, onPress }: InlineLyricsProps) {
  const theme = useTheme();
  const { tr } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('Ver letras')}
      style={({ pressed }) => [
        styles.container,
        {
          height,
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      <View style={styles.accent} pointerEvents="none">
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={numberOfLines} style={styles.text}>
          {lyrics}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.md,
  },
  accent: {
    flex: 1,
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'center',
  },
});
