import { useState, useCallback, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useAnalyzeImageMutation,
  useGetRunStatusQuery,
  designApi,
} from '../../../../store/designSlice';
import { useAppDispatch } from '../../../../store/hooks';

const POLL_INTERVAL = 3000;
const TERMINAL_STATUSES = ['completed', 'failed'];

/**
 * Trigger Gemini 3 Architect analysis on a reference image,
 * poll for completion, and populate the prompt editor.
 * Invalidates project cache on completion.
 */
export const useImageAnalysis = (projectId: string) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [analyzeImage] = useAnalyzeImageMutation();
  const [activeAnalysisRunId, setActiveAnalysisRunId] = useState<string | null>(null);
  const [analyzingProductIds, setAnalyzingProductIds] = useState<string[]>([]);

  const { data: runStatus } = useGetRunStatusQuery(activeAnalysisRunId ?? '', {
    skip: !activeAnalysisRunId,
    pollingInterval: POLL_INTERVAL,
  });

  const isTerminal = runStatus
    ? TERMINAL_STATUSES.includes(runStatus.status)
    : false;

  // Handle terminal analysis state
  useEffect(() => {
    if (!isTerminal || !activeAnalysisRunId) return;

    if (runStatus?.status === 'completed') {
      enqueueSnackbar(t('design.analyze.success'), { variant: 'success' });
      dispatch(
        designApi.util.invalidateTags([{ type: 'DesignProject', id: projectId }]),
      );
    } else if (runStatus?.status === 'failed') {
      enqueueSnackbar(
        runStatus.error_message || t('design.analyze.error'),
        { variant: 'error' },
      );
    }

    // Reset polling state after handling terminal result
    setActiveAnalysisRunId(null); // eslint-disable-line react-hooks/set-state-in-effect -- reacting to external poll result
    setAnalyzingProductIds([]);
  }, [isTerminal, activeAnalysisRunId, runStatus, dispatch, projectId, enqueueSnackbar, t]);

  // Derive last prompt from terminal run status
  const lastPrompt = isTerminal && runStatus?.status === 'completed' && runStatus.prompt_used
    ? runStatus.prompt_used
    : null;

  const triggerAnalysis = useCallback(
    async (designId: string, imageUrl: string, productId: string) => {
      try {
        setAnalyzingProductIds((prev) => [...prev, productId]);
        enqueueSnackbar(t('design.analyze.started'), { variant: 'info' });
        const result = await analyzeImage({
          designId,
          body: { source_image_url: imageUrl },
        }).unwrap();
        setActiveAnalysisRunId(result.id);
      } catch {
        enqueueSnackbar(t('design.analyze.error'), { variant: 'error' });
        setAnalyzingProductIds((prev) => prev.filter((id) => id !== productId));
      }
    },
    [analyzeImage, enqueueSnackbar, t],
  );

  const isAnalyzing = Boolean(activeAnalysisRunId);

  return {
    triggerAnalysis,
    isAnalyzing,
    analyzingProductIds,
    lastPrompt,
  };
};
