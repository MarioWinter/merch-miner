// PROJ-34 Phase 8 — slogan picker.
// Top: Autocomplete<ProjectIdea> multi-select chips (red — primary color).
// Bottom: multi-line TextField for ad-hoc slogans (one per line).
// Empty-state: when the project pool is empty, hide the autocomplete and
// only show the free-text field with a helper.

import { Autocomplete, Chip, Stack, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { ProjectIdea } from '@/views/designs/gallery/types';

interface SloganPickerProps {
  pool: ProjectIdea[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  freeText: string;
  onFreeTextChange: (value: string) => void;
}

const SectionTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.overline,
  color: theme.vars.palette.text.secondary,
  textTransform: 'uppercase',
}));

const Helper = styled(Typography)(({ theme }) => ({
  ...theme.typography.caption,
  color: theme.vars.palette.text.secondary,
}));

const SloganPicker = ({
  pool,
  selectedIds,
  onSelectedIdsChange,
  freeText,
  onFreeTextChange,
}: SloganPickerProps) => {
  const selectedObjects = pool.filter((i) => selectedIds.includes(i.id));
  const hasPool = pool.length > 0;

  return (
    <Stack spacing={1.5}>
      <SectionTitle>Slogans</SectionTitle>

      {hasPool && (
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={pool}
          value={selectedObjects}
          onChange={(_, next) => onSelectedIdsChange(next.map((n) => n.id))}
          getOptionLabel={(option) => option.slogan_text}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          renderTags={(values, getTagProps) =>
            values.map((option, index) => {
              const props = getTagProps({ index });
              return (
                <Chip
                  {...props}
                  key={option.id}
                  size="small"
                  color="primary"
                  label={option.slogan_text}
                />
              );
            })
          }
          renderOption={(props, option) => {
            const { key, ...optionProps } = props as typeof props & { key: string };
            return (
              <li key={key} {...optionProps}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  width="100%"
                  gap={1}
                >
                  <Typography variant="body2" component="span">
                    {option.slogan_text}
                  </Typography>
                  {option.niche_name && (
                    <Chip
                      label={option.niche_name}
                      size="small"
                      variant="outlined"
                      sx={{ flexShrink: 0 }}
                    />
                  )}
                </Stack>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder="Pick slogans from this project's pool…"
            />
          )}
        />
      )}

      <TextField
        multiline
        minRows={3}
        maxRows={8}
        size="small"
        fullWidth
        value={freeText}
        onChange={(e) => onFreeTextChange(e.target.value)}
        placeholder={
          hasPool
            ? 'Or add custom slogans (one per line)'
            : 'Add custom slogans (one per line)'
        }
      />

      {!hasPool && (
        <Helper>
          This project has no slogans in its pool — add some from the Slogan view,
          or type custom slogans above.
        </Helper>
      )}
    </Stack>
  );
};

export default SloganPicker;
