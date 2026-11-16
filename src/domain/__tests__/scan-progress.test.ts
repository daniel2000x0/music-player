import {
  describeScanPercent,
  describeScanProgress,
  scanProgressPercent,
  type ScanProgress,
} from '@/domain/library/scan-progress';
import {
  describeScanReport,
  scanReportHasChanges,
  type ScanReport,
} from '@/domain/library/scan-report';

const progress = (overrides: Partial<ScanProgress> = {}): ScanProgress => ({
  phase: 'hydrate',
  processed: 0,
  total: 0,
  ...overrides,
});

const report = (overrides: Partial<ScanReport> = {}): ScanReport => ({
  mode: 'incremental',
  deviceTotal: 10,
  added: 0,
  updated: 0,
  unchanged: 10,
  missing: 0,
  skipped: 0,
  durationMs: 1_000,
  finishedAt: 0,
  ...overrides,
});

describe('scanProgressPercent', () => {
  it('devuelve null mientras el total es desconocido', () => {
    expect(scanProgressPercent(progress({ total: 0 }))).toBeNull();
  });

  it('redondea y recorta al 100 %', () => {
    expect(scanProgressPercent(progress({ processed: 1, total: 3 }))).toBe(33);
    expect(scanProgressPercent(progress({ processed: 50, total: 50 }))).toBe(100);
    expect(scanProgressPercent(progress({ processed: 60, total: 50 }))).toBe(100);
  });
});

describe('describeScanPercent', () => {
  it('usa puntos suspensivos sin progreso o sin total', () => {
    expect(describeScanPercent(null)).toBe('…');
    expect(describeScanPercent(progress())).toBe('…');
  });

  it('formatea el porcentaje', () => {
    expect(describeScanPercent(progress({ processed: 2, total: 4 }))).toBe('50 %');
  });
});

describe('describeScanProgress', () => {
  it('describe cada fase con su conteo', () => {
    expect(describeScanProgress(progress({ phase: 'enumerate', total: 12 }))).toBe(
      'Encontradas 12 pistas en el dispositivo'
    );
    expect(describeScanProgress(progress({ phase: 'enumerate' }))).toBe(
      'Buscando archivos en el dispositivo…'
    );
    expect(describeScanProgress(progress({ phase: 'diff' }))).toBe(
      'Comparando con tu biblioteca…'
    );
    expect(describeScanProgress(progress({ phase: 'hydrate', processed: 3, total: 9 }))).toBe(
      'Leyendo metadatos (3 de 9)…'
    );
    expect(describeScanProgress(progress({ phase: 'persist', processed: 9, total: 9 }))).toBe(
      'Guardando cambios (9 de 9)…'
    );
    expect(describeScanProgress(progress({ phase: 'prune', processed: 1, total: 2 }))).toBe(
      'Marcando pistas ausentes (1 de 2)…'
    );
    expect(describeScanProgress(progress({ phase: 'done' }))).toBe('Biblioteca actualizada');
  });
});

describe('scanReportHasChanges', () => {
  it('solo cuenta altas, cambios y ausencias', () => {
    expect(scanReportHasChanges(report())).toBe(false);
    expect(scanReportHasChanges(report({ added: 1 }))).toBe(true);
    expect(scanReportHasChanges(report({ updated: 1 }))).toBe(true);
    expect(scanReportHasChanges(report({ missing: 1 }))).toBe(true);
    expect(scanReportHasChanges(report({ skipped: 1 }))).toBe(false);
  });
});

describe('describeScanReport', () => {
  it('resume el escaneo sin cambios', () => {
    expect(describeScanReport(report({ durationMs: 400 }))).toBe('sin cambios · 1 s');
  });

  it('concuerda singular y plural', () => {
    expect(
      describeScanReport(
        report({ added: 2, updated: 1, missing: 3, durationMs: 12_400 })
      )
    ).toBe('2 nuevas · 1 actualizada · 3 ausentes · 12 s');
  });

  it('incluye pistas ilegibles sin confundirlas con cambios', () => {
    expect(describeScanReport(report({ skipped: 1, durationMs: 2_000 }))).toBe(
      'sin cambios · 1 ilegible · 2 s'
    );
  });
});
