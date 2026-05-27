import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchWorkspaces, setActiveWorkspace } from '../../store/workspaceSlice';
import { publishApi } from '../../store/publishSlice';
import TopbarChipSelector, { type ChipOption } from './TopbarChipSelector';

const WorkspaceSelector = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { workspaces, activeWorkspaceId, loading } = useAppSelector(
    (state) => state.workspace,
  );

  useEffect(() => {
    if (workspaces.length === 0 && !loading) {
      dispatch(fetchWorkspaces());
    }
  }, [dispatch, workspaces.length, loading]);

  const handleSelect = (id: string) => {
    if (id !== activeWorkspaceId) {
      // Clear every RTK Query cache entry on workspace change — backend
      // already scopes via X-Workspace-Id, the cache just mirrors whichever
      // was most recently requested.
      dispatch(publishApi.util.resetApiState());
    }
    dispatch(setActiveWorkspace(id));
  };

  const options: ChipOption[] = workspaces.map((w) => ({ id: w.id, label: w.name }));

  return (
    <TopbarChipSelector
      value={activeWorkspaceId}
      placeholder={t('topbar.workspace.selector')}
      options={options}
      onChange={handleSelect}
      loading={loading}
      emptyLabel={t('topbar.workspace.noWorkspaces')}
      menuId="workspace-menu"
      testId="topbar-workspace-selector"
    />
  );
};

export default WorkspaceSelector;
