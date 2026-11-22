import { OptionSheet, type Option } from '@/components/option-sheet';
import { useTranslation } from '@/hooks/use-translation';

/** Decisión del usuario ante el diálogo de eliminación (`FASE 5.2`). */
export type DeleteChoice = 'library' | 'device';

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
 *
 * NOTA (i18n): las opciones se construyen dentro del componente porque sus
 * etiquetas dependen del idioma activo (un `const` de módulo no puede llamar
 * al hook).
 */
export function SongDeleteSheet({ visible, title, onSelect, onClose }: SongDeleteSheetProps) {
  const { tr } = useTranslation();

  const options: readonly Option<DeleteChoice>[] = [
    {
      value: 'library',
      label: tr('Quitar de la biblioteca'),
      description: tr('Deja de mostrarse en la app. El archivo permanece en el dispositivo.'),
    },
    {
      value: 'device',
      label: tr('Borrar del dispositivo'),
      description: tr('Elimina el archivo del almacenamiento. No se puede deshacer.'),
      destructive: true,
    },
  ];

  return (
    <OptionSheet
      visible={visible}
      title={title}
      options={options}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
