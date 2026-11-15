import {
  canTransitionTo,
  getSession,
  resetSession,
  subscribeSession,
  transitionTo,
} from '@/services/audio/session';

beforeEach(() => {
  resetSession();
});

describe('session: máquina de estados del motor', () => {
  it('arranca en idle y recorre el ciclo de reproducción', () => {
    expect(getSession()).toEqual({ state: 'idle', error: null });

    expect(transitionTo('preparing')).toBe(true);
    expect(transitionTo('ready')).toBe(true);
    expect(transitionTo('playing')).toBe(true);
    expect(transitionTo('paused')).toBe(true);
    expect(transitionTo('playing')).toBe(true);
    expect(transitionTo('idle')).toBe(true);
  });

  it('permite reconstruir (recovering) conservando el estado de error limpio', () => {
    transitionTo('preparing');
    transitionTo('ready');
    transitionTo('playing');

    expect(transitionTo('recovering')).toBe(true);
    expect(getSession()).toEqual({ state: 'recovering', error: null });

    expect(transitionTo('ready')).toBe(true);
    expect(getSession()).toEqual({ state: 'ready', error: null });
  });

  it('rechaza una transición no declarada y conserva el estado anterior', () => {
    expect(canTransitionTo('playing')).toBe(false);
    expect(() => transitionTo('playing')).toThrow(/idle → playing/);
    expect(getSession().state).toBe('idle');
  });

  it('marca failed con motivo y permite recuperarse', () => {
    transitionTo('preparing');

    expect(transitionTo('failed', { error: 'No se pudo crear la playlist' })).toBe(true);
    expect(getSession()).toEqual({
      state: 'failed',
      error: 'No se pudo crear la playlist',
    });

    expect(transitionTo('recovering')).toBe(true);
    expect(transitionTo('playing')).toBe(true);
    expect(getSession().error).toBeNull();
  });

  it('emite el estado actual al suscribirse y en cada cambio', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeSession((snapshot) => seen.push(snapshot.state));

    transitionTo('preparing');
    transitionTo('ready');
    unsubscribe();
    transitionTo('playing');

    expect(seen).toEqual(['idle', 'preparing', 'ready']);
  });
});
