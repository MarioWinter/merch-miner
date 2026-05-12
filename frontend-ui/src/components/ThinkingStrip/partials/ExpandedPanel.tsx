/**
 * PROJ-29 Phase 1H — ThinkingStrip expanded panel.
 *
 * Renders the full step log + retrieved chunks (grouped by `content_subtype`)
 * with a 200ms collapse animation. `prefers-reduced-motion` skips the easing.
 */
import { useMemo } from 'react';
import {
  Box,
  Collapse,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { keyframes, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import StepRow from './StepRow';
import { getStageMeta } from '../utils/stageMeta';
import type { ChunkSubtype, ChunkUsed, ThinkingStep } from '../types/thinking';
import { DURATION, EASING, MONO_FONT_STACK } from '@/style/constants';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setFlashCitation, clearFlashCitation } from '@/store/chatBarSlice';

interface ExpandedPanelProps {
  panelId: string;
  open: boolean;
  steps: ThinkingStep[];
  chunksUsed: ChunkUsed[];
  reducedMotion?: boolean;
}

const PanelInner = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.secondary,
  marginTop: theme.spacing(0.5),
  marginBottom: theme.spacing(0.5),
}));

// PROJ-29 Phase 1H-2 — citation-flash keyframe. Skipped under prefers-reduced-motion
// (the styled() reads a runtime prop to either set or unset animation).
const citationFlash = keyframes({
  '0%': { backgroundColor: 'transparent' },
  '20%': { backgroundColor: 'var(--mm-flash-bg)' },
  '100%': { backgroundColor: 'transparent' },
});

const ChunkRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'flashing' && prop !== 'reducedMotion',
})<{ flashing: boolean; reducedMotion: boolean }>(({ theme, flashing, reducedMotion }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(0.75),
  padding: theme.spacing(0.25, 0),
  cursor: 'pointer',
  borderRadius: theme.shape.borderRadius,
  // CSS var lets keyframes use a theme-driven color while staying static.
  ['--mm-flash-bg' as string]: theme.vars.palette.warning.subtle,
  // Reduced-motion: instant highlight while flashing, no animation.
  ...(reducedMotion
    ? flashing
      ? { backgroundColor: theme.vars.palette.warning.subtle }
      : {}
    : flashing
      ? { animation: `${citationFlash} 600ms ease-out` }
      : {}),
  '&:hover': {
    backgroundColor: theme.vars.palette.background.default,
  },
}));

const Marker = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 6px',
  height: 18,
  borderRadius: 4,
  fontFamily: MONO_FONT_STACK,
  fontSize: 11,
  fontWeight: 500,
  color: theme.vars.palette.primary.main,
  backgroundColor: theme.vars.palette.primary.subtle,
  flexShrink: 0,
}));

const Snippet = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.secondary,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

const GROUP_I18N: Partial<Record<ChunkSubtype | string, string>> = {
  slogan: 'chatNicheRag.thinking.group.slogan',
  product: 'chatNicheRag.thinking.group.product',
  keyword: 'chatNicheRag.thinking.group.keyword',
  notes: 'chatNicheRag.thinking.group.notes',
  web: 'chatNicheRag.thinking.group.web',
};

const truncate = (text: string, max = 60): string =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

const ExpandedPanel = ({
  panelId,
  open,
  steps,
  chunksUsed,
  reducedMotion = false,
}: ExpandedPanelProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  // PROJ-29 Phase 1H-2 — flash subscription. Triggered by NicheCitationLink
  // (hover or click on `[NICHE:N]` marker). The flashing row matches by index.
  const flash = useAppSelector((s) => s.chatBar?.flashCitation ?? null);
  const flashingIndex = flash?.type === 'niche' ? flash.index : null;
  // Re-key the row on every flash event to re-trigger the CSS keyframe.
  const flashTs = flash?.ts ?? 0;

  // Group chunks by content_subtype. Stable iteration order matches GROUP_I18N.
  // Map key is widened to `string` because the backend may emit subtypes beyond
  // the narrow `ChunkSubtype` union (e.g. research/profile subtypes).
  const grouped = useMemo(() => {
    const map = new Map<string, ChunkUsed[]>();
    for (const chunk of chunksUsed) {
      const list = map.get(chunk.content_subtype) ?? [];
      list.push(chunk);
      map.set(chunk.content_subtype, list);
    }
    return map;
  }, [chunksUsed]);

  return (
    <Collapse
      in={open}
      id={panelId}
      timeout={reducedMotion ? 0 : DURATION.default}
      easing={EASING.standard}
      mountOnEnter
      unmountOnExit
    >
      <PanelInner>
        {steps.length > 0 && (
          <>
            <SectionLabel variant="overline">
              {t('chatNicheRag.thinking.section.steps', 'Steps log')}
            </SectionLabel>
            <Stack>
              {steps.map((step) => (
                <StepRow
                  key={`${step.stage}-${step.ts}`}
                  step={step}
                  reducedMotion={reducedMotion}
                />
              ))}
            </Stack>
          </>
        )}

        {chunksUsed.length > 0 && (
          <>
            <SectionLabel variant="overline">
              {t('chatNicheRag.thinking.section.sources', 'Sources used')}
            </SectionLabel>
            {Array.from(grouped.entries()).map(([subtype, chunks]) => {
              // Pick a representative stage meta for the group emoji. Falls
              // back to no emoji if the subtype doesn't have a stage map.
              const repStageByGroup: Partial<Record<string, string>> = {
                slogan: 'search_slogans',
                product: 'search_products',
                keyword: 'top_keywords',
                notes: 'search_niche_knowledge',
                web: 'web_search',
              };
              const emoji = getStageMeta(
                repStageByGroup[subtype] ?? 'thinking',
              ).groupEmoji;
              return (
                <Box key={subtype} sx={{ mb: 0.5 }}>
                  <SectionLabel variant="overline" sx={{ mt: 0.25 }}>
                    {emoji && (
                      <span role="img" aria-hidden="true">
                        {emoji}
                      </span>
                    )}{' '}
                    {t(GROUP_I18N[subtype] ?? subtype, subtype)}
                  </SectionLabel>
                  <Stack>
                    {chunks.map((chunk) => {
                      const isFlashing = flashingIndex === chunk.index;
                      // PROJ-29 cross-niche: show origin niche when chunk
                      // is from a niche other than the pinned one (always
                      // helpful for the user even when same — keeps the
                      // citation grounded in which niche it came from).
                      const tooltipTitle = chunk.niche_name
                        ? `${chunk.niche_name} · ${chunk.text}`
                        : chunk.text;
                      return (
                        <Tooltip key={`${chunk.index}-${isFlashing ? flashTs : 'idle'}`} title={tooltipTitle} placement="top-start">
                          <ChunkRow
                            data-chunk-index={chunk.index}
                            flashing={isFlashing}
                            reducedMotion={reducedMotion}
                            onMouseEnter={() =>
                              dispatch(setFlashCitation({ type: 'niche', index: chunk.index, ts: Date.now() }))
                            }
                            onMouseLeave={() => dispatch(clearFlashCitation())}
                          >
                            <Marker>[NICHE:{chunk.index}]</Marker>
                            <Snippet variant="body2">
                              {chunk.niche_name && (
                                <Box component="span" sx={{ color: 'primary.main', mr: 0.5, fontSize: '0.75rem' }}>
                                  {chunk.niche_name}:
                                </Box>
                              )}
                              {truncate(chunk.text)}
                            </Snippet>
                          </ChunkRow>
                        </Tooltip>
                      );
                    })}
                  </Stack>
                </Box>
              );
            })}
          </>
        )}
      </PanelInner>
    </Collapse>
  );
};

export default ExpandedPanel;
