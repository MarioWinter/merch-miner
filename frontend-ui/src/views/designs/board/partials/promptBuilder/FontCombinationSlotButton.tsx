// PROJ-34 Phase 13n-b — Font Combination slot affordance (card-style button).
// Mirrors TypographySlotButton: empty placeholder · built-in (thumbnail +
// label) · raw custom text. No style-default chip — the resolver has no
// style-level auto-default for `font_combination`. Optional ↺ reset
// affordance shown when value is non-empty (rendered outside the
// CardActionArea to avoid nested-button markup).

import {
  Box,
  Card,
  CardActionArea,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import FontDownloadRoundedIcon from '@mui/icons-material/FontDownloadRounded';
import {
  FONT_COMBINATION_OPTIONS,
  type FontCombinationOption,
} from '../../constants/slotOptions';

interface FontCombinationSlotButtonProps {
  /** Current value — the chosen entry's `prompt_text`, or raw free-text. */
  value: string;
  onOpenPicker: () => void;
  /** Optional reset action — clears the slot to empty. */
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

const findBuiltIn = (value: string): FontCombinationOption | undefined =>
  FONT_COMBINATION_OPTIONS.find((entry) => entry.prompt_text === value);

interface VariantContent {
  thumb: React.ReactNode;
  title: string;
  subtitle: string;
}

const buildBuiltInContent = (entry: FontCombinationOption): VariantContent => ({
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

const buildRawTextContent = (text: string): VariantContent => ({
  thumb: <EditNoteRoundedIcon sx={{ fontSize: 32 }} />,
  title: 'Custom combination',
  subtitle: truncate(text, DESC_MAX_CHARS),
});

const EMPTY_CONTENT: VariantContent = {
  thumb: <FontDownloadRoundedIcon sx={{ fontSize: 32 }} />,
  title: 'Choose font combination',
  subtitle: `Open the picker to browse ${FONT_COMBINATION_OPTIONS.length} multi-font hierarchies`,
};

const resolveContent = (value: string): VariantContent => {
  if (!value || value.trim() === '') return EMPTY_CONTENT;
  const builtIn = findBuiltIn(value);
  if (builtIn) return buildBuiltInContent(builtIn);
  return buildRawTextContent(value);
};

const FontCombinationSlotButton = ({
  value,
  onOpenPicker,
  onReset,
}: FontCombinationSlotButtonProps) => {
  const content = resolveContent(value);
  const canReset = onReset !== undefined && value !== '';

  return (
    <StyledCard data-testid="font-combination-slot-button">
      <CardActionArea
        onClick={onOpenPicker}
        aria-label={`Font combination: ${content.title}. Open picker.`}
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
      {canReset && (
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
            aria-label="Reset font combination"
          >
            ↺ Clear font combination
          </Typography>
        </Box>
      )}
    </StyledCard>
  );
};

export default FontCombinationSlotButton;
