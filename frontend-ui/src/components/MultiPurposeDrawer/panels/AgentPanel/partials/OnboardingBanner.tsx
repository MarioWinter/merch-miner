import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { useTranslation } from 'react-i18next';
import { ONBOARDING_DONE_KEY } from './OnboardingFlow';

const ONBOARDING_DISMISSED_KEY = 'mm-agent-onboarding-dismissed';

interface OnboardingBannerProps {
  onSetup: () => void;
  onDismiss: () => void;
}

const OnboardingBanner = ({ onSetup, onDismiss }: OnboardingBannerProps) => {
  const { t } = useTranslation();

  // AC-59: Banner is non-blocking. We hide it as soon as either the user
  // dismisses it OR completes the guided onboarding flow.
  const dismissed =
    localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true' ||
    localStorage.getItem(ONBOARDING_DONE_KEY) === 'true';
  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
    onDismiss();
  };

  return (
    <Alert
      severity="info"
      icon={<SmartToyOutlinedIcon />}
      onClose={handleDismiss}
      sx={{ mx: 2, mt: 2, borderRadius: 2 }}
    >
      <AlertTitle>{t('agent.onboarding.title')}</AlertTitle>
      {t('agent.onboarding.message')}
      <Stack direction="row" gap={1} sx={{ mt: 1 }}>
        <Button size="small" variant="contained" onClick={onSetup}>
          {t('agent.onboarding.setup')}
        </Button>
        <Button size="small" variant="text" onClick={handleDismiss}>
          {t('agent.onboarding.skip')}
        </Button>
      </Stack>
    </Alert>
  );
};

export default OnboardingBanner;
