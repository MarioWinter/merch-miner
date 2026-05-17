// PROJ-34 Phase 8 — vertical-list style picker (15 flat rows, no nested modal).
// Renders the selected-chip row above the scrollable list of StyleRows.

import { Box, Chip, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { STYLE_LIBRARY } from '../../constants/styleLibrary';
import StyleRow from './StyleRow';

interface StylePickerProps {
  selectedSlugs: string[];
  onToggle: (slug: string) => void;
  onClear?: () => void;
}

const SectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.overline,
  color: theme.vars.palette.text.secondary,
  textTransform: 'uppercase',
}));

const Scroller = styled(Box)(({ theme }) => ({
  maxHeight: 320,
  overflowY: 'auto',
  borderRadius: 8,
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: theme.vars.palette.background.default,
  // Slim scrollbar on WebKit so it doesn't shove the rows around.
  '&::-webkit-scrollbar': { width: 8 },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.vars.palette.action.disabledBackground,
    borderRadius: 4,
  },
}));

const StylePicker = ({ selectedSlugs, onToggle, onClear }: StylePickerProps) => {
  const selectedEntries = STYLE_LIBRARY.filter((s) => selectedSlugs.includes(s.slug));

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <SectionTitle>Styles</SectionTitle>
        {selectedEntries.length > 0 && onClear && (
          <Typography
            variant="caption"
            component="button"
            onClick={onClear}
            sx={{
              all: 'unset',
              cursor: 'pointer',
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' },
            }}
          >
            Clear all
          </Typography>
        )}
      </Stack>

      {selectedEntries.length > 0 && (
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={0.75}
          sx={{ minHeight: 32 }}
          aria-label="Selected styles"
        >
          {selectedEntries.map((entry) => (
            <Chip
              key={entry.slug}
              label={entry.label}
              size="small"
              color="secondary"
              variant="filled"
              onDelete={() => onToggle(entry.slug)}
            />
          ))}
        </Stack>
      )}

      <Scroller role="group" aria-label="Style library">
        {STYLE_LIBRARY.map((entry) => (
          <StyleRow
            key={entry.slug}
            entry={entry}
            selected={selectedSlugs.includes(entry.slug)}
            onToggle={onToggle}
          />
        ))}
      </Scroller>
    </Stack>
  );
};

export default StylePicker;
