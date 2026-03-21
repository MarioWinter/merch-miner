import { Box, LinearProgress, Typography } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { NicheResearchProgress } from '../types';

interface ResearchProgressCellProps {
  progress: NicheResearchProgress;
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const Wrapper = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 100,
});

const NodeLabel = styled(Typography)({
  animation: `${pulse} 1.2s infinite ease-in-out`,
  fontSize: '0.6875rem',
  lineHeight: 1.2,
});

export const ResearchProgressCell = ({ progress }: ResearchProgressCellProps) => {
  const { t } = useTranslation();
  const { completed_nodes, current_node, total_nodes } = progress;
  const completedCount = completed_nodes.length;
  const pct = total_nodes > 0 ? (completedCount / total_nodes) * 100 : 0;

  return (
    <Wrapper>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {completedCount}/{total_nodes}
        </Typography>
        {current_node && (
          <NodeLabel variant="caption" color="secondary.main" noWrap>
            {t(`research.steps.${current_node}`, { defaultValue: current_node })}
          </NodeLabel>
        )}
      </Box>
      <LinearProgress
        variant={completedCount > 0 ? 'determinate' : 'indeterminate'}
        value={pct}
        color="secondary"
        sx={{ height: 3, borderRadius: 1.5 }}
      />
    </Wrapper>
  );
};
