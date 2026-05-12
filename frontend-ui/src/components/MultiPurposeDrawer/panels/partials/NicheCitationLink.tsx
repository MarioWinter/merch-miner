/**
 * PROJ-29 Phase 1H-2 — `[NICHE:N]` citation marker.
 *
 * Renders as a coral pill with the index number. Hover dispatches
 * `setFlashCitation({type:'niche', index})` so the matching row in
 * ExpandedPanel (ThinkingStrip) flashes; click also scrolls the strip into
 * view. Distinct visual from the web `[N]` marker (info-blue) so users see
 * which source bank a citation belongs to (Linear/Bloomberg-style).
 */
import { Box, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setFlashCitation, clearFlashCitation } from '@/store/chatBarSlice';

interface NicheCitationLinkProps {
  index: number;
}

const useChunkNicheName = (index: number): string | undefined => {
  // PROJ-29 cross-niche: surface origin niche of the chunk in the tooltip.
  // Read live (streaming) or persisted chunks from Redux — falls back to
  // undefined when chunk isn't loaded yet (graceful tooltip degradation).
  return useAppSelector((s) => {
    const live = s.chatBar?.chunksUsed ?? [];
    if (live.length >= index) return live[index - 1]?.niche_name;
    return undefined;
  });
};

const Pill = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  fontFamily:
    "'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', ui-monospace, monospace",
  fontSize: '0.6875rem',
  fontWeight: 600,
  lineHeight: 1,
  padding: '1px 5px',
  marginInline: 2,
  borderRadius: 9999,
  backgroundColor: theme.vars.palette.primary.subtle,
  color: theme.vars.palette.primary.main,
  cursor: 'pointer',
  userSelect: 'none',
  verticalAlign: 'baseline',
  '&:hover': {
    backgroundColor: theme.vars.palette.primary.main,
    color: theme.vars.palette.primary.contrastText,
  },
}));

const NicheCitationLink = ({ index }: NicheCitationLinkProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const nicheName = useChunkNicheName(index);

  const handleEnter = () => {
    dispatch(setFlashCitation({ type: 'niche', index, ts: Date.now() }));
  };
  const handleLeave = () => {
    dispatch(clearFlashCitation());
  };
  const handleClick = () => {
    dispatch(setFlashCitation({ type: 'niche', index, ts: Date.now() }));
  };

  // Tooltip prefers a niche-scoped label when we know the origin niche.
  const tooltipLabel = nicheName
    ? t('chatNicheRag.citation.nicheWithName', { index, niche: nicheName })
    : t('chatNicheRag.citation.niche', { index });

  return (
    <Tooltip title={tooltipLabel} placement="top">
      <Pill
        as="span"
        role="button"
        tabIndex={0}
        aria-label={tooltipLabel}
        data-niche-citation={index}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onFocus={handleEnter}
        onBlur={handleLeave}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick();
        }}
      >
        🏷️ {index}
      </Pill>
    </Tooltip>
  );
};

export default NicheCitationLink;
