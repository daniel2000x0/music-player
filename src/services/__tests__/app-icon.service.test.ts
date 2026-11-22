/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * El icono alterno depende de código nativo que Expo Go no incluye. Estas
 * pruebas garantizan que la degradación sea silenciosa: el tema se aplica
 * igual y el servicio informa `unsupported` sin lanzar.
 */
jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: jest.fn(() => null),
}));

jest.mock('@/services/error-log.service', () => ({ logError: jest.fn() }));

describe('app icon service', () => {
  it('informa de que el cambio no está disponible sin el módulo nativo', async () => {
    const { canChangeAppIcon, setAppIconForTheme } = require('@/services/app-icon.service');

    expect(canChangeAppIcon()).toBe(false);
    await expect(setAppIconForTheme('ironman')).resolves.toBe('unsupported');
    await expect(setAppIconForTheme('light')).resolves.toBe('unsupported');
  });
});
