import { useState } from 'react';
import {
  Button,
  Chip,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { Box } from '@mui/material';
import { alpha, styled, keyframes } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ResearchProgressStepper } from '../../research/partials/ResearchProgressStepper';
import {
  MARKETPLACES,
  PRODUCT_TYPES,
} from '../../research/types';
import type {
  Marketplace,
  ProductType,
  ResearchRunStatus,
} from '../../research/types';
import type { Niche } from '../types';
import { CollectedItemsSection } from './CollectedItemsSection';
import { CollectedProductsSection } from './CollectedProductsSection';

interface DrawerResearchSectionProps {
  niche: Niche;
  isBusy: boolean;
}

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const ResearchSectionWrapper = styled(Box)({
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 16,
  background: 'rgba(11,39,49,0.40)',
});

const ResearchHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 12,
});

const StartButton = styled(Button)({
  background: 'linear-gradient(135deg, #FF5A4F 0%, #E84B42 100%)',
  backgroundSize: '200% 100%',
  color: '#FFFFFF',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: '0.875rem',
  textTransform: 'none',
  '&:hover': {
    background: 'linear-gradient(135deg, #FF5A4F 0%, #E84B42 50%, #FF5A4F 100%)',
    backgroundSize: '200% 100%',
    animation: `${shimmer} 2s infinite linear`,
  },
  '&.Mui-disabled': {
    color: 'rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.08)',
  },
});

export const DrawerResearchSection = ({ niche, isBusy }: DrawerResearchSectionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [marketplace, setMarketplace] = useState<Marketplace>('amazon_com');
  const [productType, setProductType] = useState<ProductType>('t_shirt');
  const [forceRefresh, setForceRefresh] = useState(false);

  const researchProgress = niche.research_progress ?? null;
  const researchStatus = (researchProgress?.status ?? null) as ResearchRunStatus | null;
  const isResearchBusy = researchStatus === 'pending' || researchStatus === 'running';
  const isResearchDone = researchStatus === 'completed';
  const isResearchFailed = researchStatus === 'failed';
  const retryCount = researchProgress?.retry_count ?? 0;
  const retriesExhausted = retryCount >= 3;

  const handleStartResearch = () => {
    const params = new URLSearchParams({
      nicheId: niche.id,
      nicheName: niche.name,
      marketplace,
      product_type: productType,
      ...(forceRefresh ? { force_refresh: 'true' } : {}),
    });
    navigate(`/niches/research?${params.toString()}`);
  };

  const handleStopResearch = () => {
    navigate(
      `/niches/research?nicheId=${niche.id}&nicheName=${encodeURIComponent(niche.name)}&action=cancel`,
    );
  };

  const handleViewResults = () => {
    navigate(
      `/niches/research?nicheId=${niche.id}&nicheName=${encodeURIComponent(niche.name)}`,
    );
  };

  return (
    <>
      <ResearchSectionWrapper>
        <ResearchHeader>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: COLORS.cyan }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: COLORS.snow }}>
            {t('research.drawer.sectionTitle')}
          </Typography>
          {isResearchDone && (
            <CheckCircleOutlineIcon
              sx={{ fontSize: 16, color: COLORS.successDk, ml: 'auto' }}
            />
          )}
          {isResearchFailed && (
            <ErrorOutlineIcon
              sx={{ fontSize: 16, color: COLORS.errorDk, ml: 'auto' }}
            />
          )}
        </ResearchHeader>

        {/* STATE: Running */}
        {isResearchBusy && researchProgress && (
          <Stack spacing={1.5}>
            <ResearchProgressStepper
              completedNodes={researchProgress.completed_nodes}
              currentNode={researchProgress.current_node}
              status={researchStatus!}
              compact
            />
            <Button
              variant="outlined"
              color="error"
              size="small"
              fullWidth
              startIcon={<StopCircleIcon sx={{ fontSize: 16 }} />}
              onClick={handleStopResearch}
              sx={{
                borderColor: alpha(COLORS.errorDk, 0.3),
                '&:hover': { backgroundColor: alpha(COLORS.errorDk, 0.08) },
              }}
            >
              {t('research.stopButton')}
            </Button>
          </Stack>
        )}

        {/* STATE: Completed */}
        {isResearchDone && researchProgress && (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              {researchProgress.marketplace && (
                <Chip
                  size="small"
                  label={t(`research.marketplace.${researchProgress.marketplace}`, {
                    defaultValue: researchProgress.marketplace,
                  })}
                  variant="outlined"
                  sx={{ borderColor: 'rgba(255,255,255,0.12)', height: 24, fontSize: '0.7rem' }}
                />
              )}
              {researchProgress.product_type && (
                <Chip
                  size="small"
                  label={t(`research.productType.${researchProgress.product_type}`, {
                    defaultValue: researchProgress.product_type,
                  })}
                  variant="outlined"
                  sx={{ borderColor: 'rgba(255,255,255,0.12)', height: 24, fontSize: '0.7rem' }}
                />
              )}
              <Chip
                size="small"
                label={`${researchProgress.completed_nodes.length}/${researchProgress.total_nodes}`}
                sx={{
                  height: 24,
                  fontSize: '0.7rem',
                  bgcolor: alpha(COLORS.successDk, 0.12),
                  color: COLORS.successDk,
                }}
              />
            </Stack>

            <Button
              variant="outlined"
              size="small"
              fullWidth
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              onClick={handleViewResults}
              sx={{
                borderColor: alpha(COLORS.cyan, 0.3),
                color: COLORS.cyan,
                '&:hover': { backgroundColor: alpha(COLORS.cyan, 0.08) },
              }}
            >
              {t('research.drawer.viewResults')}
            </Button>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                size="small"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
              />
              <Typography
                variant="caption"
                sx={{
                  color: forceRefresh ? COLORS.snow : COLORS.snowMuted,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => setForceRefresh(!forceRefresh)}
              >
                {t('research.drawer.reAnalyze')}
              </Typography>
            </Stack>

            {forceRefresh && (
              <StartButton
                size="small"
                fullWidth
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={handleStartResearch}
              >
                {t('research.drawer.reAnalyze')}
              </StartButton>
            )}
          </Stack>
        )}

        {/* STATE: Failed */}
        {isResearchFailed && researchProgress && (
          <Stack spacing={1.5}>
            <Typography variant="caption" sx={{ color: COLORS.errorDk }}>
              {researchProgress.current_node
                ? t('research.drawer.failedMessage', {
                    message: `Failed at ${researchProgress.current_node}`,
                  })
                : t('research.drawer.failedMessage', { message: 'Unknown error' })}
            </Typography>

            {retriesExhausted ? (
              <Typography variant="caption" sx={{ color: COLORS.snowMuted }}>
                {t('research.drawer.retriesExhausted', { max: 3 })}
              </Typography>
            ) : (
              <Button
                variant="outlined"
                color="error"
                size="small"
                fullWidth
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={handleStartResearch}
                sx={{
                  borderColor: alpha(COLORS.errorDk, 0.3),
                  '&:hover': { backgroundColor: alpha(COLORS.errorDk, 0.08) },
                }}
              >
                {t('research.retryCount', { current: retryCount, max: 3 })}
              </Button>
            )}
          </Stack>
        )}

        {/* STATE: Idle */}
        {!isResearchBusy && !isResearchDone && !isResearchFailed && (
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1}>
              <TextField
                select
                size="small"
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value as Marketplace)}
                label={t('research.marketplace.label')}
                fullWidth
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
                fullWidth
              >
                {PRODUCT_TYPES.map((pt) => (
                  <MenuItem key={pt} value={pt}>
                    {t(`research.productType.${pt}`)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <StartButton
              size="small"
              fullWidth
              startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
              onClick={handleStartResearch}
              disabled={isBusy}
            >
              {t('research.drawer.startResearch')}
            </StartButton>
          </Stack>
        )}
      </ResearchSectionWrapper>

      <CollectedProductsSection nicheId={niche.id} />
      <CollectedItemsSection nicheId={niche.id} />
    </>
  );
};
