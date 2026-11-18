/**
 * Progreso del escaneo de la biblioteca (`UI-06`).
 *
 * LÓGICA: el escaneo es un pipeline por fases y puede tardar decenas de
 * segundos en bibliotecas grandes. El store publica un `ScanProgress`
 * inmutable tras cada lote; la UI solo formatea estos datos, sin repetir
 * reglas de negocio ni cálculos.
 */

import type { ScanMode } from '@/domain/library/scan-diff';

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
export function describeScanProgress(progress: ScanProgress): string {
  switch (progress.phase) {
    case 'enumerate':
      return progress.total > 0
        ? `Encontradas ${progress.total} pistas en el dispositivo`
        : 'Buscando archivos en el dispositivo…';
    case 'diff':
      return 'Comparando con tu biblioteca…';
    case 'hydrate':
      return `Leyendo metadatos (${progress.processed} de ${progress.total})…`;
    case 'persist':
      return `Guardando cambios (${progress.processed} de ${progress.total})…`;
    case 'prune':
      return progress.total > 0
        ? `Marcando pistas ausentes (${progress.processed} de ${progress.total})…`
        : 'Marcando pistas ausentes…';
    case 'backfill':
      return `Buscando carátulas (${progress.processed} de ${progress.total})…`;
    case 'done':
      return 'Biblioteca actualizada';
  }
}
