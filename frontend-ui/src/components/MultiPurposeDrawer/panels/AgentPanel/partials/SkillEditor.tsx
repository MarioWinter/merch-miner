/**
 * PROJ-18 Phase 14.6 — AC-77 + Phase 14.7 EC-19
 *
 * Skill content editor with patch-or-replace toggle. Sends PATCH with
 * `expected_version`; on 409 (version conflict), surfaces a snackbar
 * with a "Reload" button — does NOT auto-merge.
 */
import { useCallback, useState } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Tabs,
  Tab,
  Box,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import ReactMarkdown from 'react-markdown';
import { usePatchSkillMutation } from '@/store/agentSlice';
import type { Skill } from '@/types/agent';

const PreviewBody = styled(Box)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.vars.palette.text.primary,
  padding: theme.spacing(1),
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  minHeight: 200,
  '& p': { margin: theme.spacing(0.5, 0) },
  '& ul, & ol': { paddingLeft: theme.spacing(2.5) },
  '& code': {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.75rem',
    padding: '1px 4px',
    borderRadius: 3,
    backgroundColor: theme.vars.palette.action.hover,
  },
}));

type Mode = 'patch' | 'replace';

interface SkillEditorProps {
  skill: Skill;
  onSaved: () => void;
  onCancel: () => void;
}

const SkillEditor = ({ skill, onSaved, onCancel }: SkillEditorProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [patchSkill, { isLoading: saving }] = usePatchSkillMutation();

  const [mode, setMode] = useState<Mode>('patch');
  const [body, setBody] = useState('');
  const [summary, setSummary] = useState('');
  const [previewTab, setPreviewTab] = useState(0);

  const previewContent =
    mode === 'replace'
      ? body
      : `${skill.content_md}\n\n${body}`;

  const handleSave = useCallback(async () => {
    try {
      await patchSkill({
        id: skill.id,
        body: {
          patch_md: body,
          expected_version: skill.version,
          patch_summary: summary,
        },
      }).unwrap();
      enqueueSnackbar(t('agent.skills.saved'), { variant: 'success' });
      onSaved();
    } catch (err) {
      // EC-19: 409 conflict — surface a reload action instead of auto-merging.
      const e = err as { status?: number; data?: { error?: string } };
      if (e?.status === 409 || e?.data?.error === 'version_conflict') {
        enqueueSnackbar(t('agent.skills.versionConflict'), {
          variant: 'warning',
          persist: true,
          action: (key) => (
            <Button
              size="small"
              color="inherit"
              onClick={() => {
                window.location.reload();
                // notistack types: closeSnackbar callback would normally be wired,
                // we simply trigger a reload which will re-fetch the latest skill.
                void key;
              }}
            >
              {t('agent.skills.reload')}
            </Button>
          ),
        });
      } else {
        enqueueSnackbar(t('agent.skills.saveError'), { variant: 'error' });
      }
    }
  }, [body, summary, skill.id, skill.version, patchSkill, enqueueSnackbar, t, onSaved]);

  return (
    <Stack gap={1.5}>
      <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, v) => v && setMode(v)}
          aria-label="Skill edit mode"
        >
          <ToggleButton value="patch">
            {t('agent.skills.patchMode')}
          </ToggleButton>
          <ToggleButton value="replace">
            {t('agent.skills.replaceMode')}
          </ToggleButton>
        </ToggleButtonGroup>
        <Chip
          size="small"
          label={t('agent.skills.version', { version: skill.version })}
          variant="outlined"
        />
      </Stack>

      <TextField
        size="small"
        label={t('agent.skills.patchSummary')}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 500 } }}
      />

      <Tabs
        value={previewTab}
        onChange={(_, v: number) => setPreviewTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Edit" />
        <Tab label="Preview" />
      </Tabs>

      {previewTab === 0 ? (
        <TextField
          value={body}
          onChange={(e) => setBody(e.target.value)}
          multiline
          minRows={10}
          maxRows={24}
          fullWidth
          placeholder={
            mode === 'patch'
              ? '# Append/diff content here'
              : '# Full skill body (replace mode)'
          }
          slotProps={{
            htmlInput: {
              'aria-label': 'Skill content editor',
              'data-testid': 'skill-editor-textarea',
            },
          }}
        />
      ) : (
        <PreviewBody>
          {previewContent.trim() ? (
            <ReactMarkdown>{previewContent}</ReactMarkdown>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {t('agent.skills.empty')}
            </Typography>
          )}
        </PreviewBody>
      )}

      <Stack direction="row" justifyContent="flex-end" gap={0.5}>
        <Button size="small" onClick={onCancel} disabled={saving}>
          {t('agent.skills.cancel')}
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={handleSave}
          disabled={saving || !body.trim()}
        >
          {t('agent.skills.save')}
        </Button>
      </Stack>
    </Stack>
  );
};

export default SkillEditor;
