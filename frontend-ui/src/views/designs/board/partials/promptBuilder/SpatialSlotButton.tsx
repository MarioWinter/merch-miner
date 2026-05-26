// PROJ-34 Phase 13e — Spatial layout slot affordance (NOT a Select).
// Renders the currently-selected spatial as a tappable card and exposes an
// `onOpenPicker` callback that the parent wires to the SpatialPickerModal in
// Phase 13f. Three render variants: built-in (thumbnail + label + desc),
// custom UUID (placeholder + short id), raw-text (custom typed). Empty state
// invites the user to choose a layout.

import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';
import ViewQuiltRoundedIcon from '@mui/icons-material/ViewQuiltRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import {
  getSpatialById,
  isSpatialUuid,
  type SpatialOption,
} from '../../constants/slotOptions';

interface SpatialSlotButtonProps {
  /** Either a built-in spatial id, a CustomSpatial UUID, or raw free-text. */
  value: string | undefined;
  onOpenPicker: () => void;
  /** Optional clear action; consumer renders the icon next to the card. */
  onReset?: () => void;
}

const DESC_MAX_CHARS = 60;

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.default,
  borderColor: theme.vars.palette.divider,
  borderStyle: 'solid',
  borderWidth: 1,
  boxShadow: 'none',
}));

const Thumb = styled('div')(({ theme }) => ({
  width: 64,
  height: 64,
  borderRadius: 8,
  overflow: 'hidden',
  flexShrink: 0,
  backgroundColor: theme.vars.palette.action.disabledBackground,
  display: 'grid',
  placeItems: 'center',
  color: theme.vars.palette.text.secondary,
}));

const ThumbImg = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

interface VariantContent {
  thumb: React.ReactNode;
  title: string;
  subtitle: string;
}

const buildBuiltInContent = (entry: SpatialOption): VariantContent => ({
  thumb: (
    <ThumbImg
      src={`/${entry.thumbnail_path}`}
      alt=""
      loading="lazy"
      onError={(event) => {
        // Hide broken image so the fallback icon underneath shows through.
        (event.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  ),
  title: entry.ui_label,
  subtitle: truncate(entry.ui_description, DESC_MAX_CHARS),
});

const buildCustomUuidContent = (uuid: string): VariantContent => ({
  thumb: <DashboardCustomizeRoundedIcon sx={{ fontSize: 32 }} />,
  title: 'Custom layout',
  subtitle: `id ${uuid.slice(0, 8)}`,
});

const buildRawTextContent = (text: string): VariantContent => ({
  thumb: <EditNoteRoundedIcon sx={{ fontSize: 32 }} />,
  title: 'Custom (typed)',
  subtitle: truncate(text, DESC_MAX_CHARS),
});

const EMPTY_CONTENT: VariantContent = {
  thumb: <ViewQuiltRoundedIcon sx={{ fontSize: 32 }} />,
  title: 'Choose a spatial layout',
  subtitle: 'Open the picker to browse 36 ready-made templates',
};

const resolveContent = (value: string | undefined): VariantContent => {
  if (!value || value.trim() === '') return EMPTY_CONTENT;
  const builtIn = getSpatialById(value);
  if (builtIn) return buildBuiltInContent(builtIn);
  if (isSpatialUuid(value)) return buildCustomUuidContent(value);
  return buildRawTextContent(value);
};

const SpatialSlotButton = ({
  value,
  onOpenPicker,
  onReset,
}: SpatialSlotButtonProps) => {
  const content = resolveContent(value);
  const hasValue = Boolean(value && value.trim() !== '');

  return (
    <StyledCard data-testid="spatial-slot-button">
      <CardActionArea
        onClick={onOpenPicker}
        aria-label={`Spatial layout: ${content.title}. Open picker.`}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ p: 1.5 }}
        >
          <Thumb aria-hidden>{content.thumb}</Thumb>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="subtitle2"
              sx={{ color: 'text.primary', lineHeight: 1.3 }}
            >
              {content.title}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {content.subtitle}
            </Typography>
          </Box>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ color: 'text.secondary', flexShrink: 0 }}
          >
            <Typography variant="caption">Open picker</Typography>
            <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
          </Stack>
        </Stack>
      </CardActionArea>
      {hasValue && onReset && (
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Typography
            component="button"
            variant="caption"
            onClick={onReset}
            sx={{
              all: 'unset',
              cursor: 'pointer',
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
            aria-label="Reset spatial layout"
          >
            ↺ Reset
          </Typography>
        </Box>
      )}
    </StyledCard>
  );
};

export default SpatialSlotButton;
