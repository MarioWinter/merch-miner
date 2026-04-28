/**
 * PROJ-20 Phase 7.6 — chat-history thumbnail strip for user-uploaded images.
 *
 * Rendered above the user message bubble. Each thumbnail is a clickable link
 * (target=_blank) so users can pop the full-resolution copy. Purged
 * attachments render as a `[Image purged]` placeholder.
 */
import { Box, Stack, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import ImageNotSupportedIcon from '@mui/icons-material/ImageNotSupported';
import { useTranslation } from 'react-i18next';

import type { ChatAttachment } from '@/types/search';

interface UserAttachmentsProps {
  attachments: ChatAttachment[];
}

const Row = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: theme.spacing(0.75),
  justifyContent: 'flex-end',
}));

const Tile = styled('a')(({ theme }) => ({
  display: 'block',
  width: 96,
  height: 96,
  borderRadius: 10,
  overflow: 'hidden',
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: alpha(theme.palette.common.black, 0.4),
  textDecoration: 'none',
  transition: 'transform 160ms ease, border-color 160ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    borderColor: alpha(theme.palette.primary.main, 0.55),
  },
}));

const Img = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

const PurgedTile = styled(Box)(({ theme }) => ({
  width: 96,
  height: 96,
  borderRadius: 10,
  border: `1px dashed ${theme.vars.palette.divider}`,
  backgroundColor: alpha(theme.palette.common.black, 0.4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  color: theme.vars.palette.text.disabled,
}));

const UserAttachments = ({ attachments }: UserAttachmentsProps) => {
  const { t } = useTranslation();
  if (attachments.length === 0) return null;
  return (
    <Row>
      {attachments.map((a) => {
        if (a.purged_at || !a.thumbnail_url) {
          return (
            <PurgedTile key={a.id} role="img" aria-label={t('search.attachments.purgedPlaceholder')}>
              <ImageNotSupportedIcon sx={{ fontSize: 20 }} />
              <Typography variant="caption" sx={{ fontSize: '0.625rem', textAlign: 'center', px: 0.5 }}>
                {t('search.attachments.purgedPlaceholder')}
              </Typography>
            </PurgedTile>
          );
        }
        return (
          <Tile
            key={a.id}
            href={a.thumbnail_url}
            target="_blank"
            rel="noopener noreferrer"
            title={a.filename}
          >
            <Img src={a.thumbnail_url} alt={a.filename} loading="lazy" />
          </Tile>
        );
      })}
    </Row>
  );
};

export default UserAttachments;
