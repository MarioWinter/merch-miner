import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { useTranslation } from 'react-i18next';

const ONBOARDING_KEY = 'mm-agent-onboarding-dismissed';

interface OnboardingBannerProps {
  onSetup: () => void;
  onDismiss: () => void;
}

const OnboardingBanner = ({ onSetup, onDismiss }: OnboardingBannerProps) => {
  const { t } = useTranslation();

  const dismissed = localStorage.getItem(ONBOARDING_KEY) === 'true';
  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
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
