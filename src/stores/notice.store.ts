import { create } from 'zustand';

/**
 * Canal único de avisos tipados.
 *
 * RESPONSABILIDAD ÚNICA: convertir errores y degradaciones en datos que la UI
 * puede mostrar (`A-04`), en lugar de dejarlos solo en `error_logs`. La
 * deduplicación es por `code`: un fallo repetido actualiza el aviso existente
 * en vez de apilar banners idénticos.
 */

export type NoticeSeverity = 'info' | 'warning' | 'error';

export type NoticeAction = {
  label: string;
  onPress: () => void;
};

export type Notice = {
  /** Identificador estable para deduplicar (ej. `library.scan-failed`). */
  code: string;
  severity: NoticeSeverity;
  title: string;
  message?: string;
  action?: NoticeAction;
};

type NoticeState = {
  notices: Notice[];
  /** Alta o actualización por `code`; el más reciente queda primero. */
  push: (notice: Notice) => void;
  dismiss: (code: string) => void;
  clear: () => void;
};

/** Tope de avisos simultáneos: el banner solo pinta el primero. */
const MAX_NOTICES = 4;

export const useNoticeStore = create<NoticeState>((set) => ({
  notices: [],

  push: (notice) =>
    set((state) => {
      const previous = state.notices.find((item) => item.code === notice.code);
      const rest = state.notices.filter((item) => item.code !== notice.code);
      return {
        notices: [previous ? { ...previous, ...notice } : notice, ...rest].slice(
          0,
          MAX_NOTICES
        ),
      };
    }),

  dismiss: (code) =>
    set((state) => ({ notices: state.notices.filter((item) => item.code !== code) })),

  clear: () => set({ notices: [] }),
}));
