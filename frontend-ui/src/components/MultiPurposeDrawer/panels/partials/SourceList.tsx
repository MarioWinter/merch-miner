import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Collapse, Stack, Tooltip } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LanguageIcon from '@mui/icons-material/Language';
import { useTranslation } from 'react-i18next';
import type { SourceItem } from '@/types/search';
import SourceCard from '../SourceCard';

interface SourceListProps {
  sources: SourceItem[];
  messageId: string;
  onSaveKeywords?: (url: string, snippet: string) => void;
  onSaveNotes?: (url: string, snippet: string) => void;
}

/**
 * PROJ-20 Phase 5+ — Perplexity-style collapsed source preview.
 *
 * Collapsed (default): single-line trigger showing first ~5 favicons + count.
 * Expanded: full vertical list of `SourceCard`s. The trigger is the only
 * always-visible affordance; clicking anywhere on it toggles expansion.
 */

const Trigger = styled(Button)(({ theme }) => ({
  justifyContent: 'space-between',
  textTransform: 'none',
  fontSize: '0.8125rem',
  fontWeight: 500,
  width: '100%',
  padding: `${theme.spacing(0.75)} ${theme.spacing(1)}`,
  borderRadius: 10,
  color: theme.vars.palette.text.secondary,
  backgroundColor: alpha(theme.palette.common.black, 0.25),
  border: `1px solid ${theme.vars.palette.divider}`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.black, 0.35),
    borderColor: alpha(theme.palette.primary.main, 0.4),
  },
}));

const FaviconRow = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
});

const Favicon = styled('img')(({ theme }) => ({
  width: 16,
  height: 16,
  borderRadius: 4,
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: theme.vars.palette.background.paper,
  objectFit: 'cover',
}));

const FaviconFallback = styled(Box)(({ theme }) => ({
  width: 16,
  height: 16,
  borderRadius: 4,
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: theme.vars.palette.background.paper,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.vars.palette.text.disabled,
}));

const PREVIEW_FAVICONS = 5;

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const getFaviconUrl = (url: string): string => {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
};

const SourceList = ({
  sources,
  messageId,
  onSaveKeywords,
  onSaveNotes,
}: SourceListProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Auto-expand when a citation in this message is clicked (CitationLink
  // dispatches `chat-citation-click` with the messageId).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string }>).detail;
      if (detail?.messageId === messageId) setOpen(true);
    };
    window.addEventListener('chat-citation-click', handler);
    return () => window.removeEventListener('chat-citation-click', handler);
  }, [messageId]);

  const previewSources = useMemo(
    () => sources.slice(0, PREVIEW_FAVICONS),
    [sources],
  );

  if (sources.length === 0) return null;

  return (
    <Box>
      <Trigger
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`sources-${messageId}`}
        endIcon={
          open ? (
            <KeyboardArrowUpIcon sx={{ fontSize: 18 }} />
          ) : (
            <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
          )
        }
      >
        <Stack
          direction="row"
          alignItems="center"
          gap={1}
          sx={{ minWidth: 0, flex: 1 }}
        >
          <FaviconRow>
            {previewSources.map((src) => (
              <Tooltip key={src.url} title={getDomain(src.url)} placement="top">
                <Favicon
                  src={getFaviconUrl(src.url)}
                  alt={getDomain(src.url)}
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const sib = target.nextElementSibling as HTMLElement | null;
                    if (sib) sib.style.display = 'flex';
                  }}
                />
              </Tooltip>
            ))}
            {sources.length === 0 && (
              <FaviconFallback>
                <LanguageIcon sx={{ fontSize: 12 }} />
              </FaviconFallback>
            )}
          </FaviconRow>
          <Box component="span" sx={{ color: 'text.primary' }}>
            {t('search.results.sourceCount', { count: sources.length })}
          </Box>
        </Stack>
      </Trigger>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Stack id={`sources-${messageId}`} gap={0.5} sx={{ mt: 0.75 }}>
          {sources.map((src, idx) => (
            <SourceCard
              key={`${messageId}-${src.url}-${idx}`}
              source={src}
              messageId={messageId}
              sourceIndex={idx}
              onSaveKeywords={onSaveKeywords}
              onSaveNotes={onSaveNotes}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
};

export default SourceList;
