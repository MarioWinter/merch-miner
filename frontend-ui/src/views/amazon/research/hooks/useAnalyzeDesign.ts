import { useCallback, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useAnalyzeProductImageMutation } from '../../../../store/designSlice';

const POLL_INTERVAL = 3000;
const MAX_ATTEMPTS = 20; // ~60s max

interface UseAnalyzeDesignReturn {
  analyzeDesign: (productId: string, imageUrl: string) => void;
  isAnalyzing: boolean;
  /** Product ID currently being analyzed */
  analyzingProductId: string | null;
}

/**
 * Hook to trigger design analysis on an AmazonProduct image.
 * Calls POST /api/products/{id}/analyze-image/, then polls
 * by re-calling until prompt_analysis is populated (status=reused).
 */
const useAnalyzeDesign = (): UseAnalyzeDesignReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [analyzeProduct] = useAnalyzeProductImageMutation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingProductId, setAnalyzingProductId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    attemptsRef.current = 0;
  }, []);

  const analyzeDesign = useCallback(
    (productId: string, imageUrl: string) => {
      if (isAnalyzing) return;

      setIsAnalyzing(true);
      setAnalyzingProductId(productId);

      analyzeProduct({ productId, sourceImageUrl: imageUrl })
        .unwrap()
        .then((result) => {
          if (result.status === 'reused') {
            enqueueSnackbar(t('design.analyze.success'), { variant: 'success' });
            setIsAnalyzing(false);
            setAnalyzingProductId(null);
            return;
          }

          // status === 'pending' — start polling
          enqueueSnackbar(t('design.analyze.started'), { variant: 'info' });
          attemptsRef.current = 0;

          timerRef.current = setInterval(() => {
            attemptsRef.current += 1;

            if (attemptsRef.current >= MAX_ATTEMPTS) {
              clearTimer();
              setIsAnalyzing(false);
              setAnalyzingProductId(null);
              enqueueSnackbar(t('design.analyze.error'), { variant: 'error' });
              return;
            }

            analyzeProduct({ productId, sourceImageUrl: imageUrl })
              .unwrap()
              .then((pollResult) => {
                if (pollResult.status === 'reused') {
                  clearTimer();
                  setIsAnalyzing(false);
                  setAnalyzingProductId(null);
                  enqueueSnackbar(t('design.analyze.success'), {
                    variant: 'success',
                  });
                }
              })
              .catch(() => {
                clearTimer();
                setIsAnalyzing(false);
                setAnalyzingProductId(null);
                enqueueSnackbar(t('design.analyze.error'), { variant: 'error' });
              });
          }, POLL_INTERVAL);
        })
        .catch(() => {
          setIsAnalyzing(false);
          setAnalyzingProductId(null);
          enqueueSnackbar(t('design.analyze.error'), { variant: 'error' });
        });
    },
    [isAnalyzing, analyzeProduct, enqueueSnackbar, t, clearTimer],
  );

  return { analyzeDesign, isAnalyzing, analyzingProductId };
};

export default useAnalyzeDesign;
