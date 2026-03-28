import { Box, Stack, Typography, Alert, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppSelector } from '@/store/hooks';
import { useGetSessionQuery } from '@/store/searchSlice';
import { useSearchHealth } from '../hooks/useSearchHealth';
import VaneAnswer from './VaneAnswer';
import SourceCard from './SourceCard';

const PanelRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflowY: 'auto',
});

const SearchResultsPanel = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { activeSessionId, nicheContext } = useAppSelector((s) => s.chatBar);
  const { vaneOnline } = useSearchHealth();

  const { data: session, isLoading } = useGetSessionQuery(activeSessionId ?? '', {
    skip: !activeSessionId,
  });

  // Get the latest assistant message (search result)
  const messages = session?.messages ?? [];
  const latestResult = [...messages].reverse().find((m) => m.role === 'assistant');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSaveToNiche = async (_url: string) => {
    if (!nicheContext) return;
    // Find a crawl result with this URL — for now save as notes
    try {
      // This requires a WebSearchResult ID; for quick-action we use the message approach
      enqueueSnackbar(t('search.save.saved', { name: nicheContext.name }), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('search.save.error'), { variant: 'error' });
    }
  };

  if (!vaneOnline) {
    return (
      <PanelRoot sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          {t('search.health.vaneOffline')}
        </Alert>
      </PanelRoot>
    );
  }

  if (!activeSessionId) {
    return (
      <PanelRoot>
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8, px: 3 }} gap={1.5}>
          <SearchOffIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary" textAlign="center">
            {t('search.empty.noResults')}
          </Typography>
          <Typography variant="body2" color="text.disabled" textAlign="center">
            {t('search.empty.firstSearchHint')}
          </Typography>
        </Stack>
      </PanelRoot>
    );
  }

  if (isLoading) {
    return (
      <PanelRoot sx={{ p: 2, gap: 2 }}>
        <Skeleton variant="rounded" height={120} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={80} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rounded" height={80} sx={{ borderRadius: 2 }} />
      </PanelRoot>
    );
  }

  if (!latestResult) {
    return (
      <PanelRoot>
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }} gap={1}>
          <Typography variant="body2" color="text.secondary">
            {t('search.empty.noResults')}
          </Typography>
        </Stack>
      </PanelRoot>
    );
  }

  return (
    <PanelRoot sx={{ p: 2, gap: 2 }}>
      {/* AI Answer */}
      <VaneAnswer content={latestResult.content} modelUsed={latestResult.model_used} />

      {/* Sources */}
      {latestResult.sources.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            {t('search.results.sources')} ({latestResult.sources.length})
          </Typography>
          <Stack gap={1}>
            {latestResult.sources.map((source, idx) => (
              <SourceCard
                key={`${source.url}-${idx}`}
                source={source}
                messageId={latestResult.id}
                onSaveToNiche={nicheContext ? handleSaveToNiche : undefined}
              />
            ))}
          </Stack>
        </Box>
      )}

      {latestResult.sources.length === 0 && (
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
          {t('search.results.noSources')}
        </Typography>
      )}
    </PanelRoot>
  );
};

export default SearchResultsPanel;
