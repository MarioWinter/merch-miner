import {
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import DownloadIcon from '@mui/icons-material/Download';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ReferenceNodeData, VariantNodeData, BoardNodeData } from '../types';

interface ConfigPanelProps {
  open: boolean;
  onClose: () => void;
  nodeData: BoardNodeData | null;
  onApprove?: (designId: string) => void;
  onReject?: (designId: string) => void;
  onDownload?: (designId: string) => void;
  onAnalyze?: (imageUrl: string, productId: string) => void;
  onUsePrompt?: (prompt: string) => void;
}

const PANEL_WIDTH = 320;

const PanelHeader = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: theme.spacing(2),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  marginBottom: theme.spacing(2),
}));

const FullImage = styled('img')({
  width: '100%',
  maxHeight: 280,
  objectFit: 'contain',
  borderRadius: 8,
  backgroundColor: 'rgba(0,0,0,0.1)',
  display: 'block',
});

const FieldRow = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
}));

export const ConfigPanel = ({
  open,
  onClose,
  nodeData,
  onApprove,
  onReject,
  onDownload,
  onAnalyze,
  onUsePrompt,
}: ConfigPanelProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isReference = nodeData?.type === 'reference';
  const isVariant = nodeData?.type === 'variant';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      sx={{
        '& .MuiDrawer-paper': {
          width: PANEL_WIDTH,
          p: 3,
          top: 0,
          height: '100%',
          borderLeft: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      <PanelHeader>
        <Typography variant="h6">
          {isReference
            ? t('design.board.referenceDetails')
            : isVariant
              ? t('design.board.designDetails')
              : t('design.board.nodeDetails')}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="close">
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </PanelHeader>

      {/* Reference node content */}
      {isReference && <ReferenceContent data={nodeData as ReferenceNodeData} onAnalyze={onAnalyze} onUsePrompt={onUsePrompt} />}

      {/* Variant node content */}
      {isVariant && (
        <VariantContent
          data={nodeData as VariantNodeData}
          onApprove={onApprove}
          onReject={onReject}
          onDownload={onDownload}
          onOpenEditor={() => {
            const design = (nodeData as VariantNodeData).design;
            navigate(`?tab=editor&designs=${design.id}`);
          }}
        />
      )}
    </Drawer>
  );
};

/* ---------- Reference sub-content ---------- */
const ReferenceContent = ({
  data,
  onAnalyze,
  onUsePrompt,
}: {
  data: ReferenceNodeData;
  onAnalyze?: (imageUrl: string, productId: string) => void;
  onUsePrompt?: (prompt: string) => void;
}) => {
  const { t } = useTranslation();
  const { product, hasAnalysis } = data;

  return (
    <Box>
      {product.image && <FullImage src={product.image} alt={product.title} />}

      <Typography variant="subtitle2" sx={{ mt: 1.5 }}>
        {product.title}
      </Typography>

      {product.visual_style && (
        <FieldRow>
          <Typography variant="overline" color="text.secondary">
            {t('design.board.visualStyle')}
          </Typography>
          <Typography variant="body2">{product.visual_style}</Typography>
        </FieldRow>
      )}

      {product.graphic_elements && (
        <FieldRow>
          <Typography variant="overline" color="text.secondary">
            {t('design.board.graphicElements')}
          </Typography>
          <Typography variant="body2">{product.graphic_elements}</Typography>
        </FieldRow>
      )}

      {product.tone && (
        <FieldRow>
          <Typography variant="overline" color="text.secondary">
            {t('design.board.tone')}
          </Typography>
          <Typography variant="body2">{product.tone}</Typography>
        </FieldRow>
      )}

      {product.vibe && (
        <FieldRow>
          <Typography variant="overline" color="text.secondary">
            {t('design.board.vibe')}
          </Typography>
          <Typography variant="body2">
            {Array.isArray(product.vibe) ? product.vibe.join(', ') : product.vibe}
          </Typography>
        </FieldRow>
      )}

      <Stack spacing={1} sx={{ mt: 2 }}>
        {hasAnalysis && Boolean(product.prompt_analysis?.final_prompt) && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => onUsePrompt?.(String(product.prompt_analysis?.final_prompt))}
          >
            {t('design.board.usePrompt')}
          </Button>
        )}
        <Button
          size="small"
          variant="contained"
          color="secondary"
          startIcon={<ImageSearchIcon />}
          onClick={() => onAnalyze?.(product.image, product.product_id)}
          disabled={!product.image || data.isAnalyzing}
        >
          {t('design.analyze.button')}
        </Button>
      </Stack>
    </Box>
  );
};

/* ---------- Variant sub-content ---------- */
const VariantContent = ({
  data,
  onApprove,
  onReject,
  onDownload,
  onOpenEditor,
}: {
  data: VariantNodeData;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDownload?: (id: string) => void;
  onOpenEditor: () => void;
}) => {
  const { t } = useTranslation();
  const { design } = data;

  return (
    <Box>
      {design.image_file && (
        <FullImage src={design.image_file} alt={t('design.gallery.imageAlt')} />
      )}

      <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }} alignItems="center">
        <Chip
          label={t(`design.status.${design.status}`)}
          size="small"
          color={design.status === 'approved' ? 'success' : design.status === 'rejected' ? 'error' : 'default'}
          sx={{ borderRadius: '6px' }}
        />
        {design.generation_run?.model_name && (
          <Chip
            label={t(`design.model.${design.generation_run.model_name}`)}
            size="small"
            variant="outlined"
            sx={{ borderRadius: '6px' }}
          />
        )}
      </Stack>

      {/* Actions */}
      <Stack spacing={1} sx={{ mt: 2 }}>
        <Stack direction="row" spacing={1}>
          {design.status !== 'approved' && (
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckCircleOutlineIcon />}
              onClick={() => onApprove?.(design.id)}
              fullWidth
            >
              {t('design.gallery.approve')}
            </Button>
          )}
          {design.status !== 'rejected' && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<HighlightOffIcon />}
              onClick={() => onReject?.(design.id)}
              fullWidth
            >
              {t('design.gallery.reject')}
            </Button>
          )}
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<WallpaperIcon />}
            fullWidth
          >
            {t('design.batch.bg_remove')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoFixHighIcon />}
            fullWidth
          >
            {t('design.batch.upscale')}
          </Button>
        </Stack>

        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() => onDownload?.(design.id)}
          fullWidth
        >
          {t('design.gallery.download')}
        </Button>

        <Button
          size="small"
          variant="contained"
          color="secondary"
          startIcon={<OpenInNewIcon />}
          onClick={onOpenEditor}
          fullWidth
        >
          {t('design.board.openInEditor')}
        </Button>
      </Stack>
    </Box>
  );
};
