import {
  matchRelocations,
  type RelocationDevice,
  type RelocationStored,
} from '@/domain/library/relocation';

function stored(
  mediaId: string,
  overrides: Partial<RelocationStored> = {}
): RelocationStored {
  return {
    mediaId,
    filename: `${mediaId}.mp3`,
    durationMs: 180_000,
    folder: 'Album',
    contentKey: `huella-${mediaId}`,
    isAvailable: true,
    ...overrides,
  };
}

function device(
  mediaId: string,
  overrides: Partial<RelocationDevice> = {}
): RelocationDevice {
  return {
    mediaId,
    filename: `${mediaId}.mp3`,
    durationMs: 180_000,
    folder: 'Album',
    contentKey: `huella-${mediaId}`,
    ...overrides,
  };
}

describe('matchRelocations', () => {
  it('reconoce la misma pista por huella aunque cambiaron id, nombre y carpeta', () => {
    const matches = matchRelocations(
      [device('nuevo', { filename: 'otro.mp3', folder: 'Otro', contentKey: 'huella-viejo' })],
      [stored('viejo')]
    );
    expect([...matches]).toEqual([['viejo', 'nuevo']]);
  });

  it('usa nombre + carpeta + duración cuando no hay huella', () => {
    const matches = matchRelocations(
      [device('nuevo', { filename: 'viejo.mp3', contentKey: null })],
      [stored('viejo', { contentKey: null })]
    );
    expect(matches.get('viejo')).toBe('nuevo');
  });

  it('usa nombre + duración solo si la coincidencia es única a ambos lados', () => {
    const unique = matchRelocations(
      [device('nuevo', { filename: 'viejo.mp3', contentKey: null, folder: 'Otro' })],
      [stored('viejo', { contentKey: null, folder: 'Otro' })]
    );
    expect(unique.get('viejo')).toBe('nuevo');

    const ambiguous = matchRelocations(
      [
        device('nuevo-1', { filename: 'viejo.mp3', contentKey: null, folder: 'Otro' }),
        device('nuevo-2', { filename: 'viejo.mp3', contentKey: null, folder: 'Otro' }),
      ],
      [stored('viejo', { contentKey: null })]
    );
    expect(ambiguous.size).toBe(0);
  });

  it('no reutiliza una fila guardada ni empareja pistas no disponibles', () => {
    const matches = matchRelocations(
      [
        device('nuevo-1', { contentKey: 'huella-viejo' }),
        device('nuevo-2', { contentKey: 'huella-viejo' }),
      ],
      [stored('viejo'), stored('podada', { mediaId: 'podada', isAvailable: false })]
    );
    expect([...matches.values()]).toEqual(['nuevo-1']);
  });

  it('ignora pistas sin nombre ni huella', () => {
    expect(
      matchRelocations(
        [device('nuevo', { filename: null, contentKey: null })],
        [stored('viejo', { filename: null, contentKey: null })]
      ).size
    ).toBe(0);
  });
});
