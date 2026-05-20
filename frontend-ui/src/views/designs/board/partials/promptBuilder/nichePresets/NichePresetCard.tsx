// PROJ-34 Phase 13t-j — Shared MUI Card for niche-preset Top / Mix / History / Custom
// tiles. Accepts both the persisted nested shape (NichePresetCard) and the flat
// in-memory shape (NichePresetTopCardDict) so the same component can render every
// grid in the "Aus der Niche" section.
//
// Props:
//   - card: the preset data (either shape)
//   - onClick: fires with the original card object (no shape normalization here)
//   - topRightChip: optional slot for source-type chip / "+N more" overflow
//   - bottomActions: optional slot for promote/delete IconButtons
//   - selected: applies brand-coral border (active state, AC-107 anchor)
//   - disabled: greys out + disables click (EC-42 — Mix cards during regen)

import type { ReactNode } from 'react';
import { Box, Card, CardActionArea, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type {
  NichePresetCard as NichePresetCardType,
  NichePresetTopCardDict,
} from '@/types/nichePreset';

export type AnyPresetCard = NichePresetCardType | NichePresetTopCardDict;

interface NichePresetCardProps {
  card: AnyPresetCard;
  onClick: (card: AnyPresetCard) => void;
  topRightChip?: ReactNode;
  bottomActions?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** When true, renders a wider card (300×100 thumb, 3:1 aspect) for collage
   *  thumbnails (Best-of-Mix cards). Default: false (200×200 square thumb). */
  wide?: boolean;
}

const CardRoot = styled(Card, {
  shouldForwardProp: (prop) =>
    prop !== 'selected' && prop !== 'disabled' && prop !== 'wide',
})<{ selected?: boolean; disabled?: boolean; wide?: boolean }>(
  ({ theme, selected, disabled, wide }) => ({
    width: wide ? 300 : 200,
    position: 'relative',
    border: `2px solid ${
      selected ? theme.vars.palette.primary.main : 'transparent'
    }`,
    transition: 'border-color 150ms ease, opacity 150ms ease',
    opacity: disabled ? 0.5 : 1,
  }),
);

const ThumbnailImg = styled('img', {
  shouldForwardProp: (prop) => prop !== 'wide',
})<{ wide?: boolean }>(({ theme, wide }) => ({
  width: wide ? 300 : 200,
  height: wide ? 100 : 200,
  objectFit: 'cover',
  display: 'block',
  backgroundColor: theme.vars.palette.action.disabledBackground,
}));

const Label = styled(Typography)(({ theme }) => ({
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  padding: theme.spacing(1),
  fontSize: '0.875rem',
  lineHeight: 1.3,
  minHeight: '2.6em',
}));

const ChipSlot = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  zIndex: 1,
}));

const ActionsSlot = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(5.5),
  right: theme.spacing(0.5),
  zIndex: 1,
}));

const NichePresetCard = ({
  card,
  onClick,
  topRightChip,
  bottomActions,
  selected,
  disabled,
  wide,
}: NichePresetCardProps) => {
  const label = card.preset_label;
  const thumbUrl = card.reference_thumbnail_url;

  return (
    <CardRoot
      selected={selected}
      disabled={disabled}
      wide={wide}
      data-selected={selected ? 'true' : 'false'}
    >
      <CardActionArea
        onClick={() => onClick(card)}
        aria-label={label}
        disabled={disabled}
      >
        <ThumbnailImg
          src={thumbUrl || undefined}
          alt={label}
          loading="lazy"
          wide={wide}
        />
        <Label variant="body2">{label}</Label>
      </CardActionArea>
      {topRightChip && <ChipSlot>{topRightChip}</ChipSlot>}
      {bottomActions && <ActionsSlot>{bottomActions}</ActionsSlot>}
    </CardRoot>
  );
};

export default NichePresetCard;
