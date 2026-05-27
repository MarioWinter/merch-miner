import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/store/hooks';
import { openNicheEdit } from '@/store/chatBarSlice';
import { useListAllIdeasQuery } from '@/store/ideaSlice';
import { useIdeaFilters } from './hooks/useIdeaFilters';
import { useIdeaInlineAdd } from './hooks/useInlineAdd';
import { useIdeaInlineEdit } from './hooks/useInlineEdit';
import { useAdaptation } from './hooks/useAdaptation';
import { useIdeaActions } from './hooks/useIdeaActions';
import { useRejectWithDesignWarning } from './hooks/useRejectWithDesignWarning';
import { IdeaFilterToolbar } from './partials/IdeaFilterToolbar';
import { SelectionToolbar } from './partials/SelectionToolbar';
import { InlineAddBar } from './partials/InlineAddBar';
import { IdeaCard } from './partials/IdeaCard';
import { IdeaSourceGroup } from './partials/IdeaSourceGroup';
import { AdaptationModal } from './partials/AdaptationModal';
import { AdaptationProgress } from './partials/AdaptationProgress';
import { ImproveDialog } from './partials/ImproveDialog';
import { ImportDialog } from './partials/ImportDialog';
import { RejectIdeaWarningDialog } from './partials/RejectIdeaWarningDialog';
import type { Idea } from './types';

const PAGE_SIZE = 20;

const PageHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(2),
}));

const PaginationRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(2),
}));

const ErrorBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: theme.spacing(8),
  paddingBottom: theme.spacing(8),
  gap: theme.spacing(1.5),
  textAlign: 'center',
}));

const EmptyHint = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: `${theme.spacing(4)} 0`,
  gap: theme.spacing(1),
}));

/**
 * PROJ-30 T3.5 — bulk-action bar pinned to viewport bottom on `<md`
 * (phones + small tablets). On `>=md` it sits inline above the list.
 */
const BulkActionBar = styled(Stack)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  [theme.breakpoints.down('md')]: {
    position: 'fixed',
    bottom: 'env(safe-area-inset-bottom, 0px)',
    left: 0,
    right: 0,
    zIndex: 1100,
    padding: theme.spacing(2),
    margin: 0,
    backgroundColor: theme.vars.palette.background.paper,
    borderTop: `1px solid ${theme.vars.palette.divider}`,
  },
}));

export const IdeaListView = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  // Filters
  const filterState = useIdeaFilters();
  const { filters } = filterState;

  // Hooks
  const inlineAdd = useIdeaInlineAdd();
  const inlineEdit = useIdeaInlineEdit();
  const actions = useIdeaActions();
  const rejectWarning = useRejectWithDesignWarning(actions.reject);
  const adaptation = useAdaptation();

  // Data
  const { data, isLoading, isError, isFetching } = useListAllIdeasQuery({
    niche_id: filters.niche_id || undefined,
    status: filters.status || undefined,
    signal_type: filters.signal_type || undefined,
    ordering: filters.ordering || '-created_at',
    page: filters.page,
    page_size: PAGE_SIZE,
  });

  // UI state
  const [adaptIdea, setAdaptIdea] = useState<Idea | null>(null);
  const [improveIdea, setImproveIdea] = useState<Idea | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleOpenDrawer = useCallback((idea: Idea) => {
    if (idea.niche) dispatch(openNicheEdit(idea.niche));
  }, [dispatch]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allIdeas = useMemo(() => data?.results ?? [], [data?.results]);
  const totalCount = data?.count ?? 0;

  // Group ideas: niche-less at top, source groups, orphan adapted
  const { nicheLessIdeas, sourceIdeas, adaptedBySource, orphanIdeas } = useMemo(() => {
    const nicheLess: Idea[] = [];
    const sources: Idea[] = [];
    const bySource: Record<string, Idea[]> = {};

    for (const idea of allIdeas) {
      if (!idea.source_idea) {
        if (!idea.niche) {
          nicheLess.push(idea);
        } else {
          sources.push(idea);
        }
      } else {
        const key = idea.source_idea;
        if (!bySource[key]) bySource[key] = [];
        bySource[key].push(idea);
      }
    }

    // Orphan adapted ideas (source not in current page)
    const orphans: Idea[] = [];
    for (const [sourceId, children] of Object.entries(bySource)) {
      if (!sources.find((s) => s.id === sourceId) && !nicheLess.find((s) => s.id === sourceId)) {
        orphans.push(...children);
      }
    }

    return {
      nicheLessIdeas: nicheLess,
      sourceIdeas: sources,
      adaptedBySource: bySource,
      orphanIdeas: orphans,
    };
  }, [allIdeas]);

  const handleAdaptConfirm = useCallback(
    (targetNicheIds: string[]) => {
      if (adaptIdea) {
        adaptation.triggerAdaptation(adaptIdea.id, targetNicheIds);
        setAdaptIdea(null);
      }
    },
    [adaptIdea, adaptation],
  );

  const handleSelectAllOnPage = useCallback(() => {
    setSelectedIds(new Set(allIdeas.map((idea) => idea.id)));
  }, [allIdeas]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkApprove = () => {
    actions.bulkUpdateStatus(Array.from(selectedIds), 'approved');
    setSelectedIds(new Set());
  };

  const handleBulkReject = () => {
    actions.bulkUpdateStatus(Array.from(selectedIds), 'rejected');
    setSelectedIds(new Set());
  };

  const ideas = allIdeas;
  const pageCount = Math.ceil(totalCount / PAGE_SIZE);
  const showSkeleton = isLoading || (isFetching && ideas.length === 0);
  const showEmpty = !isLoading && !isError && ideas.length === 0;
  const showList = !isLoading && !isError && ideas.length > 0;

  // Extra bottom padding while bulk bar is sticky on small viewports so the
  // last list item / Generate button is not clipped behind the fixed bar.
  const hasStickyBulkBar = selectedIds.size > 0;

  return (
    <Box sx={{ pb: { xs: hasStickyBulkBar ? 14 : 8, md: 8 } }}>
      {/* Page header */}
      <PageHeader>
        <Typography component="h1" variant="h4" fontWeight={700}>
          {t('ideas.pageTitle')}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<UploadFileIcon sx={{ fontSize: 18 }} />}
          onClick={() => setImportOpen(true)}
          aria-label={t('ideas.import.button')}
        >
          {t('ideas.import.button')}
        </Button>
      </PageHeader>

      {/* Filter toolbar */}
      <IdeaFilterToolbar filterState={filterState} />

      {/* Selection toolbar — always-visible counter + select-all */}
      <SelectionToolbar
        availableCount={totalCount}
        selectedCount={selectedIds.size}
        pageItemCount={allIdeas.length}
        onSelectAll={handleSelectAllOnPage}
        onClearSelection={handleClearSelection}
      />

      {/* Inline add bar — always visible */}
      <Box sx={{ mb: 2 }}>
        <InlineAddBar inlineAdd={inlineAdd} />
      </Box>

      {/* Adaptation progress */}
      {adaptation.run && (
        <Box sx={{ mb: 2 }}>
          <AdaptationProgress run={adaptation.run} />
        </Box>
      )}

      {/* Bulk actions bar — sticky bottom on <md (T3.5) */}
      {selectedIds.size > 0 && (
        <BulkActionBar direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {t('ideas.bulk.selected', { count: selectedIds.size })}
          </Typography>
          <Button size="small" color="success" onClick={handleBulkApprove}>
            {t('ideas.bulk.approve')}
          </Button>
          <Button size="small" color="error" onClick={handleBulkReject}>
            {t('ideas.bulk.reject')}
          </Button>
          <Button size="small" onClick={() => setSelectedIds(new Set())}>
            {t('ideas.bulk.clear')}
          </Button>
        </BulkActionBar>
      )}

      {/* Error */}
      {isError && (
        <ErrorBox role="alert">
          <Typography variant="h6" color="text.secondary">
            {t('ideas.notifications.loadError')}
          </Typography>
        </ErrorBox>
      )}

      {/* Loading skeleton */}
      {showSkeleton && (
        <Stack spacing={1.5}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={80}
              sx={{ borderRadius: 3 }}
            />
          ))}
        </Stack>
      )}

      {/* Empty inline hint (not full-page takeover) */}
      {showEmpty && (
        <EmptyHint>
          <LightbulbOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography variant="body1" color="text.secondary">
            {t('ideas.empty.title')}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {t('ideas.empty.hint')}
          </Typography>
        </EmptyHint>
      )}

      {/* Idea list */}
      {showList && (
        <Stack spacing={2}>
          {/* Adapt to All Compatible */}
          {sourceIdeas.length > 0 && (
            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="outlined"
                size="small"
                startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
                onClick={() => {
                  const source = sourceIdeas.find((s) => s.niche);
                  if (source) setAdaptIdea(source);
                }}
              >
                {t('ideas.adapt.adaptAll')}
              </Button>
            </Stack>
          )}

          {/* Niche-less ideas (top) */}
          {nicheLessIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onApprove={() => actions.approve(idea)}
              onReject={() => rejectWarning.requestReject(idea)}
              onImprove={() => setImproveIdea(idea)}
              onAdapt={() => setAdaptIdea(idea)}
              onDelete={() => actions.deleteIdea(idea)}
              onRegenerate={() => actions.regenerate(idea.id)}
              onDoubleClick={() => handleOpenDrawer(idea)}
              isSelected={selectedIds.has(idea.id)}
              onToggleSelect={() => toggleSelect(idea.id)}
              inlineEdit={inlineEdit}
            />
          ))}

          {/* Source groups */}
          {sourceIdeas.map((source) => {
            const adapted = adaptedBySource[source.id] ?? [];
            if (adapted.length > 0) {
              return (
                <IdeaSourceGroup
                  key={source.id}
                  sourceIdea={source}
                  adaptedIdeas={adapted}
                  onApprove={actions.approve}
                  onReject={rejectWarning.requestReject}
                  onImprove={(idea) => setImproveIdea(idea)}
                  onAdapt={(idea) => setAdaptIdea(idea)}
                  onDelete={actions.deleteIdea}
                  onRegenerate={(idea) => actions.regenerate(idea.id)}
                  onDoubleClick={handleOpenDrawer}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  inlineEdit={inlineEdit}
                />
              );
            }
            return (
              <IdeaCard
                key={source.id}
                idea={source}
                onApprove={() => actions.approve(source)}
                onReject={() => rejectWarning.requestReject(source)}
                onImprove={() => setImproveIdea(source)}
                onAdapt={() => setAdaptIdea(source)}
                onDelete={() => actions.deleteIdea(source)}
                onRegenerate={() => actions.regenerate(source.id)}
                onDoubleClick={() => handleOpenDrawer(source)}
                isSelected={selectedIds.has(source.id)}
                onToggleSelect={() => toggleSelect(source.id)}
                inlineEdit={inlineEdit}
              />
            );
          })}

          {/* Orphan adapted ideas */}
          {orphanIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onApprove={() => actions.approve(idea)}
              onReject={() => rejectWarning.requestReject(idea)}
              onImprove={() => setImproveIdea(idea)}
              onAdapt={() => setAdaptIdea(idea)}
              onDelete={() => actions.deleteIdea(idea)}
              onRegenerate={() => actions.regenerate(idea.id)}
              onDoubleClick={() => handleOpenDrawer(idea)}
              isSelected={selectedIds.has(idea.id)}
              onToggleSelect={() => toggleSelect(idea.id)}
              inlineEdit={inlineEdit}
            />
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <PaginationRow>
          <Pagination
            count={pageCount}
            page={filters.page}
            onChange={(_, page) => filterState.setPage(page)}
            color="primary"
            size="small"
            aria-label="Idea list pagination"
          />
        </PaginationRow>
      )}

      {/* Adaptation modal */}
      <AdaptationModal
        open={!!adaptIdea}
        onClose={() => setAdaptIdea(null)}
        sourceIdea={adaptIdea}
        onConfirm={handleAdaptConfirm}
        isTriggering={adaptation.isTriggering}
      />

      {/* Improve dialog */}
      <ImproveDialog
        open={!!improveIdea}
        onClose={() => setImproveIdea(null)}
        idea={improveIdea}
        onImprove={(feedback) => actions.improve(improveIdea!.id, feedback)}
        onSelectVariant={() => setImproveIdea(null)}
        isImproving={actions.isImproving}
      />

      {/* Import dialog */}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {/* Reject idea warning (when idea has approved design) */}
      <RejectIdeaWarningDialog
        open={rejectWarning.warningOpen}
        onConfirm={rejectWarning.confirmReject}
        onCancel={rejectWarning.cancelReject}
      />
    </Box>
  );
};

export default IdeaListView;
