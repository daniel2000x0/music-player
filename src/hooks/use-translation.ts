import { useMemo } from 'react';

import { t, tr, type AppLanguage, type LiteralKey, type TemplateKey, type TemplateParams } from '@/i18n';
import { useSettingsStore } from '@/stores/settings.store';

export type Translation = {
  language: AppLanguage;
  /** Texto fijo: `tr('Canciones')`. */
  tr: (key: LiteralKey) => string;
  /** Texto con variables o plural: `t('songsCount', { count: 3 })`. */
  t: (key: TemplateKey, params?: TemplateParams) => string;
};

/**
 * Acceso a los textos traducidos desde cualquier componente.
 *
 * LÓGICA: el idioma vive en el store global (persistido en SQLite), así que
 * no hace falta un Provider. Solo se suspende al idioma: cambiar tema o
 * volumen no recalcula las funciones de traducción.
 */
export function useTranslation(): Translation {
  const language = useSettingsStore((state) => state.language);

  return useMemo(
    () => ({
      language,
      tr: (key: LiteralKey) => tr(language, key),
      t: (key: TemplateKey, params: TemplateParams = {}) => t(language, key, params),
    }),
    [language]
  );
}
