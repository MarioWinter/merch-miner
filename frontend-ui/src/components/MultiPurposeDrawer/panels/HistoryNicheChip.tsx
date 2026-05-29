/**
 * FIX-chat-bugfixes-and-grouping Item 4 — read-only @niche chip rendered above
 * persisted user bubbles in chat history.
 *
 * Why a new component (not reuse of `ChatInputBar/partials/NicheChip.tsx`):
 * the existing `NicheChip` is a contenteditable DOM-builder (raw `<span>`s
 * mutated outside React's lifecycle) for the input bar. It cannot be reused
 * inside a React tree without bringing along the surrounding caret/selection
 * machinery. This component mirrors that chip's VISUAL style 1:1 (see
 * `SmartTextarea.tsx` lines 95-110) but is a pure React node with no click,
 * remove, or hover-lift behaviour — per Item 4 decision "read-only chip".
 */
import { useTranslation } from 'react-i18next';
import { styled } from '@mui/material/styles';

interface HistoryNicheChipProps {
  /** Niche display name. Required — chip is not rendered when null upstream. */
  name: string;
  /** Niche UUID — exposed as a data attribute for future click-target wiring;
   *  not used today (chip is purely visual). */
  nicheId?: string | null;
}

const ChipRoot = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.25),
  padding: theme.spacing(0.125, 0.75),
  borderRadius: 999,
  backgroundColor: theme.vars.palette.action.selected,
  color: theme.vars.palette.primary.main,
  border: `1px solid ${theme.vars.palette.primary.main}`,
  fontSize: '0.75rem',
  fontWeight: 500,
  lineHeight: 1.4,
  userSelect: 'none',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const HistoryNicheChip = ({ name, nicheId }: HistoryNicheChipProps) => {
  const { t } = useTranslation();
  return (
    <ChipRoot
      role="status"
      aria-label={t('search.history.referencedNicheAria', { name })}
      data-testid="referenced-niche-chip"
      data-niche-id={nicheId ?? undefined}
    >
      @{name}
    </ChipRoot>
  );
};

export default HistoryNicheChip;
