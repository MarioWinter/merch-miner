// PROJ-34 Phase 13f.2 — modal picker for style slugs (Appendix Q.2).
// Single tab "Built-in (15)" — Mario-curated, NO custom tab. Multi-select;
// footer shows live "Use N selected" count. ESC closes without commit.

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
import { STYLE_LIBRARY, type StyleEntry } from '../../constants/styleLibrary';

// ---------------------------------------------------------------------------
// Styled bits — mirror the SpatialPickerModal card grammar for visual parity.
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

interface StylePickerModalProps {
  open: boolean;
  onClose: () => void;
  /** Current committed multi-selection. */
  selectedSlugs: string[];
  /** Fired on the footer commit button with the new list. */
  onChange: (slugs: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const StylePickerModal = ({
  open,
  onClose,
  selectedSlugs,
  onChange,
}: StylePickerModalProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [search, setSearch] = useState('');
  const [localSelected, setLocalSelected] = useState<string[]>(selectedSlugs);

  // Reset transient state on closed→open transition. See SpatialPickerModal
  // for rationale — uses React-19-recommended "previous-prop in state" pattern.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setLocalSelected(selectedSlugs);
      setSearch('');
    }
  }

  const filtered = useMemo<StyleEntry[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return STYLE_LIBRARY;
    return STYLE_LIBRARY.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        entry.shortDescription.toLowerCase().includes(q),
    );
  }, [search]);

  const toggleSlug = (slug: string) => {
    setLocalSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const isDirty = useMemo(() => {
    if (localSelected.length !== selectedSlugs.length) return true;
    const sortedA = [...localSelected].sort();
    const sortedB = [...selectedSlugs].sort();
    return sortedA.some((s, i) => s !== sortedB[i]);
  }, [localSelected, selectedSlugs]);

  const handleCommit = () => {
    onChange(localSelected);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      maxWidth="lg"
      fullWidth
      aria-labelledby="style-picker-title"
    >
      <DialogTitle
        id="style-picker-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        Choose styles
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
            placeholder={`Search ${STYLE_LIBRARY.length} styles…`}
            size="small"
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <SearchRoundedIcon
                    sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }}
                  />
                ),
                inputProps: { 'aria-label': 'Search styles' },
              },
            }}
          />
          <Tabs
            value="builtin"
            sx={{ mt: 1 }}
            aria-label="Style source tabs"
          >
            <Tab value="builtin" label={`Built-in (${STYLE_LIBRARY.length})`} />
          </Tabs>
        </StickyHeader>

        <Box sx={{ p: 3 }}>
          {filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No styles match your search.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {filtered.map((entry) => {
                const selected = localSelected.includes(entry.slug);
                return (
                  <Grid key={entry.slug} size={{ xs: 12, sm: 6, md: 4 }}>
                    <SelectableCard data-selected={selected ? 'true' : 'false'}>
                      <CardActionArea
                        onClick={() => toggleSlug(entry.slug)}
                        aria-label={`Toggle ${entry.label}`}
                        aria-pressed={selected}
                      >
                        <ThumbWrapper>
                          <img
                            src={`/style-thumbnails/${entry.slug}.png`}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display =
                                'none';
                            }}
                          />
                          {selected && <CheckOverlay aria-hidden />}
                        </ThumbWrapper>
                        <Stack spacing={0.25} sx={{ p: 1.25 }}>
                          <Typography variant="subtitle2" noWrap>
                            {entry.label}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                          >
                            {entry.shortDescription}
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
        <Button variant="contained" disabled={!isDirty} onClick={handleCommit}>
          Use {localSelected.length} selected
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StylePickerModal;
