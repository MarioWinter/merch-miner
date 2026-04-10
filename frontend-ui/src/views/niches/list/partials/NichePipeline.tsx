import {
  Alert,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { COLORS } from '@/style/constants';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import FavoriteIcon from '@mui/icons-material/Favorite';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { useTranslation } from 'react-i18next';
import type { DrawerMode } from '../hooks/useNichePipeline';
import { useNichePipelineDetail } from '../hooks/useNichePipelineDetail';
import { usePipelineStates } from '../hooks/usePipelineStates';
import { useDrawerPipelineCounts } from '../hooks/useDrawerPipelineCounts';
import { DrawerCreateForm } from './DrawerCreateForm';
import { DrawerEditForm } from './DrawerEditForm';
import { DrawerConfirmDialogs } from './DrawerConfirmDialogs';
import { PipelineCard } from '@/components/PipelineCard';
import { ResearchCardContent } from './ResearchCardContent';
import { ProductsGrid } from './ProductsGrid';
import { SlogansPipelineContent } from './SlogansPipelineContent';
import { DrawerKeywordsSection } from '@/views/amazon/keywords/drawer/DrawerKeywordsSection';
import { DesignsPipelineContent } from './DesignsPipelineContent';
import { ListingsPipelineContent } from './ListingsPipelineContent';
import { UploadPipelineContent } from './UploadPipelineContent';

interface NichePipelineProps {
  open: boolean;
  mode: DrawerMode;
  selectedId: string | null;
  onClose: () => void;
}

const DRAWER_WIDTH = 480;

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
}));

const DrawerBody = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const DrawerFooter = styled(Box)(({ theme }) => ({
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

export const NichePipeline = ({
  open,
  mode,
  selectedId,
  onClose,
}: NichePipelineProps) => {
  const { t } = useTranslation();

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
  } = useNichePipelineDetail({ mode, selectedId, onClose });

  const isCreate = mode === 'create';
  const isBusy = creating || updating || deleting || isFetching;
  const nicheId = niche?.id ?? '';

  const counts = useDrawerPipelineCounts(isCreate ? '' : nicheId);
  const states = usePipelineStates(niche, counts);

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={requestClose}
        slotProps={{ paper: { sx: { width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column' } } }}
      >
        <DrawerHeader>
          <Typography variant="h6" fontWeight={600}>
            {isCreate ? t('niches.drawer.createTitle') : (niche?.name ?? t('niches.drawer.editTitle'))}
          </Typography>
          <IconButton size="small" onClick={requestClose} aria-label={t('niches.drawer.cancel')} sx={{ borderRadius: '8px' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DrawerHeader>

        <DrawerBody>
          {serverError && (
            <Alert severity="error" sx={{ mb: 0 }}>
              {serverError}
            </Alert>
          )}

          {isCreate ? (
            <DrawerCreateForm form={createForm} onSubmit={handleCreate} />
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
              <DrawerEditForm
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
                    <ProductsGrid nicheId={niche.id} />
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
                      onDrawerClose={onClose}
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
        </DrawerBody>

        <DrawerFooter>
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
                sx={{ borderColor: alpha(COLORS.errorDk, 0.30), '&:hover': { backgroundColor: alpha(COLORS.errorDk, 0.08) } }}
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
        </DrawerFooter>
      </Drawer>

      <DrawerConfirmDialogs
        archiveDialogOpen={archiveDialogOpen}
        setArchiveDialogOpen={setArchiveDialogOpen}
        handleArchiveConfirm={handleArchiveConfirm}
        deleting={deleting}
        unsavedDialogOpen={unsavedDialogOpen}
        setUnsavedDialogOpen={setUnsavedDialogOpen}
        discardAndClose={discardAndClose}
        linkedIdeasDialogOpen={linkedIdeasDialogOpen}
        linkedIdeaCount={linkedIdeaCount}
        handleArchiveWithIdeas={handleArchiveWithIdeas}
        handleLinkedIdeasCancel={handleLinkedIdeasCancel}
      />
    </>
  );
};
