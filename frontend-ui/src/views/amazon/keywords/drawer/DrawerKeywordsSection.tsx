import { useState, useCallback } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { BulkFlowButton } from '@/components/FlowButton';
import {
  useListNicheKeywordsQuery,
  useListKeywordGroupsQuery,
  useDeleteKeywordMutation,
  useCreateKeywordGroupMutation,
  useUpdateKeywordGroupMutation,
  useDeleteKeywordGroupMutation,
} from '@/store/keywordSlice';
import { KeywordGroupList } from './partials/KeywordGroupList';
import { ManualKeywordInput } from './partials/ManualKeywordInput';

const Section = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2),
}));

interface DrawerKeywordsSectionProps {
  nicheId: string;
}

export const DrawerKeywordsSection = ({ nicheId }: DrawerKeywordsSectionProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // Data
  const { data: keywordsData, isLoading: keywordsLoading } = useListNicheKeywordsQuery(
    { nicheId, page_size: 500 },
    { skip: !nicheId },
  );
  const { data: groups = [], isLoading: groupsLoading } = useListKeywordGroupsQuery(
    nicheId,
    { skip: !nicheId },
  );

  // Mutations
  const [deleteKeyword] = useDeleteKeywordMutation();
  const [createGroup, { isLoading: isCreatingGroup }] = useCreateKeywordGroupMutation();
  const [updateGroup] = useUpdateKeywordGroupMutation();
  const [deleteGroup] = useDeleteKeywordGroupMutation();

  // New group input
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const keywords = keywordsData?.results ?? [];
  const isLoading = keywordsLoading || groupsLoading;

  const handleDeleteKeyword = useCallback(
    async (keywordId: string) => {
      try {
        await deleteKeyword({ nicheId, keywordId }).unwrap();
      } catch {
        enqueueSnackbar(t('keywords.errors.deleteFailed'), { variant: 'error' });
      }
    },
    [nicheId, deleteKeyword, enqueueSnackbar, t],
  );

  const handleRenameGroup = useCallback(
    async (groupId: string, name: string) => {
      try {
        await updateGroup({ nicheId, groupId, body: { name } }).unwrap();
      } catch {
        enqueueSnackbar(t('keywords.errors.renameFailed'), { variant: 'error' });
      }
    },
    [nicheId, updateGroup, enqueueSnackbar, t],
  );

  const handleDeleteGroup = useCallback(
    async (groupId: string) => {
      try {
        await deleteGroup({ nicheId, groupId }).unwrap();
        enqueueSnackbar(t('keywords.drawer.groupDeleted'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('keywords.errors.deleteGroupFailed'), { variant: 'error' });
      }
    },
    [nicheId, deleteGroup, enqueueSnackbar, t],
  );

  const handleCreateGroup = useCallback(async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    try {
      await createGroup({ nicheId, body: { name: trimmed } }).unwrap();
      setNewGroupName('');
      setShowGroupInput(false);
    } catch {
      enqueueSnackbar(t('keywords.errors.createGroupFailed'), { variant: 'error' });
    }
  }, [nicheId, newGroupName, createGroup, enqueueSnackbar, t]);

  return (
    <Section>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <VpnKeyIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle2" fontWeight={600}>
            {t('keywords.drawer.sectionTitle')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ({keywords.length})
          </Typography>
        </Stack>

        <Button
          size="small"
          startIcon={<AddIcon sx={{ fontSize: 14 }} />}
          onClick={() => setShowGroupInput(true)}
          disabled={isCreatingGroup}
        >
          {t('keywords.drawer.addGroup')}
        </Button>
      </Stack>

      {/* New group input */}
      {showGroupInput && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            size="small"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
            placeholder={t('keywords.drawer.groupNamePlaceholder')}
            autoFocus
            fullWidth
          />
          <Button size="small" variant="contained" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
            {t('keywords.drawer.addButton')}
          </Button>
          <Button size="small" onClick={() => { setShowGroupInput(false); setNewGroupName(''); }}>
            {t('niches.drawer.cancel')}
          </Button>
        </Stack>
      )}

      {/* Keyword groups and ungrouped */}
      <KeywordGroupList
        groups={groups}
        keywords={keywords}
        isLoading={isLoading}
        onDeleteKeyword={handleDeleteKeyword}
        onRenameGroup={handleRenameGroup}
        onDeleteGroup={handleDeleteGroup}
      />

      {/* Manual add input */}
      <Box sx={{ mt: 2 }}>
        <ManualKeywordInput nicheId={nicheId} />
      </Box>

      {/* Navigate to full keyword page */}
      {keywords.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <BulkFlowButton
            target="keywords"
            label={t('keywords.drawer.viewAll')}
            count={keywords.length}
            onClick={() => navigate(`/amazon/keywords?niche=${nicheId}`)}
          />
        </Box>
      )}
    </Section>
  );
};
