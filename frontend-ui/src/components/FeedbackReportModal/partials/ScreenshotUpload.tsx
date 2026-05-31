import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

import {
  FEEDBACK_SCREENSHOT_ALLOWED_MIME,
  FEEDBACK_SCREENSHOT_MAX_BYTES,
} from '../schemas/feedbackReportSchema';

const HiddenInput = styled('input')({
  display: 'none',
});

const PreviewBox = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: 96,
  height: 96,
  borderRadius: 8,
  overflow: 'hidden',
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: theme.vars.palette.background.default,
}));

const PreviewImage = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

const PreviewRemoveButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: 2,
  right: 2,
  width: 22,
  height: 22,
  padding: 0,
  backgroundColor: theme.vars.palette.background.paper,
  color: theme.vars.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
  },
}));

interface ScreenshotUploadProps {
  file: File | null;
  error: string | null;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  onError: (msg: string | null) => void;
}

const ScreenshotUpload = ({
  file,
  error,
  disabled,
  onFileChange,
  onError,
}: ScreenshotUploadProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Derive the preview URL synchronously from `file`. Avoids the
  // `setState-in-effect` lint rule (cascading renders) — the URL is a pure
  // function of `file`, so it belongs in `useMemo`, not `useState + useEffect`.
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );

  // Revoke the object URL after a new one supersedes it (or on unmount) to
  // avoid leaking blob handles. Effect runs the cleanup against the previous
  // `previewUrl` exactly like the old useState pattern did.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const validateAndSet = useCallback(
    (selected: File | null) => {
      if (!selected) {
        onFileChange(null);
        return;
      }
      if (
        !FEEDBACK_SCREENSHOT_ALLOWED_MIME.includes(
          selected.type as (typeof FEEDBACK_SCREENSHOT_ALLOWED_MIME)[number],
        )
      ) {
        onError(t('feedback.form.screenshot.errors.wrongType'));
        return;
      }
      if (selected.size > FEEDBACK_SCREENSHOT_MAX_BYTES) {
        onError(t('feedback.form.screenshot.errors.tooLarge'));
        return;
      }
      onFileChange(selected);
    },
    [onError, onFileChange, t],
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    validateAndSet(selected);
    // Allow re-selecting the same file after removal.
    event.target.value = '';
  };

  const handleRemove = () => {
    onFileChange(null);
    onError(null);
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" component="label">
        {t('feedback.form.screenshot.label')}
      </Typography>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Button
          variant="outlined"
          size="small"
          startIcon={<AttachFileIcon />}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          aria-label={t('feedback.form.screenshot.uploadAria')}
        >
          {file
            ? t('feedback.form.screenshot.replace')
            : t('feedback.form.screenshot.choose')}
        </Button>
        <HiddenInput
          ref={inputRef}
          type="file"
          accept={FEEDBACK_SCREENSHOT_ALLOWED_MIME.join(',')}
          onChange={handleChange}
          data-testid="feedback-screenshot-input"
        />
        {file && previewUrl && (
          <PreviewBox>
            <PreviewImage src={previewUrl} alt={file.name} />
            <PreviewRemoveButton
              size="small"
              onClick={handleRemove}
              disabled={disabled}
              aria-label={t('feedback.form.screenshot.removeAria')}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </PreviewRemoveButton>
          </PreviewBox>
        )}
      </Stack>
      <Typography
        variant="caption"
        color={error ? 'error.main' : 'text.secondary'}
      >
        {error ?? t('feedback.form.screenshot.helper')}
      </Typography>
    </Stack>
  );
};

export default ScreenshotUpload;
