import { Stack, Button, Typography, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import BoltIcon from '@mui/icons-material/Bolt';
import { useTranslation } from 'react-i18next';
import type { WorkflowTemplate } from '../types';

const BarRoot = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(2),
  gap: theme.spacing(1.5),
}));

const TemplateButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  justifyContent: 'flex-start',
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1, 2),
  border: `1px solid ${theme.vars.palette.divider}`,
  color: theme.vars.palette.text.primary,
  '&:hover': {
    backgroundColor: `rgba(255, 90, 79, 0.08)`,
    borderColor: theme.vars.palette.primary.main,
  },
}));

interface QuickActionBarProps {
  templates: WorkflowTemplate[];
  loading: boolean;
  onStartWorkflow: (templateKey: string) => void;
}

const QuickActionBar = ({
  templates,
  loading,
  onStartWorkflow,
}: QuickActionBarProps) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <BarRoot>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={40} />
        ))}
      </BarRoot>
    );
  }

  if (templates.length === 0) return null;

  return (
    <BarRoot>
      <Typography variant="subtitle2" color="text.secondary">
        {t('agent.quickAction.title')}
      </Typography>
      {templates.map((tpl) => (
        <TemplateButton
          key={tpl.key}
          variant="outlined"
          startIcon={<BoltIcon sx={{ fontSize: 18 }} />}
          onClick={() => onStartWorkflow(tpl.key)}
        >
          <Stack sx={{ textAlign: 'left' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {tpl.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tpl.steps.map((s) => s.description || s.action).join(' → ')}
            </Typography>
          </Stack>
        </TemplateButton>
      ))}
    </BarRoot>
  );
};

export default QuickActionBar;
