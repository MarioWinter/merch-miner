import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import FavoriteIcon from '@mui/icons-material/Favorite';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeDrawer, openNicheCreate } from '@/store/chatBarSlice';
import { NichePipelineHeaderSelect } from './partials/NichePipelineHeaderSelect';
import { useNichePipelineSwitch } from '../hooks/useNichePipelineSwitch';
import { useNichePipelineDetail } from '@/views/niches/list/hooks/useNichePipelineDetail';
import { usePipelineStates } from '@/views/niches/list/hooks/usePipelineStates';
import { usePipelineCounts } from '@/views/niches/list/hooks/usePipelineCounts';
import { PipelineCreateForm } from '@/views/niches/list/partials/PipelineCreateForm';
import { PipelineEditForm } from '@/views/niches/list/partials/PipelineEditForm';
import { PipelineConfirmDialogs } from '@/views/niches/list/partials/PipelineConfirmDialogs';
import { PipelineCard } from '@/components/PipelineCard';
import { ResearchCardContent } from '@/views/niches/list/partials/ResearchCardContent';
import { ProductsGrid } from '@/views/niches/list/partials/ProductsGrid';
import { SlogansPipelineContent } from '@/views/niches/list/partials/SlogansPipelineContent';
import { DrawerKeywordsSection } from '@/views/amazon/keywords/drawer/DrawerKeywordsSection';
import { DesignsPipelineContent } from '@/views/niches/list/partials/DesignsPipelineContent';
import { ListingsPipelineContent } from '@/views/niches/list/partials/ListingsPipelineContent';
import { UploadPipelineContent } from '@/views/niches/list/partials/UploadPipelineContent';

const PanelRoot = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
});

const PanelTitleBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: `${theme.spacing(1.5)} ${theme.spacing(3)}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
}));

const PanelBody = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const PanelFooter = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
  gap: theme.spacing(1),
}));

const PipelineSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
}));

/**
 * PROJ-17 AC-35: existing NicheDetailDrawer content wrapped as the Niche tab
 * inside MultiPurposeDrawer. Reads `activeNicheId` + `nicheMode` from Redux,
 * and uses `closeDrawer` (whole MPDrawer) on cancel/save/archive.
 *
 * Note: the outer `<Drawer>` wrapper has been removed — the MultiPurposeDrawer
 * is already the drawer container. This component renders only the inner
 * title/body/footer column.
 */
const NichePipeline = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const selectedId = useAppSelector((s) => s.chatBar.activeNicheId);
  const mode = useAppSelector((s) => s.chatBar.nicheMode);

  const handleClose = () => {
    dispatch(closeDrawer());
  };

  // Auto-fallback: persisted niche-id is invalid (404 / archived) → reset to
  // create mode so user isn't stuck staring at an error after a niche is gone.
  // Slight delay so the user sees the error alert briefly before reset.

  const {
    niche,
    isFetching,
    fetchError,
    createForm,
    editForm,
    handleCreate,
    handleUpdate,
    creating,
    updating,
    deleting,
    serverError,
    archiveDialogOpen,
    setArchiveDialogOpen,
    linkedIdeasDialogOpen,
    linkedIdeaCount,
    handleArchiveConfirm,
    handleArchiveWithIdeas,
    handleLinkedIdeasCancel,
    unsavedDialogOpen,
    setUnsavedDialogOpen,
    requestClose,
    discardAndClose,
    isDirty,
  } = useNichePipelineDetail({ mode, selectedId, onClose: handleClose });

  const {
    requestSwitchToNiche,
    requestSwitchToCreate,
    unsavedConfirmAction,
    wrappedSetUnsavedDialogOpen,
  } = useNichePipelineSwitch({ isDirty, setUnsavedDialogOpen, discardAndClose });

  // Stale persisted niche-id (404 / archived). Reset to create mode after a
  // short pause so the alert is visible momentarily.
  useEffect(() => {
    if (!fetchError || mode !== 'edit') return;
    const id = setTimeout(() => dispatch(openNicheCreate()), 1500);
    return () => clearTimeout(id);
  }, [fetchError, mode, dispatch]);

  const isCreate = mode === 'create';
  const isBusy = creating || updating || deleting || isFetching;
  const nicheId = niche?.id ?? '';

  const counts = usePipelineCounts(isCreate ? '' : nicheId);
  const states = usePipelineStates(niche, counts);

  return (
    <PanelRoot>
      <PanelTitleBar>
        {isCreate ? (
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {t('niches.drawer.createTitle')}
          </Typography>
        ) : (
          <NichePipelineHeaderSelect
            activeNicheId={selectedId}
            activeNicheName={niche?.name}
            onSelectNiche={requestSwitchToNiche}
            onCreateNew={requestSwitchToCreate}
          />
        )}
      </PanelTitleBar>

      <PanelBody>
        {serverError && (
          <Alert severity="error" sx={{ mb: 0 }}>
            {serverError}
          </Alert>
        )}

        {isCreate ? (
          <PipelineCreateForm form={createForm} onSubmit={handleCreate} />
        ) : fetchError ? (
          <Alert severity="error">
            {t('niches.drawer.fetchError', 'Failed to load niche data. Please close and try again.')}
          </Alert>
        ) : !niche && isFetching ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={40} />
            <Skeleton variant="rounded" height={80} />
            <Skeleton variant="rounded" height={120} />
          </Stack>
        ) : (
          <>
            <PipelineEditForm
              form={editForm}
              onSubmit={handleUpdate}
              niche={niche}
              isFetching={isFetching}
            />

            {niche && (
              <PipelineSection>
                <PipelineCard
                  state={states.research}
                  icon={AutoAwesomeIcon}
                  title={t('research.drawer.sectionTitle')}
                  badge={states.research === 'done'
                    ? t('common.done', 'Done')
                    : states.research === 'active'
                      ? `${niche.research_progress?.completed_nodes.length ?? 0}/${niche.research_progress?.total_nodes ?? 6}`
                      : undefined}
                >
                  <ResearchCardContent niche={niche} isBusy={isBusy} />
                </PipelineCard>

                <PipelineCard
                  state={states.keywords}
                  icon={VpnKeyIcon}
                  title={t('keywords.drawer.sectionTitle')}
                  badge={counts.keywordCount > 0 ? String(counts.keywordCount) : undefined}
                >
                  <DrawerKeywordsSection nicheId={niche.id} />
                </PipelineCard>

                <PipelineCard
                  state={states.products}
                  icon={FavoriteIcon}
                  title={t('niches.drawer.collectedProducts.title')}
                  badge={counts.productCount > 0 ? String(counts.productCount) : undefined}
                >
                  <ProductsGrid nicheId={niche.id} nicheName={niche.name} />
                </PipelineCard>

                <PipelineCard
                  state={states.slogans}
                  icon={LightbulbOutlinedIcon}
                  title={t('niches.drawer.collectedSlogans')}
                  badge={counts.sloganCount > 0 ? String(counts.sloganCount) : undefined}
                >
                  <SlogansPipelineContent
                    nicheId={niche.id}
                    nicheName={niche.name}
                    nicheIdForProject={niche.id}
                    onDrawerClose={handleClose}
                  />
                </PipelineCard>

                <PipelineCard
                  state={states.designs}
                  icon={BrushOutlinedIcon}
                  title={t('design.projects.drawerSection.title')}
                  badge={counts.designProjectCount > 0 ? String(counts.designProjectCount) : undefined}
                >
                  <DesignsPipelineContent nicheId={niche.id} />
                </PipelineCard>

                <PipelineCard
                  state={states.listings}
                  icon={ArticleOutlinedIcon}
                  title={t('niches.pipeline.listings.title', 'Listings')}
                  badge={counts.listingCounts
                    ? String(counts.listingCounts.draft + counts.listingCounts.ready + counts.listingCounts.published)
                    : undefined}
                >
                  <ListingsPipelineContent nicheId={niche.id} counts={counts.listingCounts} />
                </PipelineCard>

                <PipelineCard
                  state={states.upload}
                  icon={CloudUploadOutlinedIcon}
                  title={t('niches.pipeline.upload.title', 'Upload')}
                  badge={counts.uploadCounts
                    ? String(counts.uploadCounts.pending + counts.uploadCounts.completed + counts.uploadCounts.failed)
                    : undefined}
                >
                  <UploadPipelineContent counts={counts.uploadCounts} />
                </PipelineCard>
              </PipelineSection>
            )}
          </>
        )}
      </PanelBody>

      <PanelFooter>
        {isCreate ? (
          <>
            <Button variant="text" onClick={requestClose} disabled={isBusy}>
              {t('niches.drawer.cancel')}
            </Button>
            <Button
              type="submit"
              form="niche-create-form"
              variant="contained"
              color="primary"
              disabled={isBusy}
            >
              {creating ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
              {t('niches.drawer.create')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => setArchiveDialogOpen(true)}
              disabled={isBusy}
              sx={{
                borderColor: alpha(COLORS.errorDk, 0.3),
                '&:hover': { backgroundColor: alpha(COLORS.errorDk, 0.08) },
              }}
            >
              {t('niches.drawer.archive')}
            </Button>
            <Button
              type="submit"
              form="niche-edit-form"
              variant="contained"
              color="primary"
              disabled={isBusy}
            >
              {updating ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
              {t('niches.drawer.save')}
            </Button>
          </>
        )}
      </PanelFooter>

      <PipelineConfirmDialogs
        archiveDialogOpen={archiveDialogOpen}
        setArchiveDialogOpen={setArchiveDialogOpen}
        handleArchiveConfirm={handleArchiveConfirm}
        deleting={deleting}
        unsavedDialogOpen={unsavedDialogOpen}
        setUnsavedDialogOpen={wrappedSetUnsavedDialogOpen}
        discardAndClose={discardAndClose}
        unsavedConfirmAction={unsavedConfirmAction}
        linkedIdeasDialogOpen={linkedIdeasDialogOpen}
        linkedIdeaCount={linkedIdeaCount}
        handleArchiveWithIdeas={handleArchiveWithIdeas}
        handleLinkedIdeasCancel={handleLinkedIdeasCancel}
      />
    </PanelRoot>
  );
};

export default NichePipeline;
