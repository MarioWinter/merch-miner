import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  TextField,
  Slider,
  CircularProgress,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useGetProcessingSettingsQuery,
  useUpdateProcessingSettingsMutation,
} from '@/store/designSlice';
import type { UpdateProcessingSettingsBody } from '@/store/designSlice';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  color: theme.vars.palette.text.disabled,
  marginTop: 8,
}));

const FieldLabel = styled(Typography)({
  fontSize: 12,
  fontWeight: 500,
  marginBottom: 2,
});

const HintText = styled(Typography)(({ theme }) => ({
  fontSize: 11,
  color: theme.vars.palette.text.disabled,
  marginTop: 2,
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ProcessingSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ProcessingSettingsDialog = ({ open, onClose }: ProcessingSettingsDialogProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const { data: settings, isLoading, error } = useGetProcessingSettingsQuery(undefined, { skip: !open });
  const [updateSettings, { isLoading: isSaving }] = useUpdateProcessingSettingsMutation();

  // Derive a stable key from settings to reset form state when server data changes
  const settingsKey = useMemo(
    () => (settings ? `${settings.bg_removal_provider}_${settings.upscale_provider}_${settings.upscale_auto_threshold}` : ''),
    [settings],
  );

  // Local form state — re-initialized from server data via key change
  const [bgProvider, setBgProvider] = useState<'rembg' | 'api'>('rembg');
  const [bgApiKey, setBgApiKey] = useState('');
  const [upscaleProvider, setUpscaleProvider] = useState<'pica' | 'api' | 'auto'>('auto');
  const [upscaleApiKey, setUpscaleApiKey] = useState('');
  const [autoThreshold, setAutoThreshold] = useState(3000);

  // Sync server data into local form state when settings key changes
  const [prevKey, setPrevKey] = useState(settingsKey);
  if (settingsKey && settingsKey !== prevKey) {
    setPrevKey(settingsKey);
    if (settings) {
      setBgProvider(settings.bg_removal_provider);
      setBgApiKey('');
      setUpscaleProvider(settings.upscale_provider);
      setUpscaleApiKey('');
      setAutoThreshold(settings.upscale_auto_threshold);
    }
  }

  const handleSave = async () => {
    const body: UpdateProcessingSettingsBody = {
      bg_removal_provider: bgProvider,
      upscale_provider: upscaleProvider,
      upscale_auto_threshold: autoThreshold,
    };
    // Only send API keys if user typed something new
    if (bgApiKey) body.bg_removal_api_key = bgApiKey;
    if (upscaleApiKey) body.upscale_api_key = upscaleApiKey;

    try {
      await updateSettings(body).unwrap();
      enqueueSnackbar(t('design.settings.saveSuccess'), { variant: 'success' });
      onClose();
    } catch {
      enqueueSnackbar(t('design.settings.saveError'), { variant: 'error' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3 } } }}
    >
      <DialogTitle sx={{ fontSize: 16, fontWeight: 600 }}>
        {t('design.settings.title')}
      </DialogTitle>

      <DialogContent dividers>
        {isLoading ? (
          <Stack alignItems="center" py={4}>
            <CircularProgress size={28} />
          </Stack>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {t('design.settings.loadError')}
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {/* ---- BG Removal ---- */}
            <SectionLabel>{t('design.settings.bgRemovalSection')}</SectionLabel>

            <FieldLabel>{t('design.settings.provider')}</FieldLabel>
            <ToggleButtonGroup
              value={bgProvider}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setBgProvider(v); }}
              sx={{ width: '100%' }}
            >
              <ToggleButton value="rembg" sx={{ flex: 1, fontSize: 12 }}>
                rembg ({t('design.settings.selfHosted')})
              </ToggleButton>
              <ToggleButton value="api" sx={{ flex: 1, fontSize: 12 }}>
                {t('design.settings.externalApi')}
              </ToggleButton>
            </ToggleButtonGroup>

            {bgProvider === 'api' && (
              <>
                <FieldLabel>{t('design.settings.apiKey')}</FieldLabel>
                <TextField
                  size="small"
                  type="password"
                  placeholder={
                    settings?.bg_removal_api_key_set
                      ? t('design.settings.apiKeySet')
                      : t('design.settings.apiKeyPlaceholder')
                  }
                  value={bgApiKey}
                  onChange={(e) => setBgApiKey(e.target.value)}
                  fullWidth
                />
                {settings?.bg_removal_api_key_set && !bgApiKey && (
                  <HintText>{t('design.settings.apiKeyKept')}</HintText>
                )}
              </>
            )}

            {/* ---- Upscaling ---- */}
            <SectionLabel>{t('design.settings.upscaleSection')}</SectionLabel>

            <FieldLabel>{t('design.settings.provider')}</FieldLabel>
            <ToggleButtonGroup
              value={upscaleProvider}
              exclusive
              size="small"
              onChange={(_, v) => { if (v) setUpscaleProvider(v); }}
              sx={{ width: '100%' }}
            >
              <ToggleButton value="auto" sx={{ flex: 1, fontSize: 12 }}>
                Auto
              </ToggleButton>
              <ToggleButton value="pica" sx={{ flex: 1, fontSize: 12 }}>
                Pica.js
              </ToggleButton>
              <ToggleButton value="api" sx={{ flex: 1, fontSize: 12 }}>
                {t('design.settings.externalApi')}
              </ToggleButton>
            </ToggleButtonGroup>

            {(upscaleProvider === 'auto' || upscaleProvider === 'api') && (
              <>
                {upscaleProvider === 'auto' && (
                  <>
                    <FieldLabel>
                      {t('design.settings.autoThreshold')}: {autoThreshold}px
                    </FieldLabel>
                    <Slider
                      value={autoThreshold}
                      onChange={(_, v) => setAutoThreshold(v as number)}
                      min={500}
                      max={5000}
                      step={100}
                      size="small"
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => `${v}px`}
                    />
                    <HintText>{t('design.settings.autoThresholdHint')}</HintText>
                  </>
                )}

                {upscaleProvider === 'api' && (
                  <>
                    <FieldLabel>{t('design.settings.apiKey')}</FieldLabel>
                    <TextField
                      size="small"
                      type="password"
                      placeholder={
                        settings?.upscale_api_key_set
                          ? t('design.settings.apiKeySet')
                          : t('design.settings.apiKeyPlaceholder')
                      }
                      value={upscaleApiKey}
                      onChange={(e) => setUpscaleApiKey(e.target.value)}
                      fullWidth
                    />
                    {settings?.upscale_api_key_set && !upscaleApiKey && (
                      <HintText>{t('design.settings.apiKeyKept')}</HintText>
                    )}
                  </>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} size="small" color="inherit">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          size="small"
          variant="contained"
          disabled={isLoading || isSaving}
          startIcon={isSaving ? <CircularProgress size={14} /> : undefined}
        >
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProcessingSettingsDialog;
