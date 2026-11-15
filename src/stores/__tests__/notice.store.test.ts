import { useNoticeStore } from '@/stores/notice.store';

const baseNotice = {
  code: 'library.scan-failed',
  severity: 'error' as const,
  title: 'No se pudo escanear tu música',
  message: 'La mediateca no respondió.',
};

beforeEach(() => {
  useNoticeStore.getState().clear();
});

describe('notice.store: canal de avisos tipados', () => {
  it('da de alta un aviso y lo deja visible', () => {
    useNoticeStore.getState().push(baseNotice);

    expect(useNoticeStore.getState().notices).toEqual([baseNotice]);
  });

  it('deduplica por code y conserva la acción', () => {
    const onPress = jest.fn();
    useNoticeStore.getState().push(baseNotice);
    useNoticeStore.getState().push({
      ...baseNotice,
      message: 'Segundo intento fallido.',
      action: { label: 'Reintentar', onPress },
    });

    const notices = useNoticeStore.getState().notices;
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      code: 'library.scan-failed',
      message: 'Segundo intento fallido.',
      action: { label: 'Reintentar' },
    });

    notices[0].action?.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('descarta por code sin tocar los demás avisos', () => {
    useNoticeStore.getState().push(baseNotice);
    useNoticeStore.getState().push({
      code: 'library.permission-denied',
      severity: 'warning',
      title: 'Permiso de audio denegado',
    });

    useNoticeStore.getState().dismiss('library.scan-failed');

    expect(useNoticeStore.getState().notices.map((notice) => notice.code)).toEqual([
      'library.permission-denied',
    ]);
  });

  it('mantiene como máximo cuatro avisos, con el más reciente primero', () => {
    for (let index = 0; index < 6; index += 1) {
      useNoticeStore.getState().push({
        code: `notice.${index}`,
        severity: 'info',
        title: `Aviso ${index}`,
      });
    }

    const codes = useNoticeStore.getState().notices.map((notice) => notice.code);
    expect(codes).toEqual(['notice.5', 'notice.4', 'notice.3', 'notice.2']);
  });
});
