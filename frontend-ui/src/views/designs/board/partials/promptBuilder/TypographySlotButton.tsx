// PROJ-34 Phase 13m-b — Typography slot affordance (card-style button).
// Mirrors SpatialSlotButton: empty placeholder · built-in (thumbnail + label)
// · raw custom text. Renders an "auto from {style}" chip when the current
// value matches the style-resolved default. The ↺ reset affordance is shown
// when the value differs from the style default — parent wires it to
// `resetSlot('typography_adjectives')`.

import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import {
  TYPOGRAPHY_OPTIONS,
  type TypographyOption,
} from '../../constants/slotOptions';

interface TypographySlotButtonProps {
  /** Current value — the chosen entry's `prompt_text`, or raw free-text. */
  value: string;
  onOpenPicker: () => void;
  /** Optional reset action — restores the style-default. */
  onReset?: () => void;
  /** The style-resolved default `prompt_text` (Appendix K). */
  styleDefault?: string;
  /** Display label of the style currently driving the default. */
  styleLabel?: string;
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

const findBuiltIn = (value: string): TypographyOption | undefined =>
  TYPOGRAPHY_OPTIONS.find((entry) => entry.prompt_text === value);

interface VariantContent {
  thumb: React.ReactNode;
  title: string;
  subtitle: string;
}

const buildBuiltInContent = (entry: TypographyOption): VariantContent => ({
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
  title: 'Custom typography',
  subtitle: truncate(text, DESC_MAX_CHARS),
});

const EMPTY_CONTENT: VariantContent = {
  thumb: <TextFieldsRoundedIcon sx={{ fontSize: 32 }} />,
  title: 'Choose typography',
  subtitle: 'Open the picker to browse 22 typography styles',
};

const resolveContent = (value: string): VariantContent => {
  if (!value || value.trim() === '') return EMPTY_CONTENT;
  const builtIn = findBuiltIn(value);
  if (builtIn) return buildBuiltInContent(builtIn);
  return buildRawTextContent(value);
};

const TypographySlotButton = ({
  value,
  onOpenPicker,
  onReset,
  styleDefault,
  styleLabel,
}: TypographySlotButtonProps) => {
  const content = resolveContent(value);
  const matchesDefault =
    styleDefault !== undefined && value !== '' && value === styleDefault;
  const canReset =
    onReset !== undefined &&
    styleDefault !== undefined &&
    value !== styleDefault;

  return (
    <StyledCard data-testid="typography-slot-button">
      <CardActionArea
        onClick={onOpenPicker}
        aria-label={`Typography: ${content.title}. Open picker.`}
      >
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ p: 1.5 }}
        >
          <Thumb aria-hidden>{content.thumb}</Thumb>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="subtitle2"
                sx={{ color: 'text.primary', lineHeight: 1.3 }}
              >
                {content.title}
              </Typography>
              {matchesDefault && (
                <Chip
                  size="small"
                  color="secondary"
                  variant="outlined"
                  label={
                    styleLabel ? `auto from ${styleLabel}` : 'auto from style'
                  }
                  data-testid="typography-slot-auto-chip"
                />
              )}
            </Stack>
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
            aria-label="Reset typography"
          >
            ↺ Reset to style default
          </Typography>
        </Box>
      )}
    </StyledCard>
  );
};

export default TypographySlotButton;
