import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { useTranslation } from 'react-i18next';
import { useGetQuotaQuery } from '@/store/upscaleApi';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: 18,
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

const QuotaCard = styled(Card)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  boxShadow: 'none',
}));

const RingWrap = styled(Box)({
  position: 'relative',
  width: 96,
  height: 96,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const RingTrack = styled(CircularProgress)(({ theme }) => ({
  position: 'absolute',
  color: theme.vars.palette.action.hover,
}));

const RingValue = styled(CircularProgress, {
  shouldForwardProp: (prop) => prop !== 'severity',
})<{ severity: 'normal' | 'warning' | 'error' }>(({ theme, severity }) => ({
  position: 'absolute',
  color:
    severity === 'error'
      ? theme.vars.palette.error.main
      : severity === 'warning'
        ? theme.vars.palette.warning.main
        : theme.vars.palette.primary.main,
}));

const RingCenterText = styled(Typography)({
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 14,
  fontWeight: 600,
});

const StaffBadge = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(0.5, 1),
  borderRadius: 999,
  backgroundColor: theme.vars.palette.success.main,
  color: theme.vars.palette.common.white,
  fontSize: 12,
  fontWeight: 600,
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const UsageSection = () => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetQuotaQuery();

  return (
    <Box>
      <SectionTitle>
        {t('settings.usage.title', { defaultValue: 'Usage' })}
      </SectionTitle>

      <QuotaCard>
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            {t('settings.usage.aiUpscale', { defaultValue: 'AI Upscale' })}
          </Typography>

          {isLoading && (
            <Stack direction="row" spacing={3} sx={{ mt: 2, alignItems: 'center' }}>
              <Skeleton variant="circular" width={96} height={96} />
              <Stack spacing={1} sx={{ flex: 1 }}>
                <Skeleton variant="text" width={200} />
                <Skeleton variant="text" width={140} />
              </Stack>
            </Stack>
          )}

          {isError && (
            <Typography variant="body2" color="error" sx={{ mt: 2 }}>
              {t('settings.usage.error', {
                defaultValue: 'Could not load usage. Try again later.',
              })}
            </Typography>
          )}

          {data && data.is_unlimited && (
            <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
              <StaffBadge>
                <VerifiedOutlinedIcon sx={{ fontSize: 14 }} />
                {t('settings.usage.unlimited', { defaultValue: 'Unlimited' })}
              </StaffBadge>
              <Typography variant="body2" color="text.secondary">
                {t('settings.usage.staffNote', {
                  defaultValue: 'Staff accounts have no monthly cap.',
                })}
              </Typography>
            </Stack>
          )}

          {data && !data.is_unlimited && data.limit !== null && (
            <Stack direction="row" spacing={3} sx={{ mt: 2, alignItems: 'center' }}>
              <RingWrap>
                <RingTrack
                  variant="determinate"
                  value={100}
                  size={96}
                  thickness={4}
                />
                <RingValue
                  variant="determinate"
                  value={Math.min(100, (data.used / data.limit) * 100)}
                  size={96}
                  thickness={4}
                  severity={
                    data.used >= data.limit
                      ? 'error'
                      : data.used / data.limit >= 0.8
                        ? 'warning'
                        : 'normal'
                  }
                />
                <RingCenterText>
                  {data.used}/{data.limit}
                </RingCenterText>
              </RingWrap>
              <Stack spacing={0.5}>
                <Typography variant="body2">
                  {t('settings.usage.used', {
                    defaultValue: '{{used}} of {{limit}} upscales used this month',
                    used: data.used,
                    limit: data.limit,
                  })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('settings.usage.resetsOn', {
                    defaultValue: 'Resets on {{date}}',
                    date: data.resets_on,
                  })}
                </Typography>
              </Stack>
            </Stack>
          )}
        </CardContent>
      </QuotaCard>
    </Box>
  );
};

export default UsageSection;
