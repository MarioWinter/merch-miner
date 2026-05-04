import { Stepper, Step, StepLabel, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useTranslation } from 'react-i18next';
import type { WorkflowStep, SessionStatus } from '../types';

const StepperRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
  overflowX: 'auto',
}));

const PulsingDot = styled('span')(({ theme }) => ({
  display: 'inline-block',
  width: 10,
  height: 10,
  borderRadius: '50%',
  backgroundColor: theme.vars.palette.primary.main,
  animation: 'pulse 1.2s infinite',
  '@keyframes pulse': {
    '0%, 100%': { opacity: 0.6 },
    '50%': { opacity: 1 },
  },
}));

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  completedSteps: number;
  currentStep: string;
  sessionStatus: SessionStatus;
}

const WorkflowStepper = ({
  steps,
  completedSteps,
  currentStep,
  sessionStatus,
}: WorkflowStepperProps) => {
  const { t } = useTranslation();

  if (steps.length === 0) return null;

  const activeStepIndex = steps.findIndex(
    (s) => s.action === currentStep || s.agent_type === currentStep,
  );
  const resolvedActive = activeStepIndex >= 0 ? activeStepIndex : completedSteps;
  const isFailed = sessionStatus === 'failed';

  return (
    <StepperRoot>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {t('agent.stepper.title')}
      </Typography>
      <Stepper activeStep={resolvedActive} alternativeLabel>
        {steps.map((step, idx) => {
          const completed = idx < completedSteps;
          const active = idx === resolvedActive;
          const failed = isFailed && active;

          return (
            <Step key={step.action} completed={completed}>
              <StepLabel
                icon={
                  failed ? (
                    <ErrorIcon color="error" sx={{ fontSize: 18 }} />
                  ) : completed ? (
                    <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                  ) : active && sessionStatus === 'running' ? (
                    <PulsingDot />
                  ) : (
                    <RadioButtonUncheckedIcon
                      sx={{ fontSize: 18, color: 'text.disabled' }}
                    />
                  )
                }
              >
                <Typography
                  variant="caption"
                  color={active ? 'text.primary' : 'text.secondary'}
                  sx={{ fontWeight: active ? 600 : 400 }}
                >
                  {step.description || step.action}
                </Typography>
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </StepperRoot>
  );
};

export default WorkflowStepper;
