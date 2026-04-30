/**
 * PROJ-18 Phase 11 — AC-58: Guided onboarding flow.
 *
 * Optional 3-step Stepper that walks the user through:
 *   1. Pick autonomy preset (delegates to PresetSelector)
 *   2. Pick a default niche (delegates to existing useListNichesQuery)
 *   3. Add a quick knowledge doc (creates KnowledgeDoc via mutation)
 *
 * Skippable at every step. On completion or skip we set a localStorage flag
 * so the OnboardingBanner stays dismissed across reloads (AC-59 — agent
 * remains usable even when onboarding is skipped).
 */
import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useListPresetsQuery,
  useActivatePresetMutation,
  useCreateKnowledgeMutation,
} from '@/store/agentSlice';
import { useListNichesQuery } from '@/store/nicheSlice';

export const ONBOARDING_DONE_KEY = 'merchminer.agent.onboarding.completed';

const StepBody = styled(Box)(({ theme }) => ({
  minHeight: 180,
  paddingTop: theme.spacing(2),
}));

interface OnboardingFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const OnboardingFlow = ({ open, onClose, onComplete }: OnboardingFlowProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [activeStep, setActiveStep] = useState(0);

  const { data: presets } = useListPresetsQuery();
  const { data: nicheList } = useListNichesQuery({ page: 1, page_size: 100 });
  const [activatePreset] = useActivatePresetMutation();
  const [createKnowledge] = useCreateKnowledgeMutation();

  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [selectedNicheId, setSelectedNicheId] = useState<string>('');
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const finish = useCallback(() => {
    localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    onComplete?.();
    onClose();
  }, [onClose, onComplete]);

  const handleSkip = useCallback(() => {
    finish();
  }, [finish]);

  const handleNext = useCallback(async () => {
    if (activeStep === 0 && selectedPresetId) {
      try {
        await activatePreset(selectedPresetId).unwrap();
        enqueueSnackbar(t('agent.onboarding.presetActivated'), {
          variant: 'success',
        });
      } catch {
        enqueueSnackbar(t('agent.onboarding.presetError'), { variant: 'error' });
      }
    }
    if (activeStep === 2) {
      // Final step — optional knowledge doc save before completing.
      if (docTitle.trim() && docContent.trim()) {
        setSubmitting(true);
        try {
          await createKnowledge({
            title: docTitle.trim(),
            content: docContent.trim(),
          }).unwrap();
          enqueueSnackbar(t('agent.onboarding.docSaved'), { variant: 'success' });
        } catch {
          enqueueSnackbar(t('agent.onboarding.docError'), { variant: 'error' });
        } finally {
          setSubmitting(false);
        }
      }
      finish();
      return;
    }
    setActiveStep((s) => Math.min(2, s + 1));
  }, [
    activeStep,
    selectedPresetId,
    docTitle,
    docContent,
    activatePreset,
    createKnowledge,
    enqueueSnackbar,
    t,
    finish,
  ]);

  const handleBack = useCallback(() => {
    setActiveStep((s) => Math.max(0, s - 1));
  }, []);

  const niches = nicheList?.results ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { borderRadius: 2 } } }}
    >
      <DialogTitle sx={{ pr: 5 }}>
        {t('agent.onboarding.flowTitle')}
        <IconButton
          onClick={onClose}
          size="small"
          aria-label={t('agent.onboarding.close')}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 1 }}>
          <Step>
            <StepLabel>{t('agent.onboarding.step1')}</StepLabel>
          </Step>
          <Step>
            <StepLabel>{t('agent.onboarding.step2')}</StepLabel>
          </Step>
          <Step>
            <StepLabel>{t('agent.onboarding.step3')}</StepLabel>
          </Step>
        </Stepper>

        <StepBody>
          {activeStep === 0 && (
            <Stack gap={1.5}>
              <Typography variant="body2" color="text.secondary">
                {t('agent.onboarding.step1Hint')}
              </Typography>
              <Select
                size="small"
                fullWidth
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  {t('agent.onboarding.choosePreset')}
                </MenuItem>
                {(presets ?? []).map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          )}

          {activeStep === 1 && (
            <Stack gap={1.5}>
              <Typography variant="body2" color="text.secondary">
                {t('agent.onboarding.step2Hint')}
              </Typography>
              <Select
                size="small"
                fullWidth
                value={selectedNicheId}
                onChange={(e) => setSelectedNicheId(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">
                  {t('agent.onboarding.skipNiche')}
                </MenuItem>
                {niches.map((n) => (
                  <MenuItem key={n.id} value={n.id}>
                    {n.name}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
          )}

          {activeStep === 2 && (
            <Stack gap={1}>
              <Typography variant="body2" color="text.secondary">
                {t('agent.onboarding.step3Hint')}
              </Typography>
              <TextField
                size="small"
                placeholder={t('agent.knowledge.titlePlaceholder')}
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                placeholder={t('agent.knowledge.contentPlaceholder')}
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                multiline
                minRows={3}
                fullWidth
              />
            </Stack>
          )}
        </StepBody>

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
          <Button onClick={handleSkip} size="small">
            {t('agent.onboarding.skip')}
          </Button>
          <Stack direction="row" gap={1}>
            <Button
              onClick={handleBack}
              disabled={activeStep === 0}
              size="small"
            >
              {t('agent.onboarding.back')}
            </Button>
            <Button
              onClick={handleNext}
              variant="contained"
              size="small"
              disabled={submitting}
            >
              {activeStep === 2
                ? t('agent.onboarding.finish')
                : t('agent.onboarding.next')}
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingFlow;
