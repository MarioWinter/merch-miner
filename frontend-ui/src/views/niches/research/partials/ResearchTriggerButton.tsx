import { useState } from 'react';
import {
  Box,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { DataPrismButton } from '@/components/DataPrismButton';
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
  initialMarketplace?: Marketplace;
  initialProductType?: ProductType;
}

export const ResearchTriggerButton = ({
  status,
  isPolling,
  onTrigger,
  onCancel,
  initialMarketplace,
  initialProductType,
}: ResearchTriggerButtonProps) => {
  const { t } = useTranslation();
  const showForceRefresh = status === 'completed' || status === 'failed';

  const [marketplace, setMarketplace] = useState<Marketplace>(initialMarketplace ?? 'amazon_com');
  const [productType, setProductType] = useState<ProductType>(initialProductType ?? 't_shirt');
  const [forceRefresh, setForceRefresh] = useState(false);

  const handleTrigger = () => {
    onTrigger({
      marketplace,
      product_type: productType,
      ...(showForceRefresh && forceRefresh ? { force_refresh: true } : {}),
    });
  };

  const drillStatus = status as 'pending' | 'running' | 'completed' | 'failed' | null;

  return (
    <Stack spacing={1.5} alignItems="flex-end">
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
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

        <DataPrismButton
          status={drillStatus}
          isPolling={isPolling}
          onClick={handleTrigger}
          onCancel={onCancel}
        />
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
