import { useState } from 'react';
import { Box, Button, Link, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import DownloadDoneIcon from '@mui/icons-material/DownloadDone';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useTriggerCrawlMutation, useGetCrawlStatusQuery } from '@/store/searchSlice';
import { useSearchHealth } from '../hooks/useSearchHealth';
import { useAppSelector } from '@/store/hooks';
import type { SourceItem } from '@/types/search';
import CrawlStatusBadge from './CrawlStatusBadge';

interface SourceCardProps {
  source: SourceItem;
  messageId?: string;
  crawlResultId?: string;
  onSaveToNiche?: (url: string) => void;
}

const CardRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.vars.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
  '&:hover': {
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
}));

const SourceCard = ({ source, messageId, crawlResultId, onSaveToNiche }: SourceCardProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { crawl4aiOnline } = useSearchHealth();
  const nicheContext = useAppSelector((s) => s.chatBar.nicheContext);

  const [triggerCrawl] = useTriggerCrawlMutation();
  const [localCrawlId, setLocalCrawlId] = useState<string | null>(crawlResultId ?? null);

  const { data: crawlStatus } = useGetCrawlStatusQuery(localCrawlId ?? '', {
    skip: !localCrawlId,
    pollingInterval: localCrawlId ? 3000 : 0,
  });

  const isCrawling = crawlStatus && ['pending', 'running'].includes(crawlStatus.crawl_status);

  const handleDeepCrawl = async () => {
    try {
      const result = await triggerCrawl({
        url: source.url,
        chat_message_id: messageId,
      }).unwrap();
      setLocalCrawlId(result.id);
    } catch {
      enqueueSnackbar(t('search.crawl.error'), { variant: 'error' });
    }
  };

  return (
    <CardRoot>
      <Link
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        underline="hover"
        sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'secondary.main' }}
      >
        {source.title || source.url}
      </Link>

      {source.snippet && (
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          {source.snippet}
        </Typography>
      )}

      <Stack direction="row" gap={0.5} flexWrap="wrap" alignItems="center">
        {crawlStatus && <CrawlStatusBadge status={crawlStatus.crawl_status} />}

        {!localCrawlId && (
          <Tooltip
            title={crawl4aiOnline ? '' : t('search.health.crawl4aiOffline')}
            placement="top"
          >
            <span>
              <Button
                size="small"
                startIcon={<TravelExploreIcon sx={{ fontSize: 14 }} />}
                onClick={handleDeepCrawl}
                disabled={!crawl4aiOnline || !!isCrawling}
                sx={{ textTransform: 'none', fontSize: '0.6875rem' }}
              >
                {t('search.results.deepCrawl')}
              </Button>
            </span>
          </Tooltip>
        )}

        {nicheContext && onSaveToNiche && (
          <Button
            size="small"
            startIcon={<SaveOutlinedIcon sx={{ fontSize: 14 }} />}
            onClick={() => onSaveToNiche(source.url)}
            sx={{ textTransform: 'none', fontSize: '0.6875rem' }}
          >
            {t('search.save.toNiche', { name: nicheContext.name })}
          </Button>
        )}

        <Tooltip title={t('search.save.vectorDbSaved')} placement="top">
          <DownloadDoneIcon sx={{ fontSize: 16, color: 'success.main', ml: 'auto' }} />
        </Tooltip>
      </Stack>
    </CardRoot>
  );
};

export default SourceCard;
