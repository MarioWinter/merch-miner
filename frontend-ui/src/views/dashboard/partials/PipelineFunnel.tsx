import { Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../style/constants';
import type { NicheCounts } from '../types';

interface FunnelStage {
  key: keyof NicheCounts;
  label: string;
  color: string;
}

const FunnelBar = styled('div')<{ color: string; widthPercent: number }>(
  ({ color, widthPercent }) => ({
    height: 32,
    borderRadius: 6,
    backgroundColor: alpha(color, 0.18),
    border: `1px solid ${alpha(color, 0.3)}`,
    width: `${Math.max(widthPercent, 8)}%`,
    minWidth: 48,
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 12,
    transition: 'width 300ms ease',
  }),
);

interface PipelineFunnelProps {
  nicheCounts: NicheCounts | null;
  isLoading: boolean;
}

const PipelineFunnel = ({ nicheCounts, isLoading }: PipelineFunnelProps) => {
  const { t } = useTranslation();

  const stages: FunnelStage[] = [
    { key: 'research', label: t('dashboard.funnel.research'), color: COLORS.infoDk },
    { key: 'design', label: t('dashboard.funnel.design'), color: COLORS.cyan },
    { key: 'publish', label: t('dashboard.funnel.publish'), color: COLORS.warningDk },
    { key: 'live', label: t('dashboard.funnel.live'), color: COLORS.successDk },
  ];

  const total = nicheCounts
    ? stages.reduce((sum, s) => sum + (nicheCounts[s.key] ?? 0), 0)
    : 0;

  return (
    <Card elevation={0}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('dashboard.funnel.title')}
        </Typography>
        {isLoading ? (
          <Stack spacing={1.5}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rounded" height={32} />
            ))}
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            {stages.map((stage) => {
              const count = nicheCounts?.[stage.key] ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <Stack key={stage.key} direction="row" alignItems="center" spacing={1.5}>
                  <Typography variant="body2" color="text.secondary" sx={{ width: 80, flexShrink: 0 }}>
                    {stage.label}
                  </Typography>
                  <FunnelBar color={stage.color} widthPercent={pct}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {count}
                    </Typography>
                  </FunnelBar>
                </Stack>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default PipelineFunnel;
