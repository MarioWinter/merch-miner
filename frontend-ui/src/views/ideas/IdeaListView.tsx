import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Pagination,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useListIdeasQuery } from '@/store/ideaSlice';
import { ManualIdeaForm } from './partials/ManualIdeaForm';
import { IdeaSourceGroup } from './partials/IdeaSourceGroup';
import { IdeaCard } from './partials/IdeaCard';
import { AdaptationModal } from './partials/AdaptationModal';
import { AdaptationProgress } from './partials/AdaptationProgress';
import { ImproveDialog } from './partials/ImproveDialog';
import { EmptyState } from './partials/EmptyState';
import { useAdaptation } from './hooks/useAdaptation';
import { useIdeaActions } from './hooks/useIdeaActions';
import type { Idea } from './types';

const PAGE_SIZE = 20;

export const IdeaListView = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const nicheId = params.get('nicheId') ?? '';
  const [page, setPage] = useState(1);

  // Data
  const { data, isLoading, isError } = useListIdeasQuery(
    { nicheId, page, page_size: PAGE_SIZE },
    { skip: !nicheId },
  );

  // Actions
  const actions = useIdeaActions();
  const adaptation = useAdaptation();

  // UI state
  const [adaptIdea, setAdaptIdea] = useState<Idea | null>(null);
  const [improveIdea, setImproveIdea] = useState<Idea | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Group ideas: source ideas (no source_idea FK) vs adapted
  const { sourceIdeas, orphanIdeas, adaptedBySource } = useMemo(() => {
    const ideas = data?.results ?? [];
    const sources: Idea[] = [];
    const orphans: Idea[] = [];
    const bySource: Record<string, Idea[]> = {};

    for (const idea of ideas) {
      if (!idea.source_idea) {
        sources.push(idea);
      } else {
        const key = idea.source_idea;
        if (!bySource[key]) bySource[key] = [];
        bySource[key].push(idea);
      }
    }

    // Orphan adapted ideas (source not in current page)
    for (const [sourceId, children] of Object.entries(bySource)) {
      if (!sources.find((s) => s.id === sourceId)) {
        orphans.push(...children);
      }
    }

    return { sourceIdeas: sources, orphanIdeas: orphans, adaptedBySource: bySource };
  }, [data]);

  const handleAdaptConfirm = useCallback(
    (targetNicheIds: string[]) => {
      if (adaptIdea) {
        adaptation.triggerAdaptation(adaptIdea.id, targetNicheIds);
        setAdaptIdea(null);
      }
    },
    [adaptIdea, adaptation],
  );

  const handleBulkApprove = () => {
    actions.bulkUpdateStatus(Array.from(selectedIds), 'approved');
    setSelectedIds(new Set());
  };

  const handleBulkReject = () => {
    actions.bulkUpdateStatus(Array.from(selectedIds), 'rejected');
    setSelectedIds(new Set());
  };

  if (!nicheId) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">
          {t('ideas.empty.selectNiche')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        {t('ideas.pageTitle')}
      </Typography>

      {/* Manual create form */}
      <ManualIdeaForm nicheId={nicheId} />

      {/* Adaptation progress */}
      {adaptation.run && (
        <Box sx={{ mt: 2 }}>
          <AdaptationProgress run={adaptation.run} />
        </Box>
      )}

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
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
        </Stack>
      )}

      {/* Adapt to All Compatible */}
      {sourceIdeas.length > 0 && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
            onClick={() => {
              // Use first source idea with a niche
              const source = sourceIdeas.find((s) => s.niche);
              if (source) setAdaptIdea(source);
            }}
          >
            {t('ideas.adapt.adaptAll')}
          </Button>
        </Stack>
      )}

      {/* Loading */}
      {isLoading && (
        <Stack spacing={1.5} sx={{ mt: 3 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={100}
              sx={{ borderRadius: 3 }}
            />
          ))}
        </Stack>
      )}

      {/* Error */}
      {isError && (
        <Typography color="error.main" sx={{ mt: 3 }}>
          {t('ideas.notifications.loadError')}
        </Typography>
      )}

      {/* Empty */}
      {!isLoading && !isError && data && data.results.length === 0 && (
        <EmptyState />
      )}

      {/* Idea list */}
      {!isLoading && data && data.results.length > 0 && (
        <Stack spacing={2} sx={{ mt: 3 }}>
          {sourceIdeas.map((source) => {
            const adapted = adaptedBySource[source.id] ?? [];
            if (adapted.length > 0) {
              return (
                <IdeaSourceGroup
                  key={source.id}
                  sourceIdea={source}
                  adaptedIdeas={adapted}
                  onApprove={actions.approve}
                  onReject={actions.reject}
                  onImprove={(idea) => setImproveIdea(idea)}
                  onAdapt={(idea) => setAdaptIdea(idea)}
                  onDelete={actions.deleteIdea}
                  onRegenerate={(idea) => actions.regenerate(idea.id)}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
              );
            }
            return (
              <IdeaCard
                key={source.id}
                idea={source}
                onApprove={() => actions.approve(source)}
                onReject={() => actions.reject(source)}
                onImprove={() => setImproveIdea(source)}
                onAdapt={() => setAdaptIdea(source)}
                onDelete={() => actions.deleteIdea(source)}
                onRegenerate={() => actions.regenerate(source.id)}
                isSelected={selectedIds.has(source.id)}
                onToggleSelect={() => toggleSelect(source.id)}
              />
            );
          })}
          {/* Orphan adapted ideas */}
          {orphanIdeas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onApprove={() => actions.approve(idea)}
              onReject={() => actions.reject(idea)}
              onImprove={() => setImproveIdea(idea)}
              onAdapt={() => setAdaptIdea(idea)}
              onDelete={() => actions.deleteIdea(idea)}
              onRegenerate={() => actions.regenerate(idea.id)}
              isSelected={selectedIds.has(idea.id)}
              onToggleSelect={() => toggleSelect(idea.id)}
            />
          ))}
        </Stack>
      )}

      {/* Pagination */}
      {data && data.count > PAGE_SIZE && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={Math.ceil(data.count / PAGE_SIZE)}
            page={page}
            onChange={(_e, p) => setPage(p)}
            color="primary"
          />
        </Box>
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
        onImprove={(feedback) =>
          actions.improve(improveIdea!.id, feedback)
        }
        onSelectVariant={() => setImproveIdea(null)}
        isImproving={actions.isImproving}
      />
    </Box>
  );
};

export default IdeaListView;
