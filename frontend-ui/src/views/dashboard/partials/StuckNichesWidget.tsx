import { Card, CardContent, Chip, List, ListItemButton, ListItemText, Skeleton, Stack, Typography } from '@mui/material';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { StuckNiche } from '../types';

interface StuckNichesWidgetProps {
  niches: StuckNiche[];
  isLoading: boolean;
}

const StuckNichesWidget = ({ niches, isLoading }: StuckNichesWidgetProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card elevation={0}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <WarningAmberOutlinedIcon color="warning" sx={{ fontSize: 20 }} />
          <Typography variant="h6">
            {t('dashboard.stuck.title')}
          </Typography>
        </Stack>
        {isLoading ? (
          <Stack spacing={1}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" height={40} />
            ))}
          </Stack>
        ) : niches.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.stuck.empty')}
          </Typography>
        ) : (
          <List disablePadding>
            {niches.map((niche) => (
              <ListItemButton
                key={niche.id}
                onClick={() => navigate(`/niches?selected=${niche.id}`)}
                sx={{ borderRadius: 1, py: 0.5 }}
              >
                <ListItemText
                  primary={niche.name}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={niche.status.replace(/_/g, ' ')}
                    size="small"
                    variant="outlined"
                  />
                  <Typography variant="caption" color="warning.main" fontWeight={600}>
                    {t('dashboard.stuck.daysStuck', { days: niche.days_stuck })}
                  </Typography>
                </Stack>
              </ListItemButton>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default StuckNichesWidget;
