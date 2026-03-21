import { Box, LinearProgress, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { ResearchProgressStepper } from './ResearchProgressStepper';
import type { ResearchRunStatus } from '../types';

interface ResearchProgressProps {
  status: ResearchRunStatus;
  completedNodes?: string[];
  currentNode?: string;
  totalNodes?: number;
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const ProgressWrapper = styled(Box)(({ theme }) => ({
  padding: theme.spacing(4, 3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(3),
}));

const PulseText = styled(Typography)({
  animation: `${pulse} 1.2s infinite ease-in-out`,
});

export const ResearchProgress = ({
  status,
  completedNodes = [],
  currentNode = '',
  totalNodes = 6,
}: ResearchProgressProps) => {
  const { t } = useTranslation();
  const completedCount = completedNodes.length;
  const progressPct = totalNodes > 0 ? (completedCount / totalNodes) * 100 : 0;

  return (
    <ProgressWrapper>
      <PulseText variant="h5" color="text.secondary" fontWeight={600}>
        {t('research.progressTitle')}
      </PulseText>

      <Box sx={{ width: '100%', maxWidth: 600 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {t('research.progressLabel', {
              completed: completedCount,
              total: totalNodes,
            })}
          </Typography>
          {currentNode && (
            <Typography variant="caption" color="secondary.main">
              {t('research.currentNode', {
                node: t(`research.steps.${currentNode}`, { defaultValue: currentNode }),
              })}
            </Typography>
          )}
        </Box>
        <LinearProgress
          variant={completedCount > 0 ? 'determinate' : 'indeterminate'}
          value={progressPct}
          color="secondary"
          sx={{ height: 4, borderRadius: 2 }}
        />
      </Box>

      <Box sx={{ width: '100%', maxWidth: 700 }}>
        <ResearchProgressStepper
          completedNodes={completedNodes}
          currentNode={currentNode}
          status={status}
        />
      </Box>

      <Typography variant="body2" color="text.secondary">
        {t('research.progressHint')}
      </Typography>
    </ProgressWrapper>
  );
};
