import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setCloudTarget as setCloudTargetAction } from '@/store/upscaleSlice';
import type { UpscaleCloudTarget } from '@/store/upscaleApi';
import UpscaleDestinationToggle from '@/views/designs/board/partials/UpscaleDestinationToggle';
import UpscaleQuotaIndicator from '@/views/designs/board/partials/UpscaleQuotaIndicator';
import PickCloudFolderDialog from '@/views/designs/board/partials/PickCloudFolderDialog';
import { useUpscaleSingle } from '../../hooks/useUpscaleSingle';

// -----------------------------------------------------------------
// Constants — sourced from server via UpscalerSettings; defaults match spec.
// -----------------------------------------------------------------

const TARGET_W = 4500;
const TARGET_H = 5400;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const InfoChip = styled(Chip)({
  alignSelf: 'flex-start',
  height: 22,
  fontSize: 11,
  borderRadius: 6,
});

const HintText = styled(Typography)({
  fontSize: 11,
  lineHeight: 1.4,
});

// -----------------------------------------------------------------
// Props (kept compatible with existing ToolPanel.tsx)
// -----------------------------------------------------------------

interface UpscaleToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
  imageWidth?: number;
  imageHeight?: number;
  /** Designed-by-us new props — wired via DesignEditorView. */
  designId?: string | null;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const UpscaleToolParams = ({
  disabled,
  imageWidth,
  imageHeight,
  designId,
}: UpscaleToolParamsProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const workspaceId = useAppSelector((s) => s.workspace.activeWorkspaceId);

  const destination = useAppSelector((s) =>
    workspaceId ? s.upscale.destinationByWorkspace[workspaceId] : undefined,
  ) ?? 'local';

  const cloudTarget = useAppSelector((s) =>
    workspaceId ? s.upscale.cloudTargetByWorkspace[workspaceId] : null,
  ) as UpscaleCloudTarget | null;

  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    isProcessing,
    isTriggering,
    needsConfirmation,
    triggerUpscale,
    cancelConfirmation,
  } = useUpscaleSingle({
    designId: designId ?? null,
    destination,
    cloudTarget,
  });

  const handleClick = useCallback(() => {
    void triggerUpscale();
  }, [triggerUpscale]);

  const handleConfirmReplace = useCallback(() => {
    void triggerUpscale({ replace: true });
  }, [triggerUpscale]);

  const handlePickCloud = useCallback(
    (target: UpscaleCloudTarget) => {
      if (!workspaceId) return;
      dispatch(setCloudTargetAction({ workspaceId, target }));
    },
    [dispatch, workspaceId],
  );

  const cloudInvalid = destination === 'cloud' && !cloudTarget;
  const noDesignSelected = !designId;
  const isBusy = isTriggering || isProcessing;
  const buttonDisabled = disabled || isBusy || noDesignSelected || cloudInvalid;

  return (
    <Stack spacing={1.5} sx={{ opacity: disabled ? 0.5 : 1 }}>
      {imageWidth !== undefined && imageHeight !== undefined && (
        <InfoChip
          size="small"
          variant="outlined"
          label={t('upscale.single.currentSize', {
            defaultValue: 'Current: {{w}}×{{h}}',
            w: imageWidth,
            h: imageHeight,
          })}
        />
      )}

      <InfoChip
        size="small"
        variant="filled"
        color="secondary"
        label={t('upscale.single.targetSize', {
          defaultValue: 'Target: {{w}}×{{h}}',
          w: TARGET_W,
          h: TARGET_H,
        })}
      />

      <UpscaleDestinationToggle
        workspaceId={workspaceId ?? null}
        onPickCloudTarget={() => setPickerOpen(true)}
        disabled={isBusy}
      />

      <UpscaleQuotaIndicator />

      <HintText variant="caption" color="text.disabled">
        {t('upscale.single.costHint', {
          defaultValue: 'Uses 1 of your monthly upscales',
        })}
      </HintText>

      <Button
        variant="contained"
        color="primary"
        size="small"
        onClick={handleClick}
        disabled={buttonDisabled}
        startIcon={
          isBusy ? (
            <CircularProgress size={14} color="inherit" />
          ) : (
            <PlayArrowIcon sx={{ fontSize: 18 }} />
          )
        }
        fullWidth
      >
        {isBusy
          ? t('upscale.single.processing', { defaultValue: 'Upscaling…' })
          : t('upscale.single.runNow', { defaultValue: 'Upscale Now' })}
      </Button>

      <Box>
        <ConfirmDialog
          open={needsConfirmation}
          title={t('upscale.single.reupscaleTitle', {
            defaultValue: 'Re-upscale this design?',
          })}
          body={t('upscale.single.reupscaleBody', {
            defaultValue:
              'This design has already been upscaled to 4500×5400. Re-upscaling will consume 1 from your monthly quota and overwrite the current file.',
          })}
          confirmLabel={t('upscale.single.reupscaleConfirm', {
            defaultValue: 'Re-upscale',
          })}
          cancelLabel={t('common.cancel', { defaultValue: 'Cancel' })}
          confirmColor="primary"
          showDeleteIcon={false}
          onConfirm={handleConfirmReplace}
          onCancel={cancelConfirmation}
        />
      </Box>

      <PickCloudFolderDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={handlePickCloud}
      />
    </Stack>
  );
};
