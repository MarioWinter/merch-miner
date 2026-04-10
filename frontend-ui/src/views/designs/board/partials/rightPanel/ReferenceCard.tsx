import { useState, useCallback } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { COLORS, MONO_FONT_STACK } from '@/style/constants';
import type { ProjectReference } from '@/views/designs/gallery/types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const CardRoot = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 8,
  padding: theme.spacing(1),
  '&:hover': {
    borderColor: alpha(COLORS.red, 0.3),
  },
}));

const Thumbnail = styled(Box)(({ theme }) => ({
  width: 48,
  height: 48,
  borderRadius: 6,
  flexShrink: 0,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha(COLORS.snow, 0.06),
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.ink, 0.06),
  }),
}));

const ThumbnailImg = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

const AnalysisText = styled(Typography)(({ theme }) => ({
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  padding: theme.spacing(0.75, 0, 0),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ReferenceCardProps {
  reference: ProjectReference;
  onUseAsReference: (imageUrl: string) => void;
  onAnalyze: (reference: ProjectReference) => void;
  onUseAsPrompt: (analysisText: string) => void;
  onRemove: (referenceId: string) => void;
  isAnalyzing?: boolean;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ReferenceCard = ({
  reference,
  onUseAsReference,
  onAnalyze,
  onUseAsPrompt,
  onRemove,
  isAnalyzing = false,
}: ReferenceCardProps) => {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const hasAnalysis =
    reference.prompt_analysis &&
    typeof reference.prompt_analysis === 'object' &&
    Object.keys(reference.prompt_analysis).length > 0;

  const analysisSummary = hasAnalysis
    ? (reference.prompt_analysis as Record<string, unknown>).summary as string ??
      JSON.stringify(reference.prompt_analysis, null, 2)
    : null;

  const handleAnalyze = useCallback(() => {
    onAnalyze(reference);
  }, [onAnalyze, reference]);

  const handleUseAsPrompt = useCallback(() => {
    if (analysisSummary) {
      onUseAsPrompt(analysisSummary);
    }
  }, [onUseAsPrompt, analysisSummary]);

  return (
    <CardRoot>
      <Stack direction="row" alignItems="flex-start" spacing={1}>
        {/* Thumbnail */}
        <Thumbnail>
          {imgError ? (
            <ImageOutlinedIcon
              sx={{ fontSize: 24, color: 'text.disabled' }}
              aria-label={t('design.references.brokenImage', 'Image unavailable')}
            />
          ) : (
            <ThumbnailImg
              src={reference.image_url}
              alt={reference.title || t('design.references.thumbnail', 'Reference thumbnail')}
              onError={() => setImgError(true)}
            />
          )}
        </Thumbnail>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <Tooltip title={reference.title} placement="top">
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {reference.title || t('design.references.untitled', 'Untitled')}
            </Typography>
          </Tooltip>

          {/* ASIN chip */}
          {reference.asin && (
            <Chip
              label={reference.asin}
              size="small"
              sx={{
                mt: 0.5,
                height: 18,
                fontSize: '0.6rem',
                fontFamily: MONO_FONT_STACK,
                borderRadius: '4px',
                backgroundColor: alpha(COLORS.cyan, 0.1),
                color: 'secondary.main',
              }}
            />
          )}

          {/* Action buttons row */}
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
            <Tooltip title={t('design.references.useAsReference', 'Use as Reference')}>
              <IconButton
                size="small"
                onClick={() => onUseAsReference(reference.image_url)}
                sx={{ p: 0.5 }}
                aria-label={t('design.references.useAsReference', 'Use as Reference')}
              >
                <PhotoCameraIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title={t('design.references.analyze', 'Analyze')}>
              <IconButton
                size="small"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                sx={{ p: 0.5 }}
                aria-label={t('design.references.analyze', 'Analyze')}
              >
                {isAnalyzing ? (
                  <CircularProgress size={14} />
                ) : (
                  <SearchIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </Tooltip>

            {hasAnalysis && (
              <Tooltip title={t('design.references.useAsPrompt', 'Use as Prompt')}>
                <IconButton
                  size="small"
                  onClick={handleUseAsPrompt}
                  sx={{ p: 0.5 }}
                  aria-label={t('design.references.useAsPrompt', 'Use as Prompt')}
                >
                  <AutoAwesomeIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {/* Expandable analysis text */}
          {hasAnalysis && (
            <>
              <Typography
                variant="caption"
                color="secondary.main"
                onClick={() => setShowAnalysis((prev) => !prev)}
                sx={{ cursor: 'pointer', mt: 0.5, display: 'inline-block' }}
              >
                {showAnalysis
                  ? t('design.references.hideAnalysis', 'Hide analysis')
                  : t('design.references.showAnalysis', 'Show analysis')}
              </Typography>
              <Collapse in={showAnalysis}>
                <AnalysisText variant="caption" color="text.secondary">
                  {analysisSummary}
                </AnalysisText>
              </Collapse>
            </>
          )}
        </Box>

        {/* Remove button */}
        <Tooltip title={t('design.references.remove', 'Remove')}>
          <IconButton
            size="small"
            onClick={() => onRemove(reference.id)}
            sx={{ p: 0.5, color: 'text.disabled' }}
            aria-label={t('design.references.remove', 'Remove')}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </CardRoot>
  );
};

export default ReferenceCard;
