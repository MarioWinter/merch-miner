/**
 * PROJ-30 Phase 3B — shared mobile card primitive used by 5 CardList
 * partials (Niche / Product / Keyword / Member / CloudFile). Mirrors the
 * common pattern from docs/features/proj-30/mobile-design-decisions.md §6.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────┐
 *   │ [✓]  {title}                              [⋯]   │
 *   │      {primary meta}                             │
 *   │      {secondary meta}                           │
 *   │      [chips…]                                   │
 *   └─────────────────────────────────────────────────┘
 *
 * - Card is `<article role="listitem">` for screen readers.
 * - Tapping the left 44px column toggles selection; tapping anywhere else
 *   fires `onActivate` (parent decides: open detail, edit, etc).
 * - Selected state flips border to `primary.main` and tints background.
 */
import type { ReactNode, MouseEvent } from 'react';
import { Box, Checkbox, IconButton, Paper, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import MoreVertIcon from '@mui/icons-material/MoreVert';

export interface MobileCardProps {
  title: ReactNode;
  /** Primary meta line (e.g. counts, BSR, etc). */
  primaryMeta?: ReactNode;
  /** Secondary meta line (e.g. date, ASIN). */
  secondaryMeta?: ReactNode;
  /** Optional chips row rendered below meta. */
  chips?: ReactNode;
  /** Selection state for the checkbox; omit to hide. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Aria label for the checkbox (i18n-templated by caller). */
  selectAriaLabel?: string;
  /** Activated when tapping anywhere except checkbox/menu. */
  onActivate?: () => void;
  /** Show 3-dot menu trigger; omit to hide. */
  onMenuOpen?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Aria label for the menu IconButton. */
  menuAriaLabel?: string;
}

const CardRoot = styled(Paper, {
  shouldForwardProp: (prop) => prop !== '$selected' && prop !== '$activatable',
})<{ $selected: boolean; $activatable: boolean }>(({ theme, $selected, $activatable }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5, 2),
  borderRadius: 12,
  width: '100%',
  cursor: $activatable ? 'pointer' : 'default',
  transition: `border-color 150ms ease, background-color 150ms ease`,
  borderColor: $selected ? theme.vars.palette.primary.main : theme.vars.palette.divider,
  backgroundColor: $selected
    ? `rgba(${theme.vars.palette.primary.mainChannel} / 0.08)`
    : theme.vars.palette.background.paper,
  '&:hover': {
    borderColor: $selected ? theme.vars.palette.primary.main : theme.vars.palette.text.secondary,
  },
}));

const SelectColumn = styled(Box)({
  width: 44,
  minWidth: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

const Body = styled(Stack)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  gap: theme.spacing(0.5),
}));

const TitleRow = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
});

const TitleText = styled(Typography)({
  fontWeight: 600,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
});

export const MobileCard = ({
  title,
  primaryMeta,
  secondaryMeta,
  chips,
  selectable = false,
  selected = false,
  onToggleSelect,
  selectAriaLabel,
  onActivate,
  onMenuOpen,
  menuAriaLabel,
}: MobileCardProps) => {
  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    // Only fire `onActivate` when the click target isn't an interactive element
    // already handled (checkbox, menu button, anchor). The columns above
    // call `stopPropagation()` on their handlers so this is mostly a safety
    // net for clicks that happen to land in dead space.
    if (!onActivate) return;
    onActivate();
    void event;
  };

  const handleCheckboxClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleSelect?.();
  };

  const handleMenuClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onMenuOpen?.(event);
  };

  return (
    <CardRoot
      variant="outlined"
      role="listitem"
      $selected={selected}
      $activatable={Boolean(onActivate)}
      onClick={handleCardClick}
    >
      {selectable && (
        <SelectColumn onClick={(e) => e.stopPropagation()}>
          <Checkbox
            size="small"
            checked={selected}
            onClick={handleCheckboxClick}
            slotProps={{ input: { 'aria-label': selectAriaLabel } }}
          />
        </SelectColumn>
      )}

      <Body>
        <TitleRow>
          <TitleText variant="body1">{title}</TitleText>
          {onMenuOpen && (
            <IconButton
              size="small"
              onClick={handleMenuClick}
              aria-label={menuAriaLabel}
              sx={{ flexShrink: 0, mt: -0.5, mr: -1 }}
            >
              <MoreVertIcon sx={{ fontSize: 20 }} />
            </IconButton>
          )}
        </TitleRow>

        {primaryMeta && (
          <Typography variant="body2" color="text.secondary">
            {primaryMeta}
          </Typography>
        )}
        {secondaryMeta && (
          <Typography variant="caption" color="text.disabled">
            {secondaryMeta}
          </Typography>
        )}
        {chips && (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 0.5, pt: 0.5 }}>
            {chips}
          </Stack>
        )}
      </Body>
    </CardRoot>
  );
};
