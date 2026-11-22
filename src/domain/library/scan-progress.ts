/**
 * Progreso del escaneo de la biblioteca (`UI-06`).
 *
 * LÓGICA: el escaneo es un pipeline por fases y puede tardar decenas de
 * segundos en bibliotecas grandes. El store publica un `ScanProgress`
 * inmutable tras cada lote; la UI solo formatea estos datos, sin repetir
 * reglas de negocio ni cálculos.
 *
 * NOTA (i18n): los textos salen del catálogo usando el idioma activo. El
 * parámetro es opcional para no romper las pruebas existentes que llaman a
 * la función sin argumento (en ese caso se usa español, el idioma fuente).
 */

import type { ScanMode } from '@/domain/library/scan-diff';
import { DEFAULT_LANGUAGE, t, type AppLanguage } from '@/i18n';

export type ScanPhase =
  | 'enumerate'
  | 'diff'
  | 'hydrate'
  | 'persist'
  | 'prune'
  | 'backfill'
  | 'done';

export type ScanProgress = {
  phase: ScanPhase;
  /** Elementos procesados en la fase actual. */
  processed: number;
  /** Total de la fase actual; `0` mientras es desconocido. */
  total: number;
  /** Modo decidido en la fase de comparación. */
  mode?: ScanMode;
};

/** Porcentaje 0-100, o `null` cuando la fase aún no conoce el total. */
export function scanProgressPercent(progress: ScanProgress): number | null {
  if (progress.total <= 0) {
    return null;
  }
  return Math.min(100, Math.round((progress.processed / progress.total) * 100));
}

/** Texto corto para el botón de refresco (porcentaje o puntos suspensivos). */
export function describeScanPercent(progress: ScanProgress | null): string {
  if (!progress) {
    return '…';
  }
  const percent = scanProgressPercent(progress);
  return percent === null ? '…' : `${percent} %`;
}

/** Texto descriptivo de la fase con conteo, para el banner de la biblioteca. */
export function describeScanProgress(
  progress: ScanProgress,
  language: AppLanguage = DEFAULT_LANGUAGE
): string {
  switch (progress.phase) {
    case 'enumerate':
      return progress.total > 0
        ? t(language, 'scanFoundTracks', { count: progress.total })
        : t(language, 'scanSearchingFiles');
    case 'diff':
      return t(language, 'scanComparing');
    case 'hydrate':
      return t(language, 'scanReadingMetadata', {
        processed: progress.processed,
        total: progress.total,
      });
    case 'persist':
      return t(language, 'scanSaving', {
        processed: progress.processed,
        total: progress.total,
      });
    case 'prune':
      return progress.total > 0
        ? t(language, 'scanMarkingMissingWithTotal', {
            processed: progress.processed,
            total: progress.total,
          })
        : t(language, 'scanMarkingMissing');
    case 'backfill':
      return t(language, 'searchingArtwork', {
        processed: progress.processed,
        total: progress.total,
      });
    case 'done':
      return t(language, 'scanDone');
  }
}
