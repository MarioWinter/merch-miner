import { Step, StepLabel, Stepper } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslation } from 'react-i18next';
import { RESEARCH_NODE_NAMES } from '../types';
import type { ResearchRunStatus } from '../types';

interface ResearchProgressStepperProps {
  completedNodes: string[];
  currentNode: string;
  status: ResearchRunStatus;
  compact?: boolean;
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

const ActiveIcon = styled(CircularProgress)({
  animation: `${pulse} 1.2s infinite ease-in-out`,
});

const getActiveStepIndex = (
  completedNodes: string[],
  currentNode: string,
): number => {
  if (currentNode) {
    const nodeIdx = RESEARCH_NODE_NAMES.indexOf(
      currentNode as (typeof RESEARCH_NODE_NAMES)[number],
    );
    if (nodeIdx !== -1) return nodeIdx;
  }
  return completedNodes.length;
};

const StepIcon = ({
  completed,
  active,
  error,
}: {
  completed: boolean;
  active: boolean;
  error: boolean;
}) => {
  if (error) return <ErrorOutlineIcon color="error" sx={{ fontSize: 20 }} />;
  if (completed)
    return <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />;
  if (active) return <ActiveIcon size={18} color="secondary" />;
  return null;
};

export const ResearchProgressStepper = ({
  completedNodes,
  currentNode,
  status,
  compact = false,
}: ResearchProgressStepperProps) => {
  const { t } = useTranslation();
  const activeStep = getActiveStepIndex(completedNodes, currentNode);
  const isFailed = status === 'failed';

  return (
    <Stepper
      activeStep={activeStep}
      alternativeLabel={!compact}
      orientation={compact ? 'vertical' : 'horizontal'}
      sx={compact ? { '& .MuiStepLabel-label': { fontSize: '0.75rem' } } : undefined}
    >
      {RESEARCH_NODE_NAMES.map((nodeName) => {
        const isCompleted = completedNodes.includes(nodeName);
        const isActive = nodeName === currentNode;
        const isErrorStep = isFailed && isActive;

        return (
          <Step key={nodeName} completed={isCompleted}>
            <StepLabel
              error={isErrorStep}
              StepIconComponent={
                isCompleted || isActive || isErrorStep
                  ? () => (
                      <StepIcon
                        completed={isCompleted}
                        active={isActive && !isErrorStep}
                        error={isErrorStep}
                      />
                    )
                  : undefined
              }
              slotProps={{
                label: {
                  sx: isErrorStep ? { color: 'error.main' } : undefined,
                },
              }}
            >
              {t(`research.steps.${nodeName}`, { defaultValue: nodeName })}
            </StepLabel>
          </Step>
        );
      })}
    </Stepper>
  );
};
