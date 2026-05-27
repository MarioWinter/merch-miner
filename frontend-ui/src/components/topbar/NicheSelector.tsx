/**
 * Topbar niche chip. Same visual language as WorkspaceSelector; sets the
 * `chatBar.activeNicheId` context. Does NOT open the drawer — drawer is
 * reached via the dedicated chat-bubble IconButton.
 */
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setActiveNicheId } from '../../store/chatBarSlice';
import { useListNichesQuery } from '../../store/nicheSlice';
import TopbarChipSelector, { type ChipOption } from './TopbarChipSelector';

const NicheSelector = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeNicheId = useAppSelector((s) => s.chatBar.activeNicheId);
  const activeWorkspaceId = useAppSelector((s) => s.workspace.activeWorkspaceId);

  // Skip until a workspace is active — backend rejects niches calls otherwise.
  const { data, isFetching } = useListNichesQuery(
    { page: 1, page_size: 100 },
    { skip: !activeWorkspaceId },
  );

  const options: ChipOption[] = (data?.results ?? []).map((n) => ({
    id: n.id,
    label: n.name,
  }));

  return (
    <TopbarChipSelector
      value={activeNicheId}
      placeholder={t('topbar.niche.selector')}
      options={options}
      onChange={(id) => dispatch(setActiveNicheId(id))}
      loading={isFetching && options.length === 0}
      emptyLabel={t('topbar.niche.none')}
      menuId="niche-menu"
      testId="topbar-niche-selector"
    />
  );
};

export default NicheSelector;
