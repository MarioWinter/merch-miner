/**
 * PROJ-18 Phase 14.6 — AC-78
 *
 * Singleton workspace memory editor with live char-counter.
 * - Read-only by default; "Edit memory" toggle enters edit mode.
 * - Color-coded char-counter (warn / critical / over-limit).
 * - Save disabled when content exceeds char_limit.
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Button,
  Box,
  Skeleton,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import ReactMarkdown from 'react-markdown';
import {
  useGetMemoryQuery,
  usePatchMemoryMutation,
} from '@/store/agentSlice';
import {
  MEMORY_CHAR_LIMIT_DEFAULT,
  MEMORY_CHAR_WARN,
  MEMORY_CHAR_CRITICAL,
} from '@/types/agent';

const CharCounterText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'tone',
})<{ tone: 'normal' | 'warn' | 'critical' | 'over' }>(({ theme, tone }) => ({
  fontSize: '0.75rem',
  fontFamily: 'JetBrains Mono, monospace',
  color:
    tone === 'over'
      ? theme.vars.palette.error.main
      : tone === 'critical'
        ? theme.vars.palette.error.main
        : tone === 'warn'
          ? theme.vars.palette.warning.main
          : theme.vars.palette.text.secondary,
  fontWeight: tone === 'normal' ? 400 : 600,
}));

const PreviewWrapper = styled(Box)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.vars.palette.text.primary,
  whiteSpace: 'pre-wrap',
  '& p': { margin: theme.spacing(0.5, 0) },
  '& ul, & ol': { paddingLeft: theme.spacing(2.5), margin: theme.spacing(0.5, 0) },
  '& code': {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.75rem',
    padding: '1px 4px',
    borderRadius: 3,
    backgroundColor: theme.vars.palette.action.hover,
  },
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

const draftStorageKey = (memoryId: string | undefined): string | null =>
  memoryId ? `memoryEditor.draft.${memoryId}` : null;

const MemoryEditor = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data: memory, isLoading } = useGetMemoryQuery();
  const [patchMemory, { isLoading: saving }] = usePatchMemoryMutation();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // Latest values held in refs so the cleanup effect always sees current
  // state without re-running on every keystroke.
  const draftRef = useRef(draft);
  const editingRef = useRef(editing);
  const memoryIdRef = useRef<string | undefined>(memory?.id);
  const memoryContentRef = useRef<string>(memory?.content_md ?? '');

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  useEffect(() => {
    memoryIdRef.current = memory?.id;
    memoryContentRef.current = memory?.content_md ?? '';
  }, [memory?.id, memory?.content_md]);

  // When fresh data arrives and we're not editing, sync the local draft.
  // If a stored draft exists for this memory id (e.g. user switched tabs
  // mid-edit), restore it and re-enter edit mode.
  useEffect(() => {
    if (!memory || editing) return;
    const key = draftStorageKey(memory.id);
    const stored = key ? window.localStorage.getItem(key) : null;
    if (stored !== null && stored !== (memory.content_md ?? '')) {
      setDraft(stored);
      setEditing(true);
      enqueueSnackbar(t('agent.memory.draftRestored'), { variant: 'info' });
    } else {
      setDraft(memory.content_md ?? '');
    }
  }, [memory, editing, enqueueSnackbar, t]);

  // On unmount: persist any unsaved draft to localStorage so the user does
  // not silently lose work when switching tabs.
  useEffect(() => {
    return () => {
      const key = draftStorageKey(memoryIdRef.current);
      if (!key) return;
      if (editingRef.current && draftRef.current !== memoryContentRef.current) {
        window.localStorage.setItem(key, draftRef.current);
      }
    };
  }, []);

  const charLimit = memory?.char_limit ?? MEMORY_CHAR_LIMIT_DEFAULT;
  const charCount = draft.length;
  const tone = useMemo(
    () => computeTone(charCount, charLimit, MEMORY_CHAR_WARN, MEMORY_CHAR_CRITICAL),
    [charCount, charLimit],
  );
  const overLimit = charCount > charLimit;

  const clearStoredDraft = useCallback(() => {
    const key = draftStorageKey(memory?.id);
    if (key) window.localStorage.removeItem(key);
  }, [memory?.id]);

  const handleSave = useCallback(async () => {
    try {
      await patchMemory({ content_md: draft }).unwrap();
      enqueueSnackbar(t('agent.memory.saved'), { variant: 'success' });
      clearStoredDraft();
      setEditing(false);
    } catch {
      enqueueSnackbar(t('agent.memory.saveError'), { variant: 'error' });
    }
  }, [draft, patchMemory, enqueueSnackbar, t, clearStoredDraft]);

  const handleCancel = useCallback(() => {
    setDraft(memory?.content_md ?? '');
    clearStoredDraft();
    setEditing(false);
  }, [memory, clearStoredDraft]);

  if (isLoading) {
    return (
      <Stack gap={1} sx={{ p: 2 }}>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="rounded" height={180} />
      </Stack>
    );
  }

  const lastConsolidated = memory?.last_consolidated_at
    ? new Date(memory.last_consolidated_at).toLocaleString()
    : null;

  return (
    <Stack gap={1.5} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">{t('agent.memory.title')}</Typography>
        {!editing && (
          <Button
            size="small"
            startIcon={<EditIcon sx={{ fontSize: 16 }} />}
            onClick={() => setEditing(true)}
          >
            {t('agent.memory.edit')}
          </Button>
        )}
      </Stack>

      <Typography variant="caption" color="text.secondary">
        {t('agent.memory.description')}
      </Typography>

      <Typography variant="caption" color="text.secondary">
        {lastConsolidated
          ? t('agent.memory.lastConsolidated', { when: lastConsolidated })
          : t('agent.memory.lastConsolidatedNever')}
      </Typography>

      {editing ? (
        <Stack gap={1}>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            multiline
            minRows={10}
            maxRows={20}
            fullWidth
            size="small"
            error={overLimit}
            slotProps={{
              htmlInput: {
                'aria-label': t('agent.memory.title'),
                'data-testid': 'memory-textarea',
              },
            }}
          />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <CharCounterText tone={tone} aria-live="polite">
              {t('agent.memory.charCounter', {
                count: charCount,
                limit: charLimit,
              })}
              {overLimit && ` — ${t('agent.memory.overLimit', { limit: charLimit })}`}
            </CharCounterText>
            <Stack direction="row" gap={0.5}>
              <Button size="small" onClick={handleCancel} disabled={saving}>
                {t('agent.memory.cancel')}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleSave}
                disabled={overLimit || saving}
              >
                {t('agent.memory.save')}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      ) : (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            {(memory?.content_md ?? '').trim() ? (
              <PreviewWrapper>
                <ReactMarkdown>{memory?.content_md ?? ''}</ReactMarkdown>
              </PreviewWrapper>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {t('agent.memory.empty')}
              </Typography>
            )}
            <Divider sx={{ my: 1 }} />
            <CharCounterText tone={tone}>
              {t('agent.memory.charCounter', {
                count: memory?.content_md?.length ?? 0,
                limit: charLimit,
              })}
            </CharCounterText>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};

export default MemoryEditor;
