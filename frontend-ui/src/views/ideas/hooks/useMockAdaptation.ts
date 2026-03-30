import { useCallback, useEffect, useRef, useState } from 'react';
import type { IdeaAdaptationRun, NicheAdaptationResult } from '../types';

/**
 * DEV-ONLY: Simulates a running LangGraph slogan adaptation workflow.
 * Cycles through all 5 nodes with realistic niche_results progression.
 * Remove before production deployment.
 */

const NODES = [
  'analyze_original',
  'discover_niches',
  'validate_products',
  'adapt_slogans',
  'quality_check',
] as const;

const MOCK_NICHES: Record<string, NicheAdaptationResult> = {
  'niche-001': { niche_name: 'Dog Lovers', status: 'pending' },
  'niche-002': { niche_name: 'Cat Mom Life', status: 'pending' },
  'niche-003': { niche_name: 'Gym Motivation', status: 'pending' },
  'niche-004': { niche_name: 'Nurse Humor', status: 'pending' },
  'niche-005': { niche_name: 'Dad Jokes & BBQ', status: 'pending' },
};

const NODE_DELAY_MS = 3000;

const buildNicheResults = (
  nodeIndex: number,
): Record<string, NicheAdaptationResult> => {
  const results: Record<string, NicheAdaptationResult> = {};
  const entries = Object.entries(MOCK_NICHES);

  for (const [id, base] of entries) {
    if (nodeIndex < 1) {
      // analyze_original — niches still pending
      results[id] = { ...base, status: 'pending' };
    } else if (nodeIndex === 1) {
      // discover_niches — evaluating compatibility
      results[id] = { ...base, status: 'running' };
    } else if (nodeIndex === 2) {
      // validate_products — some approved, one rejected
      if (id === 'niche-004') {
        results[id] = {
          ...base,
          status: 'rejected',
          compatibility_score: 38,
          rejection_reason: 'Low emotional pattern overlap',
        };
      } else {
        results[id] = {
          ...base,
          status: 'approved',
          compatibility_score:
            id === 'niche-001'
              ? 92
              : id === 'niche-002'
                ? 87
                : id === 'niche-003'
                  ? 78
                  : 81,
        };
      }
    } else if (nodeIndex === 3) {
      // adapt_slogans — approved niches running, rejected stays
      if (id === 'niche-004') {
        results[id] = {
          ...base,
          status: 'rejected',
          compatibility_score: 38,
          rejection_reason: 'Low emotional pattern overlap',
        };
      } else {
        results[id] = {
          ...base,
          status: 'running',
          compatibility_score:
            id === 'niche-001'
              ? 92
              : id === 'niche-002'
                ? 87
                : id === 'niche-003'
                  ? 78
                  : 81,
        };
      }
    } else {
      // quality_check done — show final results
      if (id === 'niche-004') {
        results[id] = {
          ...base,
          status: 'rejected',
          compatibility_score: 38,
          rejection_reason: 'Low emotional pattern overlap',
        };
      } else {
        results[id] = {
          ...base,
          status: 'approved',
          compatibility_score:
            id === 'niche-001'
              ? 92
              : id === 'niche-002'
                ? 87
                : id === 'niche-003'
                  ? 78
                  : 81,
          ideas_created: id === 'niche-001' ? 10 : id === 'niche-002' ? 10 : id === 'niche-003' ? 8 : 10,
        };
      }
    }
  }
  return results;
};

export const useMockAdaptation = () => {
  const [active, setActive] = useState(false);
  const [nodeIndex, setNodeIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setNodeIndex(0);
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    setNodeIndex(-1);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Advance through nodes
  useEffect(() => {
    if (!active) return;
    timerRef.current = setInterval(() => {
      setNodeIndex((prev) => {
        if (prev >= NODES.length) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return prev;
        }
        return prev + 1;
      });
    }, NODE_DELAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active]);

  const isCompleted = nodeIndex >= NODES.length;
  const isRunning = active && !isCompleted;

  const run: IdeaAdaptationRun | undefined = active
    ? {
        id: 'mock-run-001',
        workspace: 'mock-ws',
        source_idea: 'mock-idea-001',
        source_idea_text: 'Life Is Better With A Dog By Your Side',
        target_niche_ids: Object.keys(MOCK_NICHES),
        niche_results: buildNicheResults(nodeIndex),
        status: isCompleted ? 'completed' : nodeIndex < 0 ? 'pending' : 'running',
        triggered_by: 1,
        completed_nodes: NODES.slice(0, Math.max(0, nodeIndex)),
        current_node: isCompleted ? '' : (NODES[nodeIndex] ?? ''),
        created_at: new Date().toISOString(),
        completed_at: isCompleted ? new Date().toISOString() : null,
        error_message: '',
      }
    : undefined;

  return { run, isRunning, start, stop, active };
};
