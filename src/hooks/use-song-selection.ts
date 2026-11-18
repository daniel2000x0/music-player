import { useCallback, useMemo, useState } from 'react';

import type { Song } from '@/types/song';

export type SongSelection = {
  /** Ids seleccionados, en orden de selección. */
  selectedIds: number[];
  /** `true` mientras haya al menos una pista seleccionada. */
  isActive: boolean;
  isSelected: (song: Song) => boolean;
  /** Añade o quita una pista (una pulsación larga entra en el modo). */
  toggle: (song: Song) => void;
  /** Selecciona todas las pistas indicadas. */
  selectAll: (songs: readonly Song[]) => void;
  /** Sale del modo de selección. */
  clear: () => void;
};

/**
 * Estado del modo de selección múltiple (`FASE 5.2`).
 *
 * LÓGICA: no hay un booleano "modo activo"; el modo está activo mientras haya
 * al menos una pista seleccionada. Una pulsación larga selecciona la pista
 * (entra en el modo) y una pulsación normal alterna la selección. `clear` sale
 * del modo.
 */
export function useSongSelection(): SongSelection {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = useCallback((song: Song) => {
    setSelectedIds((previous) =>
      previous.includes(song.id)
        ? previous.filter((id) => id !== song.id)
        : [...previous, song.id]
    );
  }, []);

  const selectAll = useCallback((songs: readonly Song[]) => {
    setSelectedIds(songs.map((song) => song.id));
  }, []);

  const clear = useCallback(() => setSelectedIds([]), []);

  const isSelected = useCallback((song: Song) => selectedSet.has(song.id), [selectedSet]);

  return {
    selectedIds,
    isActive: selectedIds.length > 0,
    isSelected,
    toggle,
    selectAll,
    clear,
  };
}
