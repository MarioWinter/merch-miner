// PROJ-34 Phase 13n-b — modal picker for font combinations (single-select).
// Mirrors TypographyPickerModal grammar exactly; no styleDefault/styleLabel —
// the resolver has no style-level auto-default for `font_combination`. ESC
// closes without commit (Dialog default + Cancel button).

import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  FONT_COMBINATION_OPTIONS,
  type FontCombinationOption,
} from '../../constants/slotOptions';

// ---------------------------------------------------------------------------
// Styled bits — mirror the TypographyPickerModal card grammar for parity.
// ---------------------------------------------------------------------------

const StickyHeader = styled(Box)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 1,
  backgroundColor: theme.vars.palette.background.paper,
  paddingBottom: theme.spacing(1),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

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
// Props
// ---------------------------------------------------------------------------

interface FontCombinationPickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Current committed value — the chosen entry's `prompt_text`, or raw text. */
  value: string;
  /** Fired on "Use selection". */
  onChange: (newValue: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const FontCombinationPickerModal = ({
  open,
  onClose,
  value,
  onChange,
}: FontCombinationPickerModalProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [search, setSearch] = useState('');
  const [localValue, setLocalValue] = useState<string>(value);

  // Reset transient state on closed→open transition. See SpatialPickerModal
  // for rationale — React-19 "previous-prop in state" pattern.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLocalValue(value);
      setSearch('');
    }
  }

  const filtered = useMemo<FontCombinationOption[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [...FONT_COMBINATION_OPTIONS];
    return FONT_COMBINATION_OPTIONS.filter((entry) =>
      entry.ui_label.toLowerCase().includes(q),
    );
  }, [search]);

  const isDirty = localValue !== value;

  const handleCommit = () => {
    onChange(localValue);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="lg"
      fullWidth
      aria-labelledby="font-combination-picker-title"
    >
      <DialogTitle
        id="font-combination-picker-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        Choose font combination
        <IconButton
          edge="end"
          onClick={onClose}
          aria-label="Close picker"
          size="small"
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        <StickyHeader sx={{ px: 3, pt: 2 }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${FONT_COMBINATION_OPTIONS.length} font combinations…`}
            size="small"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <SearchRoundedIcon
                    sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }}
                  />
                ),
                inputProps: { 'aria-label': 'Search font combinations' },
              },
            }}
          />
          <Tabs
            value="builtin"
            sx={{ mt: 1 }}
            aria-label="Font combination source tabs"
          >
            <Tab
              value="builtin"
              label={`Built-in (${FONT_COMBINATION_OPTIONS.length})`}
            />
          </Tabs>
        </StickyHeader>

        <Box sx={{ p: 3 }}>
          {filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No font combination matches your search.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {filtered.map((entry) => {
                const selected = localValue === entry.prompt_text;
                return (
                  <Grid key={entry.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <SelectableCard
                      data-selected={selected ? 'true' : 'false'}
                    >
                      <CardActionArea
                        onClick={() => setLocalValue(entry.prompt_text)}
                        aria-label={`Select ${entry.ui_label}`}
                        aria-pressed={selected}
                      >
                        <ThumbWrapper>
                          <img
                            src={`/${entry.thumbnail_path}`}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              (
                                e.currentTarget as HTMLImageElement
                              ).style.display = 'none';
                            }}
                          />
                          {selected && <CheckOverlay aria-hidden />}
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
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!isDirty}
          onClick={handleCommit}
        >
          Use selection
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FontCombinationPickerModal;
