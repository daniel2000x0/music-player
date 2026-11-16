import {
  emptySession,
  filterSessionToAvailable,
  parseSession,
  serializeSession,
  type PlaybackSession,
} from '@/domain/playback/session';

function session(overrides: Partial<PlaybackSession> = {}): PlaybackSession {
  return {
    queueSongIds: [1, 2, 3],
    currentSongId: 2,
    positionSeconds: 42.5,
    repeatMode: 'all',
    shuffle: true,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('playback session: serialización', () => {
  it('sobrevive un ciclo completo de escritura y lectura', () => {
    const original = session();

    expect(parseSession(serializeSession(original))).toEqual(original);
  });

  it('arranca vacía sin cola ni pista actual', () => {
    expect(emptySession(7)).toEqual({
      queueSongIds: [],
      currentSongId: null,
      positionSeconds: 0,
      repeatMode: 'none',
      shuffle: false,
      updatedAt: 7,
    });
  });
});

describe('playback session: validación', () => {
  it('descarta payloads que no son una sesión restaurable', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession('')).toBeNull();
    expect(parseSession('no es json')).toBeNull();
    expect(parseSession('[]')).toBeNull();
    expect(parseSession('{"queueSongIds":[]}')).toBeNull();
    expect(parseSession('{"queueSongIds":["1",0,-2,null]}')).toBeNull();
  });

  it('normaliza los campos inválidos en vez de perder la cola', () => {
    const parsed = parseSession(
      JSON.stringify({
        queueSongIds: [5, '6', 7.5, 8],
        currentSongId: '5',
        positionSeconds: -12,
        repeatMode: 'shuffle',
        shuffle: 'sí',
      })
    );

    expect(parsed).toEqual({
      queueSongIds: [5, 8],
      currentSongId: 5,
      positionSeconds: 0,
      repeatMode: 'none',
      shuffle: false,
      updatedAt: expect.any(Number),
    });
  });

  it('acepta los tres modos de repetición y rechaza el resto', () => {
    for (const mode of ['none', 'all', 'single'] as const) {
      const parsed = parseSession(JSON.stringify(session({ repeatMode: mode })));
      expect(parsed?.repeatMode).toBe(mode);
    }

    const invalid = parseSession(JSON.stringify({ ...session(), repeatMode: 'loop' }));
    expect(invalid?.repeatMode).toBe('none');
  });

  it('cae a la primera pista de la cola si la actual no es válida', () => {
    const parsed = parseSession(
      JSON.stringify({ queueSongIds: [9, 10], currentSongId: 0 })
    );

    expect(parsed?.currentSongId).toBe(9);
  });
});

describe('playback session: filtrado contra la biblioteca', () => {
  it('quita los ids ausentes conservando el orden y la pista actual', () => {
    const result = filterSessionToAvailable(session(), new Set([1, 3, 99]));

    expect(result.session.queueSongIds).toEqual([1, 3]);
    expect(result.session.currentSongId).toBe(1);
    expect(result.removed).toBe(1);
  });

  it('no toca nada cuando toda la cola existe', () => {
    const result = filterSessionToAvailable(session(), new Set([1, 2, 3]));

    expect(result.session.queueSongIds).toEqual([1, 2, 3]);
    expect(result.session.currentSongId).toBe(2);
    expect(result.removed).toBe(0);
  });

  it('deja la cola vacía y sin pista actual si nada sobrevive', () => {
    const result = filterSessionToAvailable(session(), new Set([100]));

    expect(result.session.queueSongIds).toEqual([]);
    expect(result.session.currentSongId).toBeNull();
    expect(result.removed).toBe(3);
  });
});
