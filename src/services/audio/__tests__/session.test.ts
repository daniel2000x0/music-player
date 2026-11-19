/**
 * Máquina de estados de la sesión (`session`).
 *
 * LÓGICA: las transiciones no declaradas se rechazan; en desarrollo lanzan para
 * detectar bugs de integración y en producción se ignoran conservando elEstado
 * anterior. Los estados degradados no son terminales y vuelven a la realidad
 * reproducción al recuperarse la capacidad.
 */

import {
  canTransitionTo,
  clearDegradation,
  degradeSession,
  getSession,
  resetSession,
  subscribeSession,
  transitionTo,
  type SessionState,
} from '@/services/audio/session';

type GlobalWithDev = { __DEV__?: boolean };

const originalDev = (globalThis as GlobalWithDev).__DEV__;

function setDev(value: boolean): void {
  (globalThis as GlobalWithDev).__DEV__ = value;
}

function restoreDev(): void {
  (globalThis as GlobalWithDev).__DEV__ = originalDev;
}

/** Ruta legal hasta `playing` para probar transiciones posteriores. */
function toPlaying(): void {
  transitionTo('preparing');
  transitionTo('playing');
}

beforeEach(() => {
  resetSession();
});

afterEach(() => {
  restoreDev();
  jest.restoreAllMocks();
});

describe('sesión: transiciones legales e ilegales', () => {
  it('recorre el ciclo legal de reproducción', () => {
    expect(getSession()).toEqual({ state: 'idle', error: null });

    const legal: SessionState[] = [
      'preparing',
      'ready',
      'playing',
      'paused',
      'playing',
      'recovering',
      'ready',
      'idle',
    ];
    for (const next of legal) {
      expect(canTransitionTo(next)).toBe(true);
      expect(transitionTo(next)).toBe(true);
      expect(getSession().state).toBe(next);
    }
  });

  it('acepta la misma fase sin cambiar de estado', () => {
    transitionTo('preparing');
    expect(transitionTo('preparing')).toBe(true);
    expect(getSession().state).toBe('preparing');
  });

  it('rechaza una transición ilegal lanzando en desarrollo', () => {
    setDev(true);

    expect(canTransitionTo('playing')).toBe(false);
    expect(() => transitionTo('playing')).toThrow(/idle → playing/);
    expect(getSession()).toEqual({ state: 'idle', error: null });

    toPlaying();
    expect(() => transitionTo('idle')).not.toThrow();
    expect(() => transitionTo('recovering')).toThrow(/idle → recovering/);
  });

  it('ignora la transición ilegal en producción sin perder el estado', () => {
    setDev(false);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(transitionTo('playing')).toBe(false);
    expect(getSession()).toEqual({ state: 'idle', error: null });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('idle → playing'));
  });

  it('registra el motivo de failed y permite recuperarse', () => {
    transitionTo('preparing');

    expect(transitionTo('failed', { error: 'sin playlist' })).toBe(true);
    expect(getSession()).toEqual({ state: 'failed', error: 'sin playlist' });

    expect(transitionTo('recovering')).toBe(true);
    expect(transitionTo('playing')).toBe(true);
    expect(getSession().error).toBeNull();
  });

  it('el mismo estado puede actualizar el motivo del error', () => {
    transitionTo('preparing');
    transitionTo('failed', { error: 'primer error' });

    expect(transitionTo('failed', { error: 'segundo error' })).toBe(true);
    expect(getSession()).toEqual({ state: 'failed', error: 'segundo error' });
  });

  it('emite el estado actual al suscribirse y en cada cambio', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeSession((snapshot) => seen.push(snapshot.state));

    expect(seen).toEqual(['idle']);
    transitionTo('preparing');
    transitionTo('ready');
    unsubscribe();
    transitionTo('playing');

    expect(seen).toEqual(['idle', 'preparing', 'ready']);
  });

  it('degrada con motivo y vuelve al estado real al recuperarse', () => {
    toPlaying();
    degradeSession('sin controles de pantalla de bloqueo');

    expect(getSession()).toEqual({
      state: 'degraded',
      error: 'sin controles de pantalla de bloqueo',
    });

    // La degradación no cambia el motivo si se repite.
    degradeSession('sin controles de pantalla de bloqueo');
    expect(getSession().state).toBe('degraded');

    clearDegradation(true);
    expect(getSession()).toEqual({ state: 'playing', error: null });
  });

  it('clearDegradation vuelve a paused si no se estaba reproduciendo', () => {
    transitionTo('preparing');
    transitionTo('ready');
    degradeSession('sin notificaciones');

    clearDegradation(false);

    expect(getSession()).toEqual({ state: 'paused', error: null });
  });

  it('ignora la degradación en idle y un clearDegradation sin degradar', () => {
    expect(() => degradeSession('nada que degradar')).not.toThrow();
    expect(getSession()).toEqual({ state: 'idle', error: null });

    clearDegradation(true);
    expect(getSession().state).toBe('idle');
  });

  it('resetSession vuelve a idle limpiando el motivo', () => {
    transitionTo('preparing');
    transitionTo('failed', { error: 'fallo' });

    resetSession();

    expect(getSession()).toEqual({ state: 'idle', error: null });
  });
});
