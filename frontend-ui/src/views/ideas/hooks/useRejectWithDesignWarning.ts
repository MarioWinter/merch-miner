import { useCallback, useState } from 'react';
import { designApi } from '@/store/designSlice';
import type { Idea } from '../types';

interface UseRejectWithDesignWarningReturn {
  /** Call instead of direct reject — checks for approved designs first */
  requestReject: (idea: Idea) => void;
  /** Confirm the rejection after warning */
  confirmReject: () => void;
  /** Cancel the warning dialog */
  cancelReject: () => void;
  /** Whether the warning dialog should be open */
  warningOpen: boolean;
  /** The idea pending rejection (for dialog context) */
  pendingIdea: Idea | null;
  /** Whether the design check is in progress */
  isChecking: boolean;
}

export const useRejectWithDesignWarning = (
  onReject: (idea: Idea) => void,
): UseRejectWithDesignWarningReturn => {
  const [pendingIdea, setPendingIdea] = useState<Idea | null>(null);
  const [warningOpen, setWarningOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [triggerListDesigns] = designApi.useLazyListDesignsQuery();

  const requestReject = useCallback(
    (idea: Idea) => {
      // Only check for approved designs if the idea itself is approved
      if (idea.status !== 'approved') {
        onReject(idea);
        return;
      }

      setIsChecking(true);
      triggerListDesigns(idea.id)
        .unwrap()
        .then((response) => {
          const hasApproved = response.results.some((d) => d.status === 'approved');
          if (hasApproved) {
            setPendingIdea(idea);
            setWarningOpen(true);
          } else {
            onReject(idea);
          }
        })
        .catch(() => {
          // On error, proceed without warning to avoid blocking the user
          onReject(idea);
        })
        .finally(() => {
          setIsChecking(false);
        });
    },
    [onReject, triggerListDesigns],
  );

  const confirmReject = useCallback(() => {
    if (pendingIdea) {
      onReject(pendingIdea);
    }
    setPendingIdea(null);
    setWarningOpen(false);
  }, [pendingIdea, onReject]);

  const cancelReject = useCallback(() => {
    setPendingIdea(null);
    setWarningOpen(false);
  }, []);

  return {
    requestReject,
    confirmReject,
    cancelReject,
    warningOpen,
    pendingIdea,
    isChecking,
  };
};
