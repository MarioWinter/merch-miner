import {
  Card, CardContent, LinearProgress, Skeleton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import CSVExportButton from './CSVExportButton';
import PlaceholderWidget from './PlaceholderWidget';
import type { AgentActivity } from '../types';

interface AgentActivityWidgetProps {
  data: AgentActivity | null;
  isLoading: boolean;
  onExport: () => Promise<void>;
}

const AgentActivityWidget = ({ data, isLoading, onExport }: AgentActivityWidgetProps) => {
  const { t } = useTranslation();

  if (!isLoading && data?.configured === false) {
    return (
      <PlaceholderWidget
        title={t('dashboard.agent.title')}
        message={data.message ?? t('dashboard.placeholder.agentNotConfigured')}
      />
    );
  }

  return (
    <Card elevation={0}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">{t('dashboard.agent.title')}</Typography>
          <CSVExportButton onExport={onExport} />
        </Stack>

        {isLoading ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={24} />
            <Skeleton variant="rounded" height={120} />
          </Stack>
        ) : !data ? (
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.analytics.noData')}
          </Typography>
        ) : (
          <Stack spacing={2}>
            {/* Summary row */}
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.agent.activeWorkflows')}
                </Typography>
                <Typography variant="h4">{data.active_workflows}</Typography>
              </Stack>
              <Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.agent.successRate')}
                </Typography>
                <Typography variant="h4">
                  {Math.round((data.success_rate ?? 0) * 100)}%
                </Typography>
              </Stack>
              <Stack sx={{ minWidth: 140 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('dashboard.agent.budgetUsage')}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={data.budget_usage_percent ?? 0}
                  sx={{ mt: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {data.budget_usage_percent}%
                </Typography>
              </Stack>
            </Stack>

            {/* Per-agent stats table */}
            {data.per_agent_stats && Object.keys(data.per_agent_stats).length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('dashboard.agent.agentType')}</TableCell>
                      <TableCell align="right">{t('dashboard.agent.runs')}</TableCell>
                      <TableCell align="right">{t('dashboard.agent.cost')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(data.per_agent_stats).map(([agent, stats]) => (
                      <TableRow key={agent}>
                        <TableCell>
                          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {agent}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{stats.runs}</TableCell>
                        <TableCell align="right">${stats.cost.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Last completed */}
            {data.last_completed && (
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.agent.lastCompleted', {
                  niche: data.last_completed.niche,
                  template: data.last_completed.template,
                  duration: data.last_completed.duration_minutes,
                })}
              </Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default AgentActivityWidget;
