// PROJ-34 Phase 13t-m — sub-renderers extracted from TypographyPickerModal so
// the container file stays under the 250–300 line budget. Mirrors the grammar
// of SpatialPickerModal.grids.tsx for visual parity.

import {
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { useTranslation } from 'react-i18next';
import type { TypographyOption } from '../../constants/slotOptions';
import type { CustomTypography } from '@/services/customTypographyApi';

// ---------------------------------------------------------------------------
// Shared styled bits
// ---------------------------------------------------------------------------

const ThumbWrapper = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  aspectRatio: '1 / 1',
  borderRadius: 8,
  overflow: 'hidden',
  backgroundColor: theme.vars.palette.action.disabledBackground,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
}));

const SelectableCard = styled(Card)<{ 'data-selected': 'true' | 'false' }>(
  ({ theme, ...props }) => ({
    border:
      props['data-selected'] === 'true'
        ? `2px solid ${theme.vars.palette.primary.main}`
        : `2px solid transparent`,
    transition: 'border-color 150ms ease',
  }),
);

const CheckOverlay = styled(CheckCircleRoundedIcon)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  color: theme.vars.palette.primary.main,
  fontSize: 24,
}));

const AutoChip = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  left: theme.spacing(0.5),
  backgroundColor: theme.vars.palette.background.paper,
}));

// ---------------------------------------------------------------------------
// Built-in 22-card grid
// ---------------------------------------------------------------------------

interface BuiltinGridProps {
  entries: readonly TypographyOption[];
  selectedValue: string;
  styleDefault?: string;
  styleLabel?: string;
  onSelect: (promptText: string) => void;
}

export const BuiltinGrid = ({
  entries,
  selectedValue,
  styleDefault,
  styleLabel,
  onSelect,
}: BuiltinGridProps) => {
  const { t } = useTranslation();
  if (entries.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('designForge.builder.typography.emptyBuiltin')}
        </Typography>
      </Box>
    );
  }
  return (
    <Grid container spacing={2}>
      {entries.map((entry) => {
        const selected = selectedValue === entry.prompt_text;
        const isStyleDefault =
          styleDefault !== undefined && entry.prompt_text === styleDefault;
        return (
          <Grid key={entry.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <SelectableCard data-selected={selected ? 'true' : 'false'}>
              <CardActionArea
                onClick={() => onSelect(entry.prompt_text)}
                aria-label={`Select ${entry.ui_label}`}
                aria-pressed={selected}
              >
                <ThumbWrapper>
                  <img
                    src={`/${entry.thumbnail_path}`}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        'none';
                    }}
                  />
                  {selected && <CheckOverlay aria-hidden />}
                  {isStyleDefault && (
                    <AutoChip
                      size="small"
                      color="secondary"
                      variant="outlined"
                      label={
                        styleLabel
                          ? t(
                              'designForge.builder.typography.autoFromStyleLabel',
                              { style: styleLabel },
                            )
                          : t('designForge.builder.typography.autoFromStyle')
                      }
                      data-testid="typography-modal-auto-chip"
                    />
                  )}
                </ThumbWrapper>
                <Stack spacing={0.25} sx={{ p: 1.25 }}>
                  <Typography variant="subtitle2" noWrap>
                    {entry.ui_label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                  >
                    {entry.ui_description}
                  </Typography>
                </Stack>
              </CardActionArea>
            </SelectableCard>
          </Grid>
        );
      })}
    </Grid>
  );
};

// ---------------------------------------------------------------------------
// Custom-typography grid (with empty-state CTA + delete affordance)
// ---------------------------------------------------------------------------

interface CustomGridProps {
  entries: CustomTypography[];
  loading: boolean;
  selectedValue: string;
  onSelect: (promptText: string) => void;
  onCreateNew: () => void;
  onDelete?: (id: string) => void;
}

export const CustomGrid = ({
  entries,
  loading,
  selectedValue,
  onSelect,
  onCreateNew,
  onDelete,
}: CustomGridProps) => {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">
          {t('designForge.builder.typography.loading')}
        </Typography>
      </Box>
    );
  }
  if (entries.length === 0) {
    return (
      <Stack spacing={2} sx={{ py: 6, alignItems: 'center' }}>
        <Typography color="text.secondary">
          {t('designForge.builder.typography.emptyCustom')}
        </Typography>
        <Button variant="outlined" onClick={onCreateNew}>
          {t('designForge.builder.typography.createFirst')}
        </Button>
      </Stack>
    );
  }
  return (
    <Grid container spacing={2}>
      {entries.map((entry) => {
        const selected = selectedValue === entry.prompt_text;
        return (
          <Grid key={entry.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <SelectableCard data-selected={selected ? 'true' : 'false'}>
              <CardActionArea
                onClick={() => onSelect(entry.prompt_text)}
                aria-label={`Select ${entry.name}`}
                aria-pressed={selected}
              >
                <ThumbWrapper>
                  {entry.source_image_ref ? (
                    <img src={entry.source_image_ref} alt="" loading="lazy" />
                  ) : null}
                  {selected && <CheckOverlay aria-hidden />}
                </ThumbWrapper>
                <Stack spacing={0.25} sx={{ p: 1.25 }}>
                  <Typography variant="subtitle2" noWrap>
                    {entry.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                  >
                    {entry.prompt_text}
                  </Typography>
                </Stack>
              </CardActionArea>
              {onDelete && (
                <Box sx={{ px: 1.25, pb: 1, textAlign: 'right' }}>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => onDelete(entry.id)}
                    aria-label={`Delete ${entry.name}`}
                  >
                    {t('designForge.builder.typography.delete')}
                  </Button>
                </Box>
              )}
            </SelectableCard>
          </Grid>
        );
      })}
    </Grid>
  );
};
