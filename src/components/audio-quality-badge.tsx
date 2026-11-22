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
};

/**
 * Píldora informativa de formato/calidad.
 *
 * LÓGICA: FLAC se resalta en verde para indicar alta calidad. Si hay datos
 * técnicos, muestra formato tipo `FLAC 16/44.1 kHz · 1411 kbps`. El resto se
 * muestra en neutro. Si no se reconoce, no se renderiza nada.
 */
export function AudioQualityBadge({ format, bitDepth, sampleRate, bitrate }: AudioQualityBadgeProps) {
  const theme = useTheme();
  const { language } = useTranslation();
  const normalized = normalizeAudioFormat(format);
  const quality = { format: normalized, bitDepth, sampleRate, bitrate };
  const label = formatAudioQualityLabel(quality, language);
  const description = describeAudioQuality(quality, language);

  if (!label || !normalized) {
    return null;
  }

  const highQuality = normalized === 'flac';

  return (
    <View
      accessibilityLabel={description ?? label}
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
