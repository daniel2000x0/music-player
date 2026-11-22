/**
 * Idioma activo accesible fuera de React.
 *
 * LÓGICA: los componentes leen el idioma del store de ajustes con un hook,
 * pero los servicios (avisos del sistema, formato de conteos) se ejecutan en
 * código imperativo y no pueden usar hooks. Este módulo es un espejo mínimo,
 * sin dependencias de SQLite ni de Expo, que el store mantiene sincronizado.
 * Así esos servicios no importan `settings.store` (que arrastraría
 * `expo-sqlite` a pruebas y a módulos que solo necesitan texto).
 *
 * NOTA (i18n): el espejo se actualiza en `hydrate` y en `setLanguage`, que son
 * los únicos caminos que cambian el idioma de la app.
 */

import { DEFAULT_LANGUAGE, isAppLanguage, type AppLanguage } from '@/i18n';

export { DEFAULT_LANGUAGE, type AppLanguage } from '@/i18n';

let currentLanguage: AppLanguage = DEFAULT_LANGUAGE;

/** Idioma vigente para formatear textos fuera de React. */
export function getCurrentLanguage(): AppLanguage {
  return currentLanguage;
}

/** Sincroniza el espejo; valores desconocidos caen al idioma por defecto. */
export function setCurrentLanguage(language: unknown): AppLanguage {
  currentLanguage = isAppLanguage(language) ? language : DEFAULT_LANGUAGE;
  return currentLanguage;
}
