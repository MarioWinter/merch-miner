// PROJ-34 Phase 8 — single row of the StylePicker list.
// 64px tall · grid 56px / 1fr / 28px · whole row is the click target.
// Idle / hover / selected / focus-visible follow the token cheat-sheet
// in the design spec (secondary.subtle bg + 3px left-accent for selected).

import { Box, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { DURATION, EASING } from '@/style/constants';
import type { StyleEntry } from '../../constants/styleLibrary';

interface StyleRowProps {
  entry: StyleEntry;
  selected: boolean;
  onToggle: (slug: string) => void;
}

const Row = styled('button')<{ 'data-selected': 'true' | 'false' }>(
  ({ theme, ...props }) => ({
    all: 'unset',
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: '56px 1fr 28px',
    columnGap: theme.spacing(1.5),
    alignItems: 'center',
    width: '100%',
    minHeight: 64,
    padding: theme.spacing(1, 1.5),
    borderRadius: 8,
    borderBottom: `1px solid ${theme.vars.palette.divider}`,
    position: 'relative',
    transition: [
      `background-color ${DURATION.fast}ms ${EASING.standard}`,
      `border-color ${DURATION.fast}ms ${EASING.standard}`,
    ].join(', '),
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
      borderTopLeftRadius: 8,
      borderBottomLeftRadius: 8,
      backgroundColor:
        props['data-selected'] === 'true'
          ? theme.vars.palette.secondary.main
          : 'transparent',
      transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
    },
    backgroundColor:
      props['data-selected'] === 'true'
        ? theme.vars.palette.secondary.subtle ??
          alpha(theme.palette.secondary.main, 0.1)
        : 'transparent',
    '&:hover': {
      backgroundColor:
        props['data-selected'] === 'true'
          ? theme.vars.palette.secondary.subtle ??
            alpha(theme.palette.secondary.main, 0.14)
          : theme.vars.palette.action.hover,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.vars.palette.secondary.main}`,
      outlineOffset: -2,
    },
  }),
);

const Thumb = styled('div')(({ theme }) => ({
  position: 'relative',
  width: 56,
  height: 56,
  borderRadius: 8,
  overflow: 'hidden',
  backgroundColor: theme.vars.palette.action.disabledBackground,
  flexShrink: 0,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
}));

const ThumbFallback = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  fontSize: '0.65rem',
  fontWeight: 600,
  textAlign: 'center',
  color: theme.vars.palette.text.secondary,
  padding: theme.spacing(0.5),
  lineHeight: 1.1,
}));

const Label = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  color: theme.vars.palette.text.primary,
  lineHeight: 1.25,
}));

const Description = styled(Typography)(({ theme }) => ({
  ...theme.typography.caption,
  color: theme.vars.palette.text.secondary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: 'block',
}));

const StyleRow = ({ entry, selected, onToggle }: StyleRowProps) => {
  return (
    <Row
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`${entry.label} — ${entry.shortDescription}`}
      data-selected={selected ? 'true' : 'false'}
      onClick={() => onToggle(entry.slug)}
    >
      <Thumb>
        {/* EC-21 — colored fallback rendered behind the img; img sits on top
           when it loads. When the file is missing, the fallback shows through. */}
        <ThumbFallback aria-hidden>{entry.label}</ThumbFallback>
        <img
          src={entry.thumbnail}
          alt=""
          loading="lazy"
          onError={(e) => {
            // Hide the broken image so the fallback below shows through.
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </Thumb>
      <Box sx={{ minWidth: 0 }}>
        <Label>{entry.label}</Label>
        <Description>{entry.shortDescription}</Description>
      </Box>
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 28,
          height: 28,
          opacity: selected ? 1 : 0,
          transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
        }}
      >
        <CheckCircleRoundedIcon
          sx={{ color: 'secondary.main', fontSize: 22 }}
        />
      </Box>
    </Row>
  );
};

export default StyleRow;
