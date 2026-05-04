import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export type WorkspaceTab = 'canvas' | 'editor';

const VALID_TABS: WorkspaceTab[] = ['canvas', 'editor'];

const useWorkspaceTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab');
  const activeTab: WorkspaceTab =
    rawTab && VALID_TABS.includes(rawTab as WorkspaceTab)
      ? (rawTab as WorkspaceTab)
      : 'canvas';

  const setActiveTab = useCallback(
    (tab: WorkspaceTab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', tab);
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  return { activeTab, setActiveTab } as const;
};

export default useWorkspaceTab;
