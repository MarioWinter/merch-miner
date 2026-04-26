import { useMemo, useState } from 'react';
import { Avatar, Box, IconButton, Link, Stack, Tooltip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import DownloadDoneIcon from '@mui/icons-material/DownloadDone';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import LanguageIcon from '@mui/icons-material/Language';
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
  onSaveKeywords?: (url: string, snippet: string) => void;
  onSaveNotes?: (url: string, snippet: string) => void;
}

const CardRoot = styled(Box)(({ theme }) => ({
  padding: `${theme.spacing(1)} ${theme.spacing(1.25)}`,
  borderRadius: 10,
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: alpha(theme.palette.background.paper, 0.55),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  transition: 'border-color 120ms ease, background-color 120ms ease',
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.4),
    backgroundColor: alpha(theme.palette.background.paper, 0.75),
  },
}));

const FaviconAvatar = styled(Avatar)({
  width: 32,
  height: 32,
  fontSize: 14,
});

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const getFaviconUrl = (url: string): string => {
  const domain = getDomain(url);
  // Google s2 favicons (32px) — public, no API key required
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
};

const SourceCard = ({
  source,
  messageId,
  crawlResultId,
  onSaveKeywords,
  onSaveNotes,
}: SourceCardProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { crawl4aiOnline } = useSearchHealth();
  const nicheContext = useAppSelector((s) => s.chatBar.nicheContext);

  const [triggerCrawl] = useTriggerCrawlMutation();
  const [localCrawlId, setLocalCrawlId] = useState<string | null>(crawlResultId ?? null);
  const [faviconError, setFaviconError] = useState(false);

  const { data: crawlStatus } = useGetCrawlStatusQuery(localCrawlId ?? '', {
    skip: !localCrawlId,
    pollingInterval: localCrawlId ? 3000 : 0,
  });

  const isCrawling = !!crawlStatus && ['pending', 'running'].includes(crawlStatus.crawl_status);
  const isCrawlDone = !!crawlStatus && crawlStatus.crawl_status === 'completed';

  const domain = useMemo(() => getDomain(source.url), [source.url]);
  const faviconUrl = useMemo(() => getFaviconUrl(source.url), [source.url]);

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
    <CardRoot data-source-url={source.url}>
      {/* Header: favicon + domain + status */}
      <Stack direction="row" alignItems="center" gap={1}>
        <FaviconAvatar
          src={faviconError ? undefined : faviconUrl}
          alt={domain}
          slotProps={{
            img: {
              onError: () => setFaviconError(true),
            },
          }}
        >
          <LanguageIcon sx={{ fontSize: 18 }} />
        </FaviconAvatar>
        <Stack flex={1} minWidth={0}>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.6875rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {domain}
          </Typography>
          <Link
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            title={source.title || source.url}
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {source.title || source.url}
          </Link>
        </Stack>
        {crawlStatus && <CrawlStatusBadge status={crawlStatus.crawl_status} />}
      </Stack>

      {/* 1-line snippet */}
      {source.snippet && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontSize: '0.75rem',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={source.snippet}
        >
          {truncate(source.snippet, 160)}
        </Typography>
      )}

      {/* Action row */}
      <Stack direction="row" gap={0.25} alignItems="center" sx={{ mt: 0.25 }}>
        {!localCrawlId && (
          <Tooltip
            title={crawl4aiOnline ? t('search.results.deepCrawl') : t('search.health.crawl4aiOffline')}
            placement="top"
          >
            <span>
              <IconButton
                size="small"
                onClick={handleDeepCrawl}
                disabled={!crawl4aiOnline || isCrawling}
                aria-label={t('search.results.deepCrawl')}
                sx={{ p: 0.5 }}
              >
                <TravelExploreIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {onSaveKeywords && (
          <Tooltip
            title={
              nicheContext
                ? t('search.save.toNiche', { name: nicheContext.name })
                : t('search.save.toNichePicker')
            }
            placement="top"
          >
            <IconButton
              size="small"
              onClick={() => onSaveKeywords(source.url, source.snippet ?? '')}
              aria-label={t('search.save.keywords')}
              sx={{ p: 0.5 }}
            >
              <BookmarkBorderIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {onSaveNotes && (
          <Tooltip title={t('search.save.notes')} placement="top">
            <IconButton
              size="small"
              onClick={() => onSaveNotes(source.url, source.snippet ?? '')}
              aria-label={t('search.save.notes')}
              sx={{ p: 0.5 }}
            >
              <NoteAddOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        {isCrawlDone && (
          <Tooltip title={t('search.save.vectorDbSaved')} placement="top">
            <DownloadDoneIcon sx={{ fontSize: 16, color: 'success.main', ml: 'auto' }} />
          </Tooltip>
        )}
      </Stack>
    </CardRoot>
  );
};

export default SourceCard;
