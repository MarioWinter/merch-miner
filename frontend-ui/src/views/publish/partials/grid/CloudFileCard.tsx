import { Box, IconButton, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

interface CloudFileCardProps {
  id: string;
  fileName: string;
  thumbnailUrl?: string;
  modifiedDate?: string;
  fileSize?: string;
  provider: 'google_drive' | 'onedrive';
  onImport?: (id: string) => void;
  onPreview?: (id: string) => void;
  onCopyUrl?: (id: string) => void;
}

const CardRoot = styled(Box)(({ theme }) => ({
  position: 'relative',
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    borderColor: alpha('#fff', 0.16),
    transform: 'translateY(-2px)',
    boxShadow: `0 8px 24px ${alpha(COLORS.ink, 0.4)}`,
    '& .cloud-actions': { opacity: 1 },
  },
}));

const ThumbnailContainer = styled(Box)(({ theme }) => ({
  aspectRatio: '1 / 1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(1.5),
  backgroundColor: alpha(COLORS.ink, 0.3),
  overflow: 'hidden',
  position: 'relative',
}));

const ProviderBadge = styled(Box)({
  position: 'absolute',
  bottom: 8,
  right: 8,
  width: 20,
  height: 20,
  borderRadius: '50%',
  backgroundColor: alpha(COLORS.ink, 0.7),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
});

const HoverActions = styled(Box)({
  position: 'absolute',
  top: 8,
  right: 8,
  display: 'flex',
  gap: 4,
  opacity: 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  zIndex: 2,
});

const ActionBtn = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'isPrimary',
})<{ isPrimary?: boolean }>(({ isPrimary }) => ({
  width: 28,
  height: 28,
  backgroundColor: isPrimary ? alpha(COLORS.cyan, 0.2) : alpha(COLORS.ink, 0.5),
  backdropFilter: 'blur(4px)',
  '&:hover': {
    backgroundColor: isPrimary ? alpha(COLORS.cyan, 0.35) : alpha(COLORS.ink, 0.7),
  },
}));

const InfoStrip = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.25, 1.5),
  backgroundColor: alpha(COLORS.inkPaper, 0.85),
  backdropFilter: 'blur(12px)',
  borderTop: `1px solid ${alpha('#fff', 0.06)}`,
}));

const CloudFileCard = ({
  id,
  fileName,
  thumbnailUrl,
  modifiedDate,
  fileSize,
  provider,
  onImport,
  onPreview,
  onCopyUrl,
}: CloudFileCardProps) => {
  const { t } = useTranslation();
  const providerSymbol = provider === 'google_drive' ? 'G' : 'O';

  return (
    <CardRoot>
      <ThumbnailContainer>
        <HoverActions className="cloud-actions">
          {onImport && (
            <ActionBtn
              isPrimary
              size="small"
              onClick={() => onImport(id)}
              aria-label={t('publish.cloud.import', { defaultValue: 'Import' })}
            >
              <CloudDownloadOutlinedIcon sx={{ fontSize: 16 }} />
            </ActionBtn>
          )}
          {onPreview && (
            <ActionBtn
              size="small"
              onClick={() => onPreview(id)}
              aria-label={t('publish.cloud.preview', { defaultValue: 'Preview' })}
            >
              <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
            </ActionBtn>
          )}
          {onCopyUrl && (
            <ActionBtn
              size="small"
              onClick={() => onCopyUrl(id)}
              aria-label={t('publish.cloud.copyUrl', { defaultValue: 'Copy URL' })}
            >
              <LinkOutlinedIcon sx={{ fontSize: 16 }} />
            </ActionBtn>
          )}
        </HoverActions>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={fileName}
            loading="lazy"
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Box sx={{ color: 'text.disabled', fontSize: 48 }}>?</Box>
        )}
        <ProviderBadge>
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10 }}>
            {providerSymbol}
          </Typography>
        </ProviderBadge>
      </ThumbnailContainer>
      <InfoStrip>
        <Typography variant="subtitle2" noWrap>
          {fileName}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {modifiedDate}
          {fileSize && ` \u00B7 ${fileSize}`}
        </Typography>
      </InfoStrip>
    </CardRoot>
  );
};

export default CloudFileCard;
