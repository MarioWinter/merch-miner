import { Card, CardContent, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS } from '../../../style/constants';
import type { NicheCounts, DesignCounts, ListingCounts } from '../types';

const KPICard = styled(Card)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  borderRadius: 12,
  minWidth: 160,
  padding: '20px',
}));

const IconBox = styled('div')<{ bg: string; fg: string }>(({ bg, fg }) => ({
  width: 36,
  height: 36,
  borderRadius: 8,
  backgroundColor: bg,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: fg,
}));

interface KPIItem {
  label: string;
  value: number;
  icon: React.ReactNode;
  bgColor: string;
  fgColor: string;
}

interface KPICardsProps {
  nicheCounts: NicheCounts | null;
  designCounts: DesignCounts | null;
  listingCounts: ListingCounts | null;
  isLoading: boolean;
}

const KPICards = ({ nicheCounts, designCounts, listingCounts, isLoading }: KPICardsProps) => {
  const { t } = useTranslation();

  const items: KPIItem[] = [
    {
      label: t('dashboard.kpi.research'),
      value: nicheCounts?.research ?? 0,
      icon: <ScienceOutlinedIcon sx={{ fontSize: 20 }} />,
      bgColor: alpha(COLORS.infoDk, 0.12),
      fgColor: COLORS.infoDk,
    },
    {
      label: t('dashboard.kpi.design'),
      value: nicheCounts?.design ?? 0,
      icon: <BrushOutlinedIcon sx={{ fontSize: 20 }} />,
      bgColor: alpha(COLORS.cyan, 0.12),
      fgColor: COLORS.cyan,
    },
    {
      label: t('dashboard.kpi.publish'),
      value: nicheCounts?.publish ?? 0,
      icon: <PublishOutlinedIcon sx={{ fontSize: 20 }} />,
      bgColor: alpha(COLORS.warningDk, 0.12),
      fgColor: COLORS.warningDk,
    },
    {
      label: t('dashboard.kpi.live'),
      value: nicheCounts?.live ?? 0,
      icon: <RocketLaunchOutlinedIcon sx={{ fontSize: 20 }} />,
      bgColor: alpha(COLORS.successDk, 0.12),
      fgColor: COLORS.successDk,
    },
    {
      label: t('dashboard.kpi.designsApproved'),
      value: designCounts?.approved ?? 0,
      icon: <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />,
      bgColor: alpha(COLORS.red, 0.12),
      fgColor: COLORS.red,
    },
    {
      label: t('dashboard.kpi.listingsReady'),
      value: listingCounts?.ready ?? 0,
      icon: <ArchiveOutlinedIcon sx={{ fontSize: 20 }} />,
      bgColor: alpha(COLORS.successDk, 0.12),
      fgColor: COLORS.successDk,
    },
  ];

  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid key={item.label} size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard elevation={0}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Typography variant="overline" color="text.secondary">
                  {item.label}
                </Typography>
                <IconBox bg={item.bgColor} fg={item.fgColor}>
                  {item.icon}
                </IconBox>
              </Stack>
              {isLoading ? (
                <Skeleton width={60} height={36} />
              ) : (
                <Typography variant="h2" sx={{ mt: 1 }}>
                  {item.value}
                </Typography>
              )}
            </CardContent>
          </KPICard>
        </Grid>
      ))}
    </Grid>
  );
};

export default KPICards;
