import { OptionSheet, type Option } from '@/components/option-sheet';

/** Decisión del usuario ante el diálogo de eliminación (`FASE 5.2`). */
export type DeleteChoice = 'library' | 'device';

const DELETE_OPTIONS: readonly Option<DeleteChoice>[] = [
  {
    value: 'library',
    label: 'Quitar de la biblioteca',
    description: 'Deja de mostrarse en la app. El archivo permanece en el dispositivo.',
  },
  {
    value: 'device',
    label: 'Borrar del dispositivo',
    description: 'Elimina el archivo del almacenamiento. No se puede deshacer.',
    destructive: true,
  },
];

export type SongDeleteSheetProps = {
  visible: boolean;
  title: string;
  onSelect: (choice: DeleteChoice) => void;
  onClose: () => void;
};

/**
 * Diálogo de eliminación reutilizable: quitar de la biblioteca (reversible, no
 * toca el archivo) o borrar del dispositivo (irreversible, el sistema pide su
 * propia confirmación).
 */
export function SongDeleteSheet({ visible, title, onSelect, onClose }: SongDeleteSheetProps) {
  return (
    <OptionSheet
      visible={visible}
      title={title}
      options={DELETE_OPTIONS}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
