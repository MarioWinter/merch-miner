/**
 * PROJ-18 Phase 14.6 — AC-79
 *
 * Per-user, per-workspace profile editor.
 * - Markdown textarea (max profile_char_limit, color-coded counter)
 * - Collapsible read-only "Dialect reasoning" section (last reasoning trace)
 * - Reset button with confirm dialog
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Button,
  Box,
  Skeleton,
  Collapse,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useGetProfileQuery,
  usePatchProfileMutation,
} from '@/store/agentSlice';
import {
  PROFILE_CHAR_LIMIT_DEFAULT,
  PROFILE_CHAR_WARN,
  PROFILE_CHAR_CRITICAL,
} from '@/types/agent';

const CharCounterText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'tone',
})<{ tone: 'normal' | 'warn' | 'critical' | 'over' }>(({ theme, tone }) => ({
  fontSize: '0.75rem',
  fontFamily: 'JetBrains Mono, monospace',
  color:
    tone === 'over' || tone === 'critical'
      ? theme.vars.palette.error.main
      : tone === 'warn'
        ? theme.vars.palette.warning.main
        : theme.vars.palette.text.secondary,
  fontWeight: tone === 'normal' ? 400 : 600,
}));

const ReasoningBlock = styled(Box)(({ theme }) => ({
  whiteSpace: 'pre-wrap',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.75rem',
  lineHeight: 1.5,
  color: theme.vars.palette.text.secondary,
  backgroundColor: theme.vars.palette.action.hover,
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  maxHeight: 240,
  overflowY: 'auto',
}));

const computeTone = (
  count: number,
  limit: number,
  warn: number,
  critical: number,
): 'normal' | 'warn' | 'critical' | 'over' => {
  if (count > limit) return 'over';
  if (count >= critical) return 'critical';
  if (count >= warn) return 'warn';
  return 'normal';
};

const UserProfileEditor = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data: profile, isLoading } = useGetProfileQuery({
    include_reasoning: true,
  });
  const [patchProfile, { isLoading: saving }] = usePatchProfileMutation();

  const [draft, setDraft] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Sync local draft when fresh profile data arrives from the server.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile) setDraft(profile.content_md ?? '');
  }, [profile]);

  const charLimit = profile?.char_limit ?? PROFILE_CHAR_LIMIT_DEFAULT;
  const charCount = draft.length;
  const tone = useMemo(
    () =>
      computeTone(charCount, charLimit, PROFILE_CHAR_WARN, PROFILE_CHAR_CRITICAL),
    [charCount, charLimit],
  );
  const overLimit = charCount > charLimit;
  const dirty = (profile?.content_md ?? '') !== draft;

  const handleSave = useCallback(async () => {
    try {
      await patchProfile({ content_md: draft }).unwrap();
      enqueueSnackbar(t('agent.profile.saved'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('agent.profile.saveError'), { variant: 'error' });
    }
  }, [draft, patchProfile, enqueueSnackbar, t]);

  const handleReset = useCallback(async () => {
    setConfirmReset(false);
    try {
      await patchProfile({ content_md: '' }).unwrap();
      setDraft('');
      enqueueSnackbar(t('agent.profile.saved'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('agent.profile.saveError'), { variant: 'error' });
    }
  }, [patchProfile, enqueueSnackbar, t]);

  if (isLoading) {
    return (
      <Stack gap={1} sx={{ p: 2 }}>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="rounded" height={140} />
      </Stack>
    );
  }

  const lastDialectic = profile?.last_dialectic_at
    ? new Date(profile.last_dialectic_at).toLocaleString()
    : null;
  const reasoning = profile?.dialect_reasoning ?? '';

  return (
    <Stack gap={1.5} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">{t('agent.profile.title')}</Typography>
        <Button
          size="small"
          color="error"
          startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
          onClick={() => setConfirmReset(true)}
        >
          {t('agent.profile.reset')}
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {t('agent.profile.description')}
      </Typography>

      <Typography variant="caption" color="text.secondary">
        {lastDialectic
          ? t('agent.profile.lastDialectic', { when: lastDialectic })
          : t('agent.profile.lastDialecticNever')}
      </Typography>

      <TextField
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        multiline
        minRows={6}
        maxRows={16}
        fullWidth
        size="small"
        placeholder={t('agent.profile.empty')}
        error={overLimit}
        slotProps={{
          htmlInput: {
            'aria-label': t('agent.profile.title'),
            'data-testid': 'profile-textarea',
          },
        }}
      />

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <CharCounterText tone={tone} aria-live="polite">
          {t('agent.profile.charCounter', {
            count: charCount,
            limit: charLimit,
          })}
          {overLimit && ` — ${t('agent.profile.overLimit', { limit: charLimit })}`}
        </CharCounterText>
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          disabled={overLimit || saving || !dirty}
        >
          {t('agent.profile.save')}
        </Button>
      </Stack>

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ cursor: 'pointer' }}
            onClick={() => setShowReasoning((v) => !v)}
            role="button"
            aria-expanded={showReasoning}
            aria-controls="dialect-reasoning-content"
          >
            <Stack>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {t('agent.profile.dialectReasoning')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('agent.profile.dialectReasoningHint')}
              </Typography>
            </Stack>
            <IconButton size="small" aria-label={t('agent.profile.dialectReasoning')}>
              {showReasoning ? (
                <ExpandLessIcon sx={{ fontSize: 18 }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Stack>
          <Collapse in={showReasoning} unmountOnExit>
            <Box id="dialect-reasoning-content" sx={{ mt: 1 }}>
              {reasoning.trim() ? (
                <ReasoningBlock>{reasoning}</ReasoningBlock>
              ) : (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic' }}
                >
                  {t('agent.profile.dialectReasoningEmpty')}
                </Typography>
              )}
            </Box>
          </Collapse>
        </CardContent>
      </Card>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)}>
        <DialogTitle>{t('agent.profile.reset')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t('agent.profile.resetConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReset(false)}>
            {t('agent.profile.resetCancel')}
          </Button>
          <Button color="error" variant="contained" onClick={handleReset}>
            {t('agent.profile.resetConfirmAction')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default UserProfileEditor;
