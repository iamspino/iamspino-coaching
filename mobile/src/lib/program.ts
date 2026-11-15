import { colors } from '@/config';

export const PROGRAM_STATUS = {
  draft: { label: 'Bozza', color: colors.muted2 },
  active: { label: 'Attiva', color: colors.green },
  archived: { label: 'Archiviata', color: colors.muted },
} as const;
