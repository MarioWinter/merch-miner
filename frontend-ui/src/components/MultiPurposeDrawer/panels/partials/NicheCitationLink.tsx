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
import { useAppDispatch } from '@/store/hooks';
import { setFlashCitation, clearFlashCitation } from '@/store/chatBarSlice';

interface NicheCitationLinkProps {
  index: number;
}

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

  const handleEnter = () => {
    dispatch(setFlashCitation({ type: 'niche', index, ts: Date.now() }));
  };
  const handleLeave = () => {
    dispatch(clearFlashCitation());
  };
  const handleClick = () => {
    dispatch(setFlashCitation({ type: 'niche', index, ts: Date.now() }));
  };

  return (
    <Tooltip title={t('chatNicheRag.citation.niche', { index })} placement="top">
      <Pill
        as="span"
        role="button"
        tabIndex={0}
        aria-label={t('chatNicheRag.citation.niche', { index })}
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
