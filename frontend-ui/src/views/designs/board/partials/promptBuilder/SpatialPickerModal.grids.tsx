// PROJ-34 Phase 13f.1 — sub-renderers extracted from SpatialPickerModal so the
// container file stays under the 250–300 line budget.

import { Box, Button, Card, CardActionArea, Grid, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { SpatialOption } from '../../constants/slotOptions';
import type { CustomSpatial } from '@/store/designSlice';

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

// ---------------------------------------------------------------------------
// Built-in 36-card grid
// ---------------------------------------------------------------------------

interface BuiltinGridProps {
  entries: readonly SpatialOption[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export const BuiltinGrid = ({
  entries,
  selectedId,
  onSelect,
}: BuiltinGridProps) => {
  if (entries.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No layouts match your search.
        </Typography>
      </Box>
    );
  }
  return (
    <Grid container spacing={2}>
      {entries.map((entry) => (
        <Grid key={entry.id} size={{ xs: 12, sm: 6, md: 4 }}>
          <SelectableCard
            data-selected={selectedId === entry.id ? 'true' : 'false'}
          >
            <CardActionArea
              onClick={() => onSelect(entry.id)}
              aria-label={`Select ${entry.ui_label}`}
              aria-pressed={selectedId === entry.id}
            >
              <ThumbWrapper>
                <img
                  src={`/static/design_app/${entry.thumbnail_path}`}
                  alt=""
                  loading="lazy"
                />
                {selectedId === entry.id && <CheckOverlay aria-hidden />}
              </ThumbWrapper>
              <Stack spacing={0.25} sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" noWrap>
                  {entry.ui_label}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {entry.ui_description}
                </Typography>
              </Stack>
            </CardActionArea>
          </SelectableCard>
        </Grid>
      ))}
    </Grid>
  );
};

// ---------------------------------------------------------------------------
// Custom-spatial grid (with empty-state CTA)
// ---------------------------------------------------------------------------

interface CustomGridProps {
  entries: CustomSpatial[];
  loading: boolean;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export const CustomGrid = ({
  entries,
  loading,
  selectedId,
  onSelect,
  onCreateNew,
}: CustomGridProps) => {
  if (loading) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    );
  }
  if (entries.length === 0) {
    return (
      <Stack spacing={2} sx={{ py: 6, alignItems: 'center' }}>
        <Typography color="text.secondary">
          You haven&apos;t created any custom spatial layouts yet.
        </Typography>
        <Button variant="outlined" onClick={onCreateNew}>
          Create your first
        </Button>
      </Stack>
    );
  }
  return (
    <Grid container spacing={2}>
      {entries.map((entry) => (
        <Grid key={entry.id} size={{ xs: 12, sm: 6, md: 4 }}>
          <SelectableCard
            data-selected={selectedId === entry.id ? 'true' : 'false'}
          >
            <CardActionArea
              onClick={() => onSelect(entry.id)}
              aria-label={`Select ${entry.name}`}
              aria-pressed={selectedId === entry.id}
            >
              <ThumbWrapper>
                {entry.source_image_ref ? (
                  <img src={entry.source_image_ref} alt="" loading="lazy" />
                ) : null}
                {selectedId === entry.id && <CheckOverlay aria-hidden />}
              </ThumbWrapper>
              <Stack spacing={0.25} sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" noWrap>
                  {entry.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {entry.prompt_text}
                </Typography>
              </Stack>
            </CardActionArea>
          </SelectableCard>
        </Grid>
      ))}
    </Grid>
  );
};
