import { useState, useCallback } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useRemoveReferenceFromProjectMutation,
  useAnalyzeProductImageMutation,
} from '@/store/designSlice';
import type { ProjectReference } from '@/views/designs/gallery/types';
import ReferenceCard from './ReferenceCard';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SectionRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
}));

const ScrollContainer = styled(Stack)({
  maxHeight: 480,
  overflowY: 'auto',
});

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ReferencesSectionProps {
  projectId: string;
  references: ProjectReference[];
  onUseAsReference: (imageUrl: string) => void;
  onAnalyze?: (reference: ProjectReference) => void;
  onUseAsPrompt: (analysisText: string) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ReferencesSection = ({
  projectId,
  references,
  onUseAsReference,
  onUseAsPrompt,
}: ReferencesSectionProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const [removeReference] = useRemoveReferenceFromProjectMutation();
  const [analyzeImage] = useAnalyzeProductImageMutation();

  const handleRemove = useCallback(
    async (referenceId: string) => {
      try {
        await removeReference({ projectId, referenceId }).unwrap();
      } catch {
        enqueueSnackbar(
          t('design.references.removeError', 'Failed to remove reference'),
          { variant: 'error' },
        );
      }
    },
    [removeReference, projectId, enqueueSnackbar, t],
  );

  const handleAnalyze = useCallback(
    async (reference: ProjectReference) => {
      setAnalyzingId(reference.id);
      try {
        await analyzeImage({
          productId: reference.source_product ?? reference.id,
          sourceImageUrl: reference.image_url,
          projectId,
        }).unwrap();
        enqueueSnackbar(
          t('design.references.analyzeSuccess', 'Analysis complete'),
          { variant: 'success' },
        );
      } catch {
        enqueueSnackbar(
          t('design.references.analyzeError', 'Analysis failed'),
          { variant: 'error' },
        );
      } finally {
        setAnalyzingId(null);
      }
    },
    [analyzeImage, projectId, enqueueSnackbar, t],
  );

  // Empty state
  if (references.length === 0) {
    return (
      <SectionRoot>
        <Typography variant="caption" color="text.disabled">
          {t(
            'design.references.empty',
            'Add references from Niche Pipeline',
          )}
        </Typography>
      </SectionRoot>
    );
  }

  return (
    <SectionRoot>
      <ScrollContainer spacing={1}>
        {references.map((ref) => (
          <ReferenceCard
            key={ref.id}
            reference={ref}
            onUseAsReference={onUseAsReference}
            onAnalyze={handleAnalyze}
            onUseAsPrompt={onUseAsPrompt}
            onRemove={handleRemove}
            isAnalyzing={analyzingId === ref.id}
          />
        ))}
      </ScrollContainer>
    </SectionRoot>
  );
};

export default ReferencesSection;
