import { useCallback } from 'react';
import { Box, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

interface CitationLinkProps {
  /** 1-indexed citation number as it appeared in `[N]`. */
  index: number;
  /** Domain shown in tooltip (already extracted by caller). */
  domain: string;
  /** Stable id used to look up the matching SourceCard within the same message. */
  messageId: string;
}

/**
 * Inline `<sup><a>` element rendered for every valid citation token in the
 * AI answer. Click → smooth-scroll to `SourceCard[data-message-id][data-source-index]`
 * within the SAME message + flash class toggle for 1 second (per AC-26 + EC-5).
 */
const SupAnchor = styled('a')(({ theme }) => ({
  display: 'inline-block',
  cursor: 'pointer',
  color: theme.vars.palette.secondary.main,
  textDecoration: 'none',
  fontSize: '0.7em',
  fontWeight: 600,
  lineHeight: 1,
  padding: '0 2px',
  borderRadius: 4,
  verticalAlign: 'super',
  transition: 'background-color 120ms ease, color 120ms ease',
  '&:hover, &:focus-visible': {
    backgroundColor: theme.vars.palette.action.hover,
    color: theme.vars.palette.secondary.light,
    outline: 'none',
  },
}));

const FLASH_CLASS = 'citation-flash';
const FLASH_MS = 1000;

const CitationLink = ({ index, domain, messageId }: CitationLinkProps) => {
  const { t } = useTranslation();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Notify SourceList for the same message to auto-expand if collapsed.
      window.dispatchEvent(
        new CustomEvent('chat-citation-click', {
          detail: { messageId, index },
        }),
      );
      const selector = `[data-message-id="${CSS.escape(messageId)}"][data-source-index="${index - 1}"]`;
      // Defer scroll/flash so the auto-expand Collapse can render first.
      window.setTimeout(() => {
        const target = document.querySelector<HTMLElement>(selector);
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const inViewport =
          rect.top >= 0 &&
          rect.bottom <=
            (window.innerHeight || document.documentElement.clientHeight);
        if (!inViewport) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        target.classList.add(FLASH_CLASS);
        window.setTimeout(() => {
          target.classList.remove(FLASH_CLASS);
        }, FLASH_MS);
      }, 50);
    },
    [index, messageId],
  );

  return (
    <Tooltip title={domain || t('search.citation.unknownDomain')} placement="top" arrow>
      <Box component="sup" sx={{ display: 'inline-block', lineHeight: 0 }}>
        <SupAnchor
          href={`#source-${index}`}
          data-citation-index={index}
          aria-label={t('search.citation.openSource', { n: index })}
          onClick={handleClick}
        >
          [{index}]
        </SupAnchor>
      </Box>
    </Tooltip>
  );
};

export default CitationLink;
