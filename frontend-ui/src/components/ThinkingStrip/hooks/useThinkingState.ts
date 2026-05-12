/**
 * PROJ-29 Phase 1H — selectors + memoized derivations for ThinkingStrip.
 *
 * Reads `chatBarSlice.streamingStages`, `.chunksUsed`, `.streamStartedAt`, and
 * the assistant stream's `isStreaming` flag. Returns derived state for the
 * three strip variants (active / collapsed / expanded).
 *
 * Uses defensive selectors (`s.chatBar?.streamingStages ?? []`) so component
 * tests can mount without registering the full chatBar shape.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import type { ChunkUsed, ThinkingStep } from '../types/thinking';

interface ThinkingState {
  steps: ThinkingStep[];
  chunksUsed: ChunkUsed[];
  currentLoadingStage: string | null;
  /** Live elapsed ms while streaming; sum of step durations once done. */
  totalDurationMs: number;
  /** Once streaming has ended AND at least one step exists. */
  isDone: boolean;
  isStreaming: boolean;
  stepsCount: number;
  chunksCount: number;
}

export const useThinkingState = (): ThinkingState => {
  const steps = useAppSelector(
    (s) => s.chatBar?.streamingStages ?? [],
  ) as ThinkingStep[];
  const chunksUsed = useAppSelector(
    (s) => s.chatBar?.chunksUsed ?? [],
  ) as ChunkUsed[];
  const streamStartedAt = useAppSelector(
    (s) => s.chatBar?.streamStartedAt ?? null,
  ) as number | null;
  const isStreaming = useAppSelector(
    (s) => s.chatBar?.streamingAssistantMessage?.isStreaming ?? false,
  );

  // Tick once per second while streaming so the elapsed-seconds display ticks
  // forward. The timestamp is captured inside the interval handler (an effect),
  // not during render — calling `Date.now()` in render would be impure.
  // First visible value comes from useState's lazy init; the first 1s after a
  // stream starts the elapsed clamp is 0.0s, then the interval ticks update it.
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isStreaming || streamStartedAt === null) return undefined;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isStreaming, streamStartedAt]);

  const currentLoadingStage = useMemo(() => {
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      if (steps[i].status === 'loading') return steps[i].stage;
    }
    return null;
  }, [steps]);

  const totalDurationMs = useMemo(() => {
    if (isStreaming && streamStartedAt !== null) {
      return Math.max(0, nowMs - streamStartedAt);
    }
    return steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  }, [isStreaming, streamStartedAt, steps, nowMs]);

  const isDone = !isStreaming && steps.length > 0;

  return {
    steps,
    chunksUsed,
    currentLoadingStage,
    totalDurationMs,
    isDone,
    isStreaming,
    stepsCount: steps.length,
    chunksCount: chunksUsed.length,
  };
};
