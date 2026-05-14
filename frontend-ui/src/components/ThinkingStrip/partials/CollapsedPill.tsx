/**
 * PROJ-29 Phase 1H — ThinkingStrip collapsed-pill.
 *
 * Compact summary `🔍 N Schritte · M Quellen · X.Xs`. Click toggles the
 * `<ExpandedPanel />` in the parent ThinkingStrip.
 */
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

interface CollapsedPillProps {
  stepsCount: number;
  chunksCount: number;
  durationMs: number;
  expanded: boolean;
  panelId: string;
  onToggle: () => void;
}

const PillButton = styled('button')(({ theme }) => ({
  all: 'unset',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.25, 1),
  borderRadius: 9999,
  backgroundColor: theme.vars.palette.primary.subtle,
  color: theme.vars.palette.text.secondary,
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.4,
  transition: 'background-color 150ms ease',
  '&:hover': {
    backgroundColor: theme.vars.palette.primary.subtle,
    color: theme.vars.palette.text.primary,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.vars.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

const CollapsedPill = ({
  stepsCount,
  chunksCount,
  durationMs,
  expanded,
  panelId,
  onToggle,
}: CollapsedPillProps) => {
  const { t } = useTranslation();

  // i18next plural: 'steps_one' / 'steps_other' is selected automatically when
  // the key is `pill.steps` and `count` is passed. Same for sources.
  const stepsLabel = t('chatNicheRag.thinking.pill.steps', {
    count: stepsCount,
    defaultValue_one: '{{count}} step',
    defaultValue_other: '{{count}} steps',
  });
  const sourcesLabel = t('chatNicheRag.thinking.pill.sources', {
    count: chunksCount,
    defaultValue_one: '{{count}} source',
    defaultValue_other: '{{count}} sources',
  });
  const durationText = `${(durationMs / 1000).toFixed(1)}s`;

  return (
    <Box>
      <PillButton
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={
          expanded
            ? t('chatNicheRag.thinking.collapse', 'Collapse details')
            : t('chatNicheRag.thinking.expand', 'Expand details')
        }
      >
        <span role="img" aria-hidden="true">
          🔍
        </span>
        <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
          {stepsLabel} · {sourcesLabel} · {durationText}
        </Typography>
      </PillButton>
    </Box>
  );
};

export default CollapsedPill;
