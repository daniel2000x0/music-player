import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import {
  describeAudioQuality,
  formatAudioQualityLabel,
  normalizeAudioFormat,
} from '@/utils/format';

type AudioQualityBadgeProps = {
  format: string | null | undefined;
  bitDepth?: number | null;
  sampleRate?: number | null;
  bitrate?: number | null;
  /** Muestra la etiqueta "Lyrics" solo cuando la canción tiene letras. */
  hasLyrics?: boolean;
};

/**
 * Píldora informativa de formato/calidad.
 *
 * LÓGICA: se conserva el patrón actual `FORMATO · BITRATE` (y detalles
 * técnicos cuando existen). Si hay letras, se amplía a `... · Lyrics`.
 * FLAC se resalta en verde para indicar alta calidad.
 */
export function AudioQualityBadge({ format, bitDepth, sampleRate, bitrate, hasLyrics }: AudioQualityBadgeProps) {
  const theme = useTheme();
  const { language, tr } = useTranslation();
  const normalized = normalizeAudioFormat(format);
  const quality = { format: normalized, bitDepth, sampleRate, bitrate };
  const baseLabel = formatAudioQualityLabel(quality, language);
  const baseDescription = describeAudioQuality(quality, language);

  if (!baseLabel || !normalized) {
    return null;
  }

  const lyricsLabel = tr('Letras');
  const label = hasLyrics ? `${baseLabel} · ${lyricsLabel}` : baseLabel;
  const description = hasLyrics
    ? `${baseDescription ?? baseLabel}, ${lyricsLabel}`
    : baseDescription ?? baseLabel;
  const highQuality = normalized === 'flac';

  return (
    <View
      accessibilityLabel={description}
      style={[
        styles.badge,
        {
          backgroundColor: highQuality ? theme.successBg : theme.backgroundElement,
          borderColor: highQuality ? theme.success : theme.border,
        },
      ]}>
      <ThemedText
        type="small"
        numberOfLines={1}
        style={[styles.text, { color: highQuality ? theme.success : theme.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
