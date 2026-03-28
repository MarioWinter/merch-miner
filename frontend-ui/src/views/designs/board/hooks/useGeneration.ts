import { useState, useCallback, useEffect } from 'react';
import {
  useGenerateDesignMutation,
  useGetRunStatusQuery,
  designApi,
} from '../../../../store/designSlice';
import { useAppDispatch } from '../../../../store/hooks';
import type { GenerateDesignBody, DesignGenerationRun } from '../types';

const POLL_INTERVAL = 3000;
const TERMINAL_STATUSES = ['completed', 'failed'];

/**
 * Manages design generation trigger + polling.
 * Uses state for active run ID so React can track changes during render.
 */
export const useGeneration = (ideaId: string) => {
  const dispatch = useAppDispatch();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [generateDesign, { isLoading: isTriggering }] =
    useGenerateDesignMutation();

  const { data: runStatus } = useGetRunStatusQuery(activeRunId ?? '', {
    skip: !activeRunId,
    pollingInterval: POLL_INTERVAL,
  });

  const isTerminal = runStatus
    ? TERMINAL_STATUSES.includes(runStatus.status)
    : false;

  // When terminal, invalidate board to refresh designs
  useEffect(() => {
    if (isTerminal && activeRunId) {
      setActiveRunId(null); // eslint-disable-line react-hooks/set-state-in-effect -- syncs with RTK Query
      dispatch(
        designApi.util.invalidateTags([{ type: 'DesignBoard', id: ideaId }]),
      );
    }
  }, [isTerminal, activeRunId, dispatch, ideaId]);

  const trigger = useCallback(
    async (body: GenerateDesignBody) => {
      const result = await generateDesign({ ideaId, body }).unwrap();
      setActiveRunId(result.id);
      return result;
    },
    [generateDesign, ideaId],
  );

  const isGenerating = isTriggering || (!!activeRunId && !isTerminal);
  const currentRun: DesignGenerationRun | null = runStatus ?? null;

  return {
    trigger,
    isGenerating,
    isTriggering,
    currentRun,
    activeRunId,
  };
};
