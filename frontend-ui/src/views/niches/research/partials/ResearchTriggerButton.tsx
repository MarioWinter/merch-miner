import { useState } from 'react';
import {
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { useTranslation } from 'react-i18next';
import {
  MARKETPLACES,
  PRODUCT_TYPES,
} from '../types';
import type {
  Marketplace,
  ProductType,
  ResearchRunStatus,
  ResearchTriggerParams,
} from '../types';

interface ResearchTriggerButtonProps {
  status: ResearchRunStatus | null;
  isPolling: boolean;
  onTrigger: (params?: ResearchTriggerParams) => void;
  onCancel: () => void;
}

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const AiButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(135deg, #FF5A4F 0%, #E84B42 100%)',
  backgroundSize: '200% 100%',
  color: '#FFFFFF',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: '0.875rem',
  textTransform: 'none',
  padding: '8px 20px',
  minHeight: 36,
  '&:hover': {
    background: `linear-gradient(135deg, #FF5A4F 0%, #E84B42 50%, #FF5A4F 100%)`,
    backgroundSize: '200% 100%',
    animation: `${shimmer} 2s infinite linear`,
  },
  '&.Mui-disabled': {
    color: theme.vars.palette.text.disabled,
    background: theme.vars.palette.action.disabledBackground,
  },
}));

export const ResearchTriggerButton = ({
  status,
  isPolling,
  onTrigger,
  onCancel,
}: ResearchTriggerButtonProps) => {
  const { t } = useTranslation();
  const isBusy = status === 'pending' || status === 'running' || isPolling;
  const showForceRefresh = status === 'completed' || status === 'failed';

  const [marketplace, setMarketplace] = useState<Marketplace>('amazon_com');
  const [productType, setProductType] = useState<ProductType>('t_shirt');
  const [forceRefresh, setForceRefresh] = useState(false);

  const handleTrigger = () => {
    onTrigger({
      marketplace,
      product_type: productType,
      ...(showForceRefresh && forceRefresh ? { force_refresh: true } : {}),
    });
  };

  if (isBusy) {
    return (
      <Stack spacing={1.5} alignItems="flex-end">
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={onCancel}
          startIcon={<StopCircleIcon sx={{ fontSize: 18 }} />}
          aria-label={t('research.stopButton')}
          sx={{ minHeight: 36, textTransform: 'none', fontWeight: 600 }}
        >
          {t('research.stopButton')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5} alignItems="flex-end">
      <Stack direction="row" spacing={1}>
        <TextField
          select
          size="small"
          value={marketplace}
          onChange={(e) => setMarketplace(e.target.value as Marketplace)}
          label={t('research.marketplace.label')}
          sx={{ minWidth: 160 }}
        >
          {MARKETPLACES.map((m) => (
            <MenuItem key={m} value={m}>
              {t(`research.marketplace.${m}`)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          value={productType}
          onChange={(e) => setProductType(e.target.value as ProductType)}
          label={t('research.productType.label')}
          sx={{ minWidth: 140 }}
        >
          {PRODUCT_TYPES.map((pt) => (
            <MenuItem key={pt} value={pt}>
              {t(`research.productType.${pt}`)}
            </MenuItem>
          ))}
        </TextField>

        <AiButton
          onClick={handleTrigger}
          startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
          aria-label={t('research.triggerButton')}
        >
          {status === 'failed'
            ? t('research.error.retryButton')
            : t('research.triggerButton')}
        </AiButton>
      </Stack>

      {showForceRefresh && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
              />
            }
            label={t('research.forceRefresh')}
            slotProps={{ typography: { variant: 'caption' } }}
          />
        </Box>
      )}
    </Stack>
  );
};
