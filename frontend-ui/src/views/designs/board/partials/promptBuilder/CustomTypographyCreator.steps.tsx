// PROJ-34 Phase 13t-m — Step 2 (Analyze) + Step 3 (Name & Save) for the
// CustomTypographyCreator wizard. Mirrors CustomSpatialCreator.steps.tsx 1:1
// modulo the typography wording + error codes (typography_unclear /
// typography_analysis_failed / analyzer_unavailable). See backend
// CustomTypographyAnalyzeView (design_app/api/views.py:2410+).

import {
  Alert,
  Box,
  Button,
  Skeleton,
  Stack,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PreviewBox, type SourceSelection } from './CustomTypographyCreator.shared';

// ===========================================================================
// Step 2 — Analyze
// ===========================================================================

interface AnalyzeErrorBody {
  error?: string;
  forbidden_terms?: string[];
}

interface Step2Props {
  source: SourceSelection;
  promptText: string;
  onPromptChange: (v: string) => void;
  isLoading: boolean;
  error: unknown;
  onTryAnother: () => void;
  onRetry: () => void;
}

export const Step2Analyze = ({
  source,
  promptText,
  onPromptChange,
  isLoading,
  error,
  onTryAnother,
  onRetry,
}: Step2Props) => {
  const { t } = useTranslation();
  const err = error as { status?: number; data?: AnalyzeErrorBody } | undefined;
  const errCode = err?.data?.error;
  const forbidden = err?.data?.forbidden_terms ?? [];

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <PreviewBox sx={{ flex: '0 0 auto' }}>
        <img
          src={source.previewUrl}
          alt={t('designForge.builder.typography.createNew.sourcePreviewAlt')}
        />
      </PreviewBox>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {isLoading && (
          <Skeleton variant="rectangular" height={120} role="progressbar" />
        )}

        {!isLoading && errCode === 'typography_unclear' && (
          <Stack spacing={1}>
            <Alert severity="warning" role="alert">
              {t('designForge.builder.typography.createNew.errorUnclear')}
            </Alert>
            <Button variant="outlined" onClick={onTryAnother}>
              {t('designForge.builder.typography.createNew.tryAnother')}
            </Button>
          </Stack>
        )}

        {!isLoading && errCode === 'typography_analysis_failed' && (
          <Stack spacing={1}>
            <Alert severity="error" role="alert">
              {t('designForge.builder.typography.createNew.errorForbidden', {
                terms: forbidden.join(', '),
              })}
            </Alert>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={onTryAnother}>
                {t('designForge.builder.typography.createNew.tryAnotherImage')}
              </Button>
              {/* Backend currently does NOT return a partial prompt_text on
                  this 422; "Use anyway" is gated until that contract is
                  extended. Mirrors the CustomSpatialCreator note. */}
              <Button
                variant="text"
                disabled
                title={t(
                  'designForge.builder.typography.createNew.useAnywayDisabled',
                )}
              >
                {t('designForge.builder.typography.createNew.useAnyway')}
              </Button>
            </Stack>
          </Stack>
        )}

        {!isLoading && err && !errCode && (
          <Stack spacing={1}>
            <Alert severity="error" role="alert">
              {err.status === 502
                ? t(
                    'designForge.builder.typography.createNew.errorAnalyzerUnavailable',
                  )
                : t('designForge.builder.typography.createNew.errorAnalysisFailed')}
            </Alert>
            <Button variant="outlined" onClick={onRetry}>
              {t('designForge.builder.typography.createNew.retry')}
            </Button>
          </Stack>
        )}

        {!isLoading && !err && (
          <TextField
            label={t('designForge.builder.typography.createNew.promptLabel')}
            value={promptText}
            onChange={(e) => onPromptChange(e.target.value)}
            multiline
            rows={6}
            fullWidth
            slotProps={{
              htmlInput: {
                'aria-label': t(
                  'designForge.builder.typography.createNew.promptAria',
                ),
              },
            }}
            helperText={t('designForge.builder.typography.createNew.promptCounter', {
              count: promptText.trim().length,
            })}
          />
        )}
      </Box>
    </Stack>
  );
};

// ===========================================================================
// Step 3 — Name & Save
// ===========================================================================

interface Step3Props {
  name: string;
  onNameChange: (v: string) => void;
  nameError: string | null;
  promptText: string;
}

export const Step3Save = ({
  name,
  onNameChange,
  nameError,
  promptText,
}: Step3Props) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={2}>
      <TextField
        label={t('designForge.builder.typography.createNew.nameLabel')}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        slotProps={{
          htmlInput: {
            maxLength: 80,
            'aria-label': t('designForge.builder.typography.createNew.nameAria'),
          },
        }}
        error={!!nameError}
        helperText={
          nameError ?? t('designForge.builder.typography.createNew.nameHelp')
        }
        autoFocus
        fullWidth
      />
      <TextField
        label={t('designForge.builder.typography.createNew.promptReadonlyLabel')}
        value={promptText}
        multiline
        rows={6}
        fullWidth
        slotProps={{ input: { readOnly: true } }}
      />
    </Stack>
  );
};
