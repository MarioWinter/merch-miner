import { useRef, useState } from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { DesignAsset } from '../../types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const PreviewRoot = styled(Stack)(({ theme }) => ({
  position: 'sticky',
  top: 80,
  gap: theme.spacing(1.5),
}));

const ImageFrame = styled(Box)(({ theme }) => ({
  width: '100%',
  aspectRatio: '1 / 1',
  borderRadius: 12,
  backgroundColor: COLORS.inkElevated,
  border: `1px solid ${theme.vars.palette.divider}`,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
}));

const PreviewImg = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block',
});

const EmptyInner = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(3),
  gap: theme.spacing(1),
  color: theme.vars.palette.text.disabled,
  textAlign: 'center',
}));

const MetaLine = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.disabled,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getFileExtension = (fileName?: string): string => {
  if (!fileName) return '';
  const idx = fileName.lastIndexOf('.');
  if (idx === -1 || idx === fileName.length - 1) return '';
  return fileName.slice(idx + 1).toUpperCase();
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DesignPreviewProps {
  design: DesignAsset | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DesignPreview = ({ design }: DesignPreviewProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const lastIdRef = useRef<string | undefined>(design?.id);

  // Reset loading/error synchronously when design changes — avoids effect
  if (lastIdRef.current !== design?.id) {
    lastIdRef.current = design?.id;
    setLoading(true);
    setErrored(false);
  }

  if (!design) {
    return (
      <PreviewRoot>
        <ImageFrame>
          <EmptyInner>
            <ImageOutlinedIcon sx={{ fontSize: 40 }} aria-hidden />
            <Typography variant="body2">
              {t('publish.edit.preview.empty', {
                defaultValue: 'No design selected',
              })}
            </Typography>
          </EmptyInner>
        </ImageFrame>
      </PreviewRoot>
    );
  }

  const extension = getFileExtension(design.file_name);
  const dimensionLabel = design.dimensions
    ? `${design.dimensions.width}×${design.dimensions.height}px`
    : null;

  return (
    <PreviewRoot aria-label={t('publish.edit.preview.label', {
      defaultValue: 'Design preview',
    })}>
      <ImageFrame>
        {loading && !errored && (
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
            sx={{ position: 'absolute', inset: 0 }}
          />
        )}

        {errored ? (
          <EmptyInner>
            <BrokenImageOutlinedIcon sx={{ fontSize: 40 }} aria-hidden />
            <Typography variant="body2">
              {t('publish.edit.preview.error', {
                defaultValue: 'Preview unavailable',
              })}
            </Typography>
          </EmptyInner>
        ) : (
          <PreviewImg
            src={design.thumbnail_url || design.file_url}
            alt={design.file_name}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setErrored(true);
            }}
            style={{ opacity: loading ? 0 : 1 }}
          />
        )}
      </ImageFrame>

      <Stack gap={0.25}>
        {dimensionLabel && (
          <MetaLine variant="caption">{dimensionLabel}</MetaLine>
        )}
        {extension && <MetaLine variant="caption">{extension}</MetaLine>}
        <MetaLine variant="caption" title={design.file_name}>
          {design.file_name}
        </MetaLine>
      </Stack>
    </PreviewRoot>
  );
};

export default DesignPreview;
