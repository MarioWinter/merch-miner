import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Slide,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/ConfirmDialog';
import { COLORS, DURATION } from '@/style/constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAVED_TOAST_DURATION_MS = 2000;

type BannerVariant = 'unsaved' | 'saving' | 'saved' | 'failed' | 'offline';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

interface BarRootProps {
  variant: BannerVariant;
}

const variantPalette: Record<
  BannerVariant,
  { accent: string; accentShade: string }
> = {
  unsaved: { accent: COLORS.warningDk, accentShade: COLORS.warningDkShade },
  saving: { accent: COLORS.infoDk, accentShade: COLORS.infoDk },
  saved: { accent: COLORS.successDk, accentShade: COLORS.successDkShade },
  failed: { accent: COLORS.errorDk, accentShade: COLORS.errorDkShade },
  // Offline uses a dedicated orange token (#F97316) — distinct from the
  // amber "unsaved" bar so the two states read as different signals.
  offline: { accent: COLORS.orange, accentShade: COLORS.orangeShade },
};

const BarRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'variant',
})<BarRootProps>(({ theme, variant }) => {
  const { accent } = variantPalette[variant];
  return {
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingInline: theme.spacing(3),
    paddingBlock: theme.spacing(1),
    backgroundColor: alpha(accent, 0.15),
    borderBottom: `1px solid ${alpha(accent, 0.3)}`,
    color: accent,
    position: 'sticky',
    top: 0,
    zIndex: 5,
  };
});

const LeftGroup = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const DiscardButton = styled(Button)(({ theme }) => ({
  color: COLORS.warningDk,
  '&:hover': {
    backgroundColor: alpha(COLORS.warningDk, 0.08),
  },
  paddingInline: theme.spacing(1.5),
}));

const SaveButton = styled(Button)(({ theme }) => ({
  backgroundColor: COLORS.warningDk,
  color: theme.vars.palette.common.white,
  '&:hover': {
    backgroundColor: COLORS.warningDkShade,
  },
  paddingInline: theme.spacing(2),
}));

const RetryButton = styled(Button)(({ theme }) => ({
  backgroundColor: COLORS.errorDk,
  color: theme.vars.palette.common.white,
  '&:hover': {
    backgroundColor: COLORS.errorDkShade,
  },
  paddingInline: theme.spacing(2),
}));

const OfflineChip = styled(Chip)(({ theme }) => ({
  height: 24,
  // `alpha()` only accepts hex/rgb/hsl — use the resolved `theme.palette.*`
  // string, not the CSS var form. Direct colours use the CSS var.
  backgroundColor: alpha(theme.palette.orange.main, 0.2),
  color: theme.vars.palette.orange.main,
  borderColor: alpha(theme.palette.orange.main, 0.4),
  marginLeft: theme.spacing(1),
  '& .MuiChip-icon': {
    color: theme.vars.palette.orange.main,
  },
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UnsavedChangesBannerProps {
  /** Client-side dirty flag from `useEditFormState`. */
  isDirty: boolean;
  /** In-flight PATCH (any of product-config / listing / AI-improve). */
  isSaving: boolean;
  /** Last error returned by a pending save (null when none). */
  saveError: Error | null;
  /** Flush buffered text + pending debounced prices. */
  onSave: () => void | Promise<unknown>;
  /** Clear buffered text + pending prices without PATCH. */
  onDiscard: () => void;
  /**
   * Online/offline status override — lets tests drive the state without
   * touching `navigator.onLine`. Defaults to live browser value.
   */
  online?: boolean;
  /**
   * Count of PATCHes buffered in the offline queue (Phase O4). When > 0
   * while offline, the banner surfaces a "N queued" chip so the user
   * knows how many edits are pending replay.
   */
  queueLength?: number;
}

// ---------------------------------------------------------------------------
// Hook — online status
// ---------------------------------------------------------------------------

const useOnlineStatus = (override?: boolean) => {
  const [liveOnline, setLiveOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    // Override handled via derived value below — no listener needed.
    if (typeof override === 'boolean') return;
    const onOnline = () => setLiveOnline(true);
    const onOffline = () => setLiveOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [override]);

  return typeof override === 'boolean' ? override : liveOnline;
};

// ---------------------------------------------------------------------------
// Hook — "Saved" toast auto-hide
// ---------------------------------------------------------------------------

/**
 * Tracks a short-lived "Saved" window after a save transitions from
 * `isSaving → !isSaving` without an error. Auto-dismisses after
 * `SAVED_TOAST_DURATION_MS`. Returns `true` while the toast should render.
 *
 * Uses the "derive state from prop + on-change event" pattern rather than
 * setState-in-effect: the previous `isSaving` value lives in state and is
 * updated as part of the same render that flips `showSaved` on.
 * See react-hooks/set-state-in-effect.
 */
const useSavedToast = (isSaving: boolean, hasError: boolean) => {
  const [showSaved, setShowSaved] = useState(false);
  const [prevIsSaving, setPrevIsSaving] = useState(isSaving);

  // Derived transition detection (no setState in effect):
  //   prev=true + now=false + !hasError  →  trigger toast.
  // We set state during render, which React supports as long as it's guarded
  // by an equality check against the previous value.
  if (prevIsSaving !== isSaving) {
    setPrevIsSaving(isSaving);
    if (prevIsSaving && !isSaving && !hasError) {
      setShowSaved(true);
    }
  }

  // Auto-hide timer lives in its own effect, which only runs when
  // `showSaved` flips true. setTimeout → setShowSaved(false) in the
  // callback is allowed (setState is async and inside a timer callback,
  // not the effect body).
  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(
      () => setShowSaved(false),
      SAVED_TOAST_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [showSaved]);

  return showSaved;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UnsavedChangesBanner = ({
  isDirty,
  isSaving,
  saveError,
  onSave,
  onDiscard,
  online,
  queueLength = 0,
}: UnsavedChangesBannerProps) => {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasError = Boolean(saveError);
  const isOnline = useOnlineStatus(online);
  const showSaved = useSavedToast(isSaving, hasError);
  const hasQueuedWork = queueLength > 0;

  // Priority: offline > failed > saving > saved toast > unsaved. While
  // offline, a non-empty queue is enough to surface the banner — even if
  // the dirty/saving/error flags are false (e.g. right after a reload).
  const variant: BannerVariant | null = useMemo(() => {
    if (!isOnline && (isDirty || isSaving || hasError || hasQueuedWork))
      return 'offline';
    if (hasError) return 'failed';
    if (isSaving) return 'saving';
    if (showSaved) return 'saved';
    if (isDirty) return 'unsaved';
    return null;
  }, [isOnline, isDirty, isSaving, hasError, hasQueuedWork, showSaved]);

  const visible = variant !== null;

  const handleDiscardClick = () => setConfirmOpen(true);
  const handleConfirmDiscard = () => {
    setConfirmOpen(false);
    onDiscard();
  };
  const handleCancelDiscard = () => setConfirmOpen(false);

  const renderContent = () => {
    switch (variant) {
      case 'saving':
        return (
          <>
            <LeftGroup>
              <CircularProgress size={16} color="inherit" aria-hidden />
              <Typography variant="subtitle2" component="span">
                {t('publish.edit.unsaved.saving', {
                  defaultValue: 'Saving...',
                })}
              </Typography>
            </LeftGroup>
            <Box />
          </>
        );
      case 'saved':
        return (
          <>
            <LeftGroup>
              <CheckCircleOutlineIcon sx={{ fontSize: 20 }} aria-hidden />
              <Typography variant="subtitle2" component="span">
                {t('publish.edit.unsaved.saved', { defaultValue: 'Saved' })}
              </Typography>
            </LeftGroup>
            <Box />
          </>
        );
      case 'failed':
        return (
          <>
            <LeftGroup>
              <ErrorOutlineIcon sx={{ fontSize: 20 }} aria-hidden />
              <Typography variant="subtitle2" component="span">
                {t('publish.edit.unsaved.failed', {
                  defaultValue: 'Save failed',
                })}
              </Typography>
            </LeftGroup>
            <LeftGroup>
              <RetryButton
                variant="contained"
                size="small"
                onClick={() => void onSave()}
              >
                {t('publish.edit.unsaved.retry', { defaultValue: 'Retry' })}
              </RetryButton>
            </LeftGroup>
          </>
        );
      case 'offline':
        return (
          <>
            <LeftGroup>
              <CloudOffOutlinedIcon sx={{ fontSize: 20 }} aria-hidden />
              <Typography variant="subtitle2" component="span">
                {t('publish.edit.unsaved.offline', {
                  defaultValue:
                    'You are offline — changes will sync when you reconnect',
                })}
              </Typography>
              <OfflineChip
                size="small"
                variant="outlined"
                icon={<CloudOffOutlinedIcon sx={{ fontSize: 14 }} />}
                label={t('publish.edit.unsaved.offlineChip', {
                  defaultValue: 'Offline',
                })}
              />
              {hasQueuedWork && (
                <OfflineChip
                  size="small"
                  variant="outlined"
                  data-testid="UnsavedChangesBanner-queueChip"
                  label={t('publish.edit.unsaved.queued', {
                    defaultValue: '{{count}} queued',
                    count: queueLength,
                  })}
                />
              )}
            </LeftGroup>
            <Box />
          </>
        );
      case 'unsaved':
        return (
          <>
            <LeftGroup>
              <WarningAmberOutlinedIcon sx={{ fontSize: 20 }} aria-hidden />
              <Typography variant="subtitle2" component="span">
                {t('publish.edit.unsaved.message', {
                  defaultValue: 'Unsaved changes',
                })}
              </Typography>
              {!isOnline && (
                <OfflineChip
                  size="small"
                  variant="outlined"
                  icon={<CloudOffOutlinedIcon sx={{ fontSize: 14 }} />}
                  label={t('publish.edit.unsaved.offlineChip', {
                    defaultValue: 'Offline',
                  })}
                />
              )}
            </LeftGroup>
            <LeftGroup>
              <DiscardButton
                variant="text"
                size="small"
                onClick={handleDiscardClick}
              >
                {t('publish.edit.unsaved.discard', { defaultValue: 'Discard' })}
              </DiscardButton>
              <SaveButton
                variant="contained"
                size="small"
                onClick={() => void onSave()}
              >
                {t('publish.edit.unsaved.save', { defaultValue: 'Save' })}
              </SaveButton>
            </LeftGroup>
          </>
        );
      default:
        // Null variant — Slide may still be running the exit animation.
        // Render nothing so the exiting bar shows as empty rather than
        // flashing stale content (e.g. the "unsaved" CTA row).
        return null;
    }
  };

  return (
    <>
      <Slide
        in={visible}
        direction="down"
        mountOnEnter
        unmountOnExit
        timeout={DURATION.default}
      >
        <BarRoot
          role="status"
          aria-live="polite"
          variant={variant ?? 'unsaved'}
          data-testid="UnsavedChangesBanner"
          data-variant={variant ?? 'idle'}
        >
          {renderContent()}
        </BarRoot>
      </Slide>

      <ConfirmDialog
        open={confirmOpen}
        title={t('publish.edit.unsaved.confirmDiscardTitle', {
          defaultValue: 'Discard unsaved changes?',
        })}
        body={t('publish.edit.unsaved.confirmDiscardBody', {
          defaultValue:
            'Your pending edits will be cleared. This cannot be undone.',
        })}
        confirmLabel={t('publish.edit.unsaved.discard', {
          defaultValue: 'Discard',
        })}
        cancelLabel={t('publish.edit.unsaved.cancel', {
          defaultValue: 'Cancel',
        })}
        confirmColor="warning"
        showDeleteIcon={false}
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscard}
      />
    </>
  );
};

export default UnsavedChangesBanner;
