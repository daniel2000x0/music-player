/**
 * Resumen de un escaneo de la biblioteca.
 *
 * LÓGICA: `runLibraryScan` devuelve este resumen al terminar (o `null` si la
 * mediateca no se pudo leer). La UI lo formatea con `describeScanReport`, sin
 * recalcular reglas: la fase de persistencia ya hizo el trabajo.
 *
 * NOTA (i18n): el resumen se arma con plantillas plurales del catálogo, así
 * que "1 nueva" / "3 nuevas" se convierten en "1 new" / "3 new" en inglés.
 */

import type { ScanMode } from '@/domain/library/scan-diff';
import { DEFAULT_LANGUAGE, t, type AppLanguage } from '@/i18n';

export type ScanReport = {
  mode: ScanMode;
  /** Pistas anunciadas por la mediateca en esta pasada. */
  deviceTotal: number;
  added: number;
  updated: number;
  unchanged: number;
  /** Pistas guardadas que ya no están en el dispositivo (podadas). */
  missing: number;
  /** Pistas que no se pudieron leer (archivo ilegible o borrado a medias). */
  skipped: number;
  durationMs: number;
  /** Momento de finalización (ms desde epoch). */
  finishedAt: number;
};

/** `true` si el escaneo tocó la biblioteca guardada. */
export function scanReportHasChanges(report: ScanReport): boolean {
  return report.added + report.updated + report.missing > 0;
}

/**
 * Texto breve del último escaneo, p. ej. «2 nuevas · 1 ausente · 12 s».
 * Se usa en Configuración para dar evidencia de que el trabajo ocurrió.
 */
export function describeScanReport(
  report: ScanReport,
  language: AppLanguage = DEFAULT_LANGUAGE
): string {
  const parts: string[] = [];
  if (report.added > 0) {
    parts.push(t(language, 'scanAdded', { count: report.added }));
  }
  if (report.updated > 0) {
    parts.push(t(language, 'scanUpdated', { count: report.updated }));
  }
  if (report.missing > 0) {
    parts.push(t(language, 'scanMissing', { count: report.missing }));
  }
  if (parts.length === 0) {
    parts.push(t(language, 'scanNoChanges'));
  }
  if (report.skipped > 0) {
    parts.push(t(language, 'scanSkipped', { count: report.skipped }));
  }
  const seconds = Math.max(1, Math.round(report.durationMs / 1000));
  return `${parts.join(' · ')} · ${seconds} s`;
}
