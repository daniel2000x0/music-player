/**
 * Pruebas del store de ajustes (`FASE 7`).
 *
 * LÓGICA: este store es la capa fina entre `settingsRepository` y la UI del
 * tema. Se sustituye el repositorio para comprobar dos cosas: que `hydrate`
 * lee el valor persistido y que `setTheme` actualiza el estado *y* persiste.
 * El valor por defecto (`dark`) se comprueba antes de cualquier hidratación.
 */
import { settingsRepository } from '@/data/repositories/settings.repository';
import { useSettingsStore } from '@/stores/settings.store';

jest.mock('@/data/repositories/settings.repository', () => ({
  settingsRepository: {
    get: jest.fn(async () => ({ theme: 'dark', volume: 1 })),
    setTheme: jest.fn(async () => undefined),
    setVolume: jest.fn(async () => undefined),
  },
}));

const mockedGet = jest.mocked(settingsRepository.get);
const mockedSetTheme = jest.mocked(settingsRepository.setTheme);

beforeEach(() => {
  // El store de zustand conserva su estado entre pruebas: se devuelve al estado
  // inicial para que la comprobación del valor por defecto sea fiable.
  useSettingsStore.setState({ theme: 'dark', hydrated: false });
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ theme: 'dark', volume: 1 });
});

describe('settings.store: tema', () => {
  it('arranca con el tema oscuro y todavía sin hidratar', () => {
    const state = useSettingsStore.getState();

    expect(state.theme).toBe('dark');
    expect(state.hydrated).toBe(false);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it('hydrate lee el repositorio y aplica el tema guardado', async () => {
    mockedGet.mockResolvedValueOnce({ theme: 'light', volume: 0.4 });

    await useSettingsStore.getState().hydrate();

    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState()).toMatchObject({
      theme: 'light',
      hydrated: true,
    });
  });

  it('hydrate respeta el tema oscuro persistido', async () => {
    mockedGet.mockResolvedValueOnce({ theme: 'dark', volume: 1 });

    await useSettingsStore.getState().hydrate();

    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(useSettingsStore.getState().hydrated).toBe(true);
  });

  it('setTheme actualiza el estado y persiste el valor nuevo', async () => {
    await useSettingsStore.getState().setTheme('light');

    expect(useSettingsStore.getState().theme).toBe('light');
    expect(mockedSetTheme).toHaveBeenCalledTimes(1);
    expect(mockedSetTheme).toHaveBeenCalledWith('light');
  });

  it('setTheme vuelve al tema oscuro sin alterar el flag de hidratación', async () => {
    useSettingsStore.setState({ hydrated: true });

    await useSettingsStore.getState().setTheme('dark');

    expect(useSettingsStore.getState().theme).toBe('dark');
    expect(useSettingsStore.getState().hydrated).toBe(true);
    expect(mockedSetTheme).toHaveBeenCalledWith('dark');
  });
});
