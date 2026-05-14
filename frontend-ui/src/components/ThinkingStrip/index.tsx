/**
 * PROJ-29 Phase 1H — ThinkingStrip (full variant).
 *
 * Renders inside `<AssistantBubble>` above `<MarkdownAnswer>`. Three states:
 *   - Active (isStreaming=true): list of `<StepRow />`s for the current turn.
 *   - Collapsed pill (isStreaming=false, persisted data): click → expand.
 *   - Expanded panel: step log + chunks_used grouped by content_subtype.
 *
 * Backend persistence of ThinkingStep+ChunkUsed metadata lands in Phase 1I.
 * Until then, persisted messages render nothing (no stored thinking metadata).
 */
import { useId, useMemo, useState } from 'react';
import { Box, Stack, useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import StepRow from './partials/StepRow';
import CollapsedPill from './partials/CollapsedPill';
import ExpandedPanel from './partials/ExpandedPanel';
import { useThinkingState } from './hooks/useThinkingState';
import { getStageMeta } from './utils/stageMeta';
import type { ChunkUsed, ThinkingStep } from './types/thinking';

interface ThinkingStripProps {
  /** Stable id for the message — used to namespace the aria-controls id. */
  messageId: string;
  /** True while the SSE stream is in flight for THIS message. */
  isStreaming: boolean;
  /** Persisted step log for re-opened sessions (Phase 1I). */
  persistedSteps?: ThinkingStep[];
  /** Persisted chunks_used for re-opened sessions (Phase 1I). */
  persistedChunksUsed?: ChunkUsed[];
  /** Persisted total duration for the collapsed pill (Phase 1I). */
  persistedDurationMs?: number;
}

const ActiveContainer = styled(Box)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 1,
  backgroundColor: theme.vars.palette.background.paper,
  padding: theme.spacing(0.75, 1.25),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  borderTopLeftRadius: 4,
  borderTopRightRadius: 14,
  marginBottom: theme.spacing(0.5),
}));

const VisuallyHidden = styled('span')({
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
});

const ThinkingStrip = ({
  messageId,
  isStreaming,
  persistedSteps,
  persistedChunksUsed,
  persistedDurationMs,
}: ThinkingStripProps) => {
  const { t } = useTranslation();
  const prefersReducedMotion = useMediaQuery(
    '(prefers-reduced-motion: reduce)',
  );
  const live = useThinkingState();
  const [expanded, setExpanded] = useState(false);
  const panelId = `${useId()}-thinking-${messageId}`;

  // Choose which dataset to render: live state while streaming, otherwise the
  // persisted snapshot passed in by the parent.
  const steps = isStreaming ? live.steps : persistedSteps ?? [];
  const chunksUsed = isStreaming
    ? live.chunksUsed
    : persistedChunksUsed ?? [];
  const durationMs = isStreaming
    ? live.totalDurationMs
    : persistedDurationMs ?? 0;

  // Screen-reader announcement of the currently active stage.
  const ariaLiveText = useMemo(() => {
    if (!isStreaming) return '';
    if (!live.currentLoadingStage) return '';
    const meta = getStageMeta(live.currentLoadingStage);
    return meta.i18nKey ? t(meta.i18nKey, live.currentLoadingStage) : live.currentLoadingStage;
  }, [isStreaming, live.currentLoadingStage, t]);

  // --- Active (streaming) variant ---
  if (isStreaming) {
    if (steps.length === 0) {
      return null;
    }
    return (
      <ActiveContainer data-testid="thinking-strip-active">
        <VisuallyHidden
          aria-live="polite"
          aria-atomic="true"
        >
          {ariaLiveText
            ? t('chatNicheRag.thinking.aria.live', { stage: ariaLiveText, defaultValue: 'Working on: {{stage}}' })
            : ''}
        </VisuallyHidden>
        <Stack>
          {steps.map((step) => (
            <StepRow
              key={`${step.stage}-${step.ts}`}
              step={step}
              reducedMotion={prefersReducedMotion}
            />
          ))}
        </Stack>
      </ActiveContainer>
    );
  }

  // --- Persisted (done) variants ---
  if (steps.length === 0 && chunksUsed.length === 0) {
    // TODO(PROJ-29 Phase 1I): backend persistence pending — assistant
    // messages re-opened from history have no stored thinking metadata yet.
    // Once `ChatMessageSerializer` exposes `thinking_steps` + `chunks_used`,
    // wire them via the parent and remove this branch.
    return null;
  }

  return (
    <Box sx={{ mb: 0.5 }} data-testid="thinking-strip-persisted">
      <CollapsedPill
        stepsCount={steps.length}
        chunksCount={chunksUsed.length}
        durationMs={durationMs}
        expanded={expanded}
        panelId={panelId}
        onToggle={() => setExpanded((v) => !v)}
      />
      <ExpandedPanel
        panelId={panelId}
        open={expanded}
        steps={steps}
        chunksUsed={chunksUsed}
        reducedMotion={prefersReducedMotion}
      />
    </Box>
  );
};

export default ThinkingStrip;
