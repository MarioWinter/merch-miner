import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

interface PrivacySectionProps {
  headingKey: string;
  headingFallback: string;
  children: ReactNode;
}

const PrivacySection = ({
  headingKey,
  headingFallback,
  children,
}: PrivacySectionProps) => {
  const { t } = useTranslation();
  return (
    <Box component="section">
      <Typography variant="h6" component="h2" gutterBottom>
        {t(headingKey, headingFallback)}
      </Typography>
      {children}
    </Box>
  );
};

export default PrivacySection;
