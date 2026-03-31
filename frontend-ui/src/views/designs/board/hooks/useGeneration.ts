import { useState, useCallback, useEffect } from 'react';
import {
  useGenerateDesignForProjectMutation,
  useGetRunStatusQuery,
  designApi,
} from '../../../../store/designSlice';
import { useAppDispatch } from '../../../../store/hooks';
import type { GenerateDesignBody, DesignGenerationRun } from '../types';

const POLL_INTERVAL = 3000;
const TERMINAL_STATUSES = ['completed', 'failed'];

/**
 * Manages design generation trigger + polling.
 * Uses project-scoped standalone endpoint: POST /api/designs/generate/
 */
export const useGeneration = (projectId: string, ideaId?: string) => {
  const dispatch = useAppDispatch();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [generateDesign, { isLoading: isTriggering }] =
    useGenerateDesignForProjectMutation();

  const { data: runStatus } = useGetRunStatusQuery(activeRunId ?? '', {
    skip: !activeRunId,
    pollingInterval: POLL_INTERVAL,
  });

  const isTerminal = runStatus
    ? TERMINAL_STATUSES.includes(runStatus.status)
    : false;

  // When terminal, invalidate project board to refresh designs
  useEffect(() => {
    if (isTerminal && activeRunId) {
      setActiveRunId(null); // eslint-disable-line react-hooks/set-state-in-effect -- syncs with RTK Query
      dispatch(
        designApi.util.invalidateTags([
          { type: 'DesignProject', id: projectId },
        ]),
      );
    }
  }, [isTerminal, activeRunId, dispatch, projectId]);

  const trigger = useCallback(
    async (body: Omit<GenerateDesignBody, 'project_id' | 'idea_id'>) => {
      const result = await generateDesign({
        ...body,
        project_id: projectId,
        idea_id: ideaId,
      }).unwrap();
      setActiveRunId(result.id);
      return result;
    },
    [generateDesign, projectId, ideaId],
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
