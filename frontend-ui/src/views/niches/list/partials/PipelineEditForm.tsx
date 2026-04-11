import {
  Autocomplete,
  Box,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Controller, type UseFormReturn, type SubmitHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../../store';
import type { UpdateNicheFormValues } from '../schemas/nicheSchema';
import type { Niche, NicheStatus, PotentialRating } from '../types';
import { PipelineSkeleton } from './PipelineSkeleton';

interface PipelineEditFormProps {
  form: UseFormReturn<UpdateNicheFormValues>;
  onSubmit: SubmitHandler<UpdateNicheFormValues>;
  niche: Niche | undefined;
  isFetching: boolean;
}

const NICHE_STATUSES: NicheStatus[] = [
  'data_entry', 'deep_research', 'niche_with_potential',
  'to_designer', 'upload', 'start_ads',
  'pending', 'winner', 'loser',
];

const POTENTIAL_RATINGS: (PotentialRating | '')[] = ['', 'good', 'very_good', 'rejected'];

export const PipelineEditForm = ({ form, onSubmit, niche, isFetching }: PipelineEditFormProps) => {
  const { t } = useTranslation();
  const activeWorkspaceId = useSelector((s: RootState) => s.workspace.activeWorkspaceId);
  const workspaces = useSelector((s: RootState) => s.workspace.workspaces);
  const members = workspaces.find((w) => w.id === activeWorkspaceId)?.members ?? [];

  return (
    <Stack component="form" id="niche-edit-form" onSubmit={form.handleSubmit(onSubmit)} gap={2.5}>
      {!niche && isFetching && <PipelineSkeleton />}
      {niche && (
        <>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('niches.drawer.name')}
                error={!!fieldState.error}
                helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                required
                fullWidth
                size="small"
              />
            )}
          />
          <Controller
            name="notes"
            control={form.control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('niches.drawer.notes')}
                error={!!fieldState.error}
                helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                multiline
                rows={3}
                fullWidth
                size="small"
              />
            )}
          />
          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75, color: 'text.secondary' }}>
                  {t('niches.drawer.status')}
                </Typography>
                <Select
                  {...field}
                  onChange={(e) => {
                    const newStatus = e.target.value as NicheStatus;
                    field.onChange(newStatus);
                    if (
                      newStatus === 'niche_with_potential' &&
                      form.getValues('potential_rating') !== 'good' &&
                      form.getValues('potential_rating') !== 'very_good'
                    ) {
                      form.setValue('potential_rating', 'good', { shouldDirty: true });
                    }
                  }}
                  fullWidth
                  size="small"
                  displayEmpty
                >
                  {NICHE_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {t(`niches.status.${s}`)}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            )}
          />
          <Controller
            name="potential_rating"
            control={form.control}
            render={({ field }) => (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.75, color: 'text.secondary' }}>
                  {t('niches.drawer.potentialRating')}
                </Typography>
                <Select
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  fullWidth
                  size="small"
                  displayEmpty
                >
                  {POTENTIAL_RATINGS.map((r) => (
                    <MenuItem key={r} value={r}>
                      {r ? t(`niches.potentialRating.${r}`) : t('niches.potentialRating.none')}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            )}
          />
          <Controller
            name="assigned_to"
            control={form.control}
            render={({ field }) => {
              const selectedMember = members.find((m) => m.id === field.value) ?? null;
              return (
                <Autocomplete
                  options={members}
                  getOptionLabel={(m) =>
                    m.first_name || m.last_name
                      ? `${m.first_name} ${m.last_name}`.trim()
                      : m.username
                  }
                  value={selectedMember}
                  onChange={(_, val) => field.onChange(val?.id ?? null)}
                  clearOnEscape
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('niches.drawer.assignee')}
                      size="small"
                    />
                  )}
                />
              );
            }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('niches.drawer.ideasBadge', {
                total: niche.idea_count,
                approved: niche.approved_idea_count,
              })}
            </Typography>
          </Box>
        </>
      )}
    </Stack>
  );
};
