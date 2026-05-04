/**
 * PROJ-20 Phase 7.5 — preview cards for in-flight + completed uploads.
 *
 * Rendered above the action row whenever `attachments.uploads.length > 0`.
 * Each card shows the thumbnail, filename, size, and a ✕-button to remove.
 * Failed uploads are visually flagged via reduced opacity + red border.
 */
import { Box, CircularProgress, IconButton, Stack, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';

import { useAppSelector } from '@/store/hooks';
import { useAttachmentUpload } from '../hooks/useAttachmentUpload';

const Row = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  paddingLeft: theme.spacing(0.25),
  paddingRight: theme.spacing(0.25),
}));

const Card = styled(Box, {
  shouldForwardProp: (p) => p !== 'failed',
})<{ failed: boolean }>(({ theme, failed }) => ({
  position: 'relative',
  width: 88,
  borderRadius: 10,
  border: `1px solid ${
    failed ? alpha(theme.palette.error.main, 0.55) : theme.vars.palette.divider
  }`,
  backgroundColor: alpha(theme.palette.common.black, 0.25),
  padding: theme.spacing(0.5),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.25),
  opacity: failed ? 0.7 : 1,
}));

const Thumb = styled('div')(({ theme }) => ({
  width: '100%',
  height: 64,
  borderRadius: 6,
  backgroundColor: alpha(theme.palette.common.black, 0.4),
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
}));

const RemoveButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: -8,
  right: -8,
  width: 20,
  height: 20,
  padding: 0,
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  '&:hover': {
    backgroundColor: theme.vars.palette.background.default,
  },
}));

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const truncate = (s: string, max = 20): string =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s;

const AttachmentBar = () => {
  const { t } = useTranslation();
  const uploads = useAppSelector((s) => s.attachments.uploads);
  const { remove } = useAttachmentUpload();

  if (uploads.length === 0) return null;

  return (
    <Row data-testid="chat-input-attachment-bar">
      {uploads.map((u) => {
        const failed = u.status === 'failed';
        const uploading = u.status === 'uploading';
        return (
          <Card key={u.localId} failed={failed}>
            <RemoveButton
              size="small"
              aria-label={t('search.attachments.removeImage')}
              onClick={() => remove(u.localId, u.serverId)}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </RemoveButton>
            <Thumb
              style={
                u.thumbnail_url
                  ? { backgroundImage: `url(${u.thumbnail_url})` }
                  : undefined
              }
            >
              {failed && <ErrorOutlineIcon color="error" sx={{ fontSize: 28 }} />}
              {uploading && <CircularProgress size={20} />}
            </Thumb>
            <Typography
              variant="caption"
              title={u.filename}
              sx={{ fontSize: '0.6875rem', lineHeight: 1.2 }}
            >
              {truncate(u.filename)}
            </Typography>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ fontSize: '0.625rem', lineHeight: 1 }}
            >
              {formatSize(u.size)}
            </Typography>
          </Card>
        );
      })}
    </Row>
  );
};

export default AttachmentBar;
