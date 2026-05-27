// PROJ-34 Phase 13t-j — Best-of-Mix row (3 cards: Most-Common / Edgy / Safe).
// Header has "Neu berechnen" IconButton (AC-89) firing regenerateMix mutation
// with notistack feedback (429 rate-limit handled per EC-46).
// Polling: when a mix is null (cache miss / generating), refetch every 3s for up
// to 60s, then fall through to error chip per EC-35.

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { skipToken } from '@reduxjs/toolkit/query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useGetVorschlaegeQuery,
  useRegenerateMixMutation,
} from '@/services/presetCardsApi';
import NichePresetCard, { type AnyPresetCard } from './NichePresetCard';
import type { NichePresetTopCardDict } from '@/types/nichePreset';

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_DURATION_MS = 60_000;
const MIX_VARIANTS = ['most_common', 'edgy', 'safe'] as const;
type MixVariant = (typeof MIX_VARIANTS)[number];

interface BestOfMixRowProps {
  nicheId: string | null;
  onCardClick?: (card: AnyPresetCard) => void;
}

const BestOfMixRow = ({ nicheId, onCardClick }: BestOfMixRowProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Track elapsed polling time so we can stop after 60s. State updates only
  // happen from async timer callbacks (not in effect body) to satisfy
  // react-hooks/set-state-in-effect. Reset path on mix-appears uses a ref.
  const [pollExhausted, setPollExhausted] = useState(false);
  const pollStartedAt = useRef<number | null>(null);
  const pollExhaustedRef = useRef(pollExhausted);
  useEffect(() => {
    pollExhaustedRef.current = pollExhausted;
  }, [pollExhausted]);

  const queryArg = nicheId ? { nicheId } : skipToken;

  const { data, isLoading, isError, refetch } = useGetVorschlaegeQuery(queryArg);

  const anyMixMissing =
    !!data &&
    (data.best_of_mix.most_common === null ||
      data.best_of_mix.edgy === null ||
      data.best_of_mix.safe === null);

  // Polling loop: only runs while at least one Mix is missing and we have not
  // exhausted the 60s budget. Setting `pollExhausted` happens inside the timer
  // callback (async) — not synchronously during effect body — which keeps lint
  // happy and avoids cascading renders.
  useEffect(() => {
    if (!nicheId || !anyMixMissing || pollExhausted) {
      return;
    }
    if (pollStartedAt.current === null) {
      pollStartedAt.current = Date.now();
    }
    const id = window.setInterval(() => {
      const elapsed = Date.now() - (pollStartedAt.current ?? Date.now());
      if (elapsed >= POLL_MAX_DURATION_MS) {
        setPollExhausted(true);
        window.clearInterval(id);
        return;
      }
      refetch();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [nicheId, anyMixMissing, pollExhausted, refetch]);

  // Reset polling cursor whenever the missing-state flips off. Driven by data
  // change (not by setState in effect) — only mutates a ref.
  useEffect(() => {
    if (!anyMixMissing) {
      pollStartedAt.current = null;
    }
  }, [anyMixMissing]);

  const [regenerate, { isLoading: regenLoading }] = useRegenerateMixMutation();

  const handleRegenerate = async () => {
    if (!nicheId) return;
    try {
      await regenerate({ niche_id: nicheId }).unwrap();
      pollStartedAt.current = null;
      setPollExhausted(false);
      enqueueSnackbar(
        t('designForge.builder.nichePresets.regenerateSuccess'),
        { variant: 'success' },
      );
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null && 'status' in err
          ? (err as { status?: number }).status
          : undefined;
      if (status === 429) {
        enqueueSnackbar(
          t('designForge.builder.nichePresets.regenerateRateLimited'),
          { variant: 'warning' },
        );
      } else {
        enqueueSnackbar(
          t('designForge.builder.nichePresets.regenerateError'),
          { variant: 'error' },
        );
      }
    }
  };

  if (!nicheId) return null;

  const handleCardClick = (card: AnyPresetCard) => {
    onCardClick?.(card);
  };

  const variants: { key: MixVariant; card: NichePresetTopCardDict | null }[] =
    MIX_VARIANTS.map((key) => ({
      key,
      card: data?.best_of_mix[key] ?? null,
    }));

  // EC-42 — Mix cards click-disabled while regenerating.
  const mixDisabled = regenLoading || anyMixMissing;

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle1">
          {t('designForge.builder.nichePresets.bestOfMix')}
        </Typography>
        <Tooltip title={t('designForge.builder.nichePresets.regenerateTooltip')}>
          <span>
            <IconButton
              onClick={handleRegenerate}
              disabled={regenLoading || !nicheId}
              size="small"
              aria-label={t('designForge.builder.nichePresets.regenerateTooltip')}
            >
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {isError && !data && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('designForge.builder.nichePresets.errorLoading')}
        </Alert>
      )}

      {pollExhausted && anyMixMissing && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('designForge.builder.nichePresets.mixGenerationTimeout')}
        </Alert>
      )}

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {variants.map(({ key, card }) => {
          const showSkeleton = isLoading || (card === null && !pollExhausted);
          if (showSkeleton) {
            return (
              <Skeleton
                key={key}
                variant="rectangular"
                width={200}
                height={244}
                data-testid={`mix-skeleton-${key}`}
              />
            );
          }
          if (!card) {
            return (
              <Box
                key={key}
                sx={{
                  width: 200,
                  height: 244,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  —
                </Typography>
              </Box>
            );
          }
          const labeledCard: NichePresetTopCardDict = {
            ...card,
            preset_label: t(
              `designForge.builder.nichePresets.mixLabels.${key}`,
            ),
          };
          return (
            <NichePresetCard
              key={key}
              card={labeledCard}
              onClick={handleCardClick}
              disabled={mixDisabled}
              wide
            />
          );
        })}
      </Stack>
    </Box>
  );
};

export default BestOfMixRow;
