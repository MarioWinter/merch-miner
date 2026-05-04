import { useCallback } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useRemoveIdeaFromProjectMutation } from '@/store/designSlice';
import type { ProjectIdea } from '@/views/designs/gallery/types';
import SloganPoolCard from './SloganPoolCard';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SectionRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface SloganPoolSectionProps {
  projectId: string;
  ideas: ProjectIdea[];
  onInsertSlogan?: (sloganText: string) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const SloganPoolSection = ({
  projectId,
  ideas,
  onInsertSlogan,
}: SloganPoolSectionProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [removeIdea] = useRemoveIdeaFromProjectMutation();

  const handleRemove = useCallback(
    async (ideaId: string) => {
      try {
        await removeIdea({ projectId, ideaId }).unwrap();
      } catch {
        enqueueSnackbar(t('design.sloganPool.removeError', 'Failed to remove'), {
          variant: 'error',
        });
      }
    },
    [removeIdea, projectId, enqueueSnackbar, t],
  );

  const handleInsert = useCallback(
    (sloganText: string) => {
      onInsertSlogan?.(sloganText);
    },
    [onInsertSlogan],
  );

  if (ideas.length === 0) {
    return (
      <SectionRoot>
        <Typography variant="caption" color="text.disabled">
          {t(
            'design.sloganPool.empty',
            'Add slogans from Niche Pipeline or Slogan Factory',
          )}
        </Typography>
      </SectionRoot>
    );
  }

  return (
    <SectionRoot>
      <Stack spacing={1}>
        {ideas.map((idea) => (
          <SloganPoolCard
            key={idea.id}
            idea={idea}
            onInsertSlogan={handleInsert}
            onRemove={() => void handleRemove(idea.id)}
          />
        ))}
      </Stack>
    </SectionRoot>
  );
};

export default SloganPoolSection;
