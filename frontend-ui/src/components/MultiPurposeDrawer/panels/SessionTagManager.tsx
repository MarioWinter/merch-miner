import { Chip, Stack, Typography } from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListTagsQuery, useUpdateSessionMutation } from '@/store/searchSlice';
import type { ChatTag } from '@/types/search';

interface SessionTagManagerProps {
  sessionId: string;
  currentTags: ChatTag[];
  readOnly?: boolean;
}

const SessionTagManager = ({ sessionId, currentTags, readOnly }: SessionTagManagerProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data: allTags } = useListTagsQuery();
  const [updateSession] = useUpdateSessionMutation();

  const currentTagIds = currentTags.map((tag) => tag.id);
  const availableTags = (allTags ?? []).filter((tag) => !currentTagIds.includes(tag.id));

  const handleAdd = async (tagId: string) => {
    try {
      await updateSession({
        id: sessionId,
        body: { tag_ids: [...currentTagIds, tagId] },
      }).unwrap();
    } catch {
      enqueueSnackbar(t('search.tags.updateError'), { variant: 'error' });
    }
  };

  const handleRemove = async (tagId: string) => {
    try {
      await updateSession({
        id: sessionId,
        body: { tag_ids: currentTagIds.filter((id) => id !== tagId) },
      }).unwrap();
    } catch {
      enqueueSnackbar(t('search.tags.updateError'), { variant: 'error' });
    }
  };

  return (
    <Stack gap={0.5}>
      <Typography variant="caption" color="text.secondary" fontWeight={500}>
        {t('search.tags.label')}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5}>
        {currentTags.map((tag) => (
          <Chip
            key={tag.id}
            label={tag.name}
            size="small"
            onDelete={readOnly ? undefined : () => handleRemove(tag.id)}
            sx={{ bgcolor: tag.color, color: '#fff', fontSize: '0.6875rem', height: 22 }}
          />
        ))}
        {!readOnly && availableTags.length > 0 && (
          <>
            {availableTags.slice(0, 3).map((tag) => (
              <Chip
                key={tag.id}
                label={tag.name}
                size="small"
                variant="outlined"
                icon={<AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
                onClick={() => handleAdd(tag.id)}
                sx={{ fontSize: '0.6875rem', height: 22, borderStyle: 'dashed' }}
              />
            ))}
          </>
        )}
      </Stack>
    </Stack>
  );
};

export default SessionTagManager;
