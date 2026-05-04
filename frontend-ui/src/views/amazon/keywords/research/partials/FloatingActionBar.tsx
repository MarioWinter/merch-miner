import { Box, Button, Tooltip, Typography } from '@mui/material';
import { alpha, styled, keyframes } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { EASING, DURATION } from '@/style/constants';
import { AddToNicheButton } from './AddToNicheButton';

interface FloatingActionBarProps {
  selectedCount: number;
  selectedKeywords: string[];
  onClearSelection: () => void;
}

const slideUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ActionBarRoot = styled(Box)(({ theme }) => ({
  position: 'sticky',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 3),
  background: alpha(theme.palette.background.paper, 0.75),
  backdropFilter: 'blur(16px)',
  borderTop: `1px solid ${alpha(theme.palette.text.primary, 0.10)}`,
  borderRadius: '12px 12px 0 0',
  boxShadow: `0 -8px 32px ${alpha(theme.palette.common.black, 0.40)}`,
  zIndex: 10,
  animation: `${slideUp} ${DURATION.slow}ms ${EASING.enter}`,
}));

const SelectedCount = styled(Typography)(({ theme }) => ({
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: theme.vars.palette.primary.light,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  '&::before': {
    content: '""',
    display: 'block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: theme.vars.palette.primary.main,
    boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.50)}`,
  },
}));

export const FloatingActionBar = ({
  selectedCount,
  selectedKeywords,
  onClearSelection,
}: FloatingActionBarProps) => {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <ActionBarRoot>
      <SelectedCount>
        {t('keywords.actionBar.selected', { count: selectedCount })}
      </SelectedCount>

      <Box sx={{ flex: 1 }} />

      <AddToNicheButton
        selectedKeywords={selectedKeywords}
        activeNicheId={null}
        activeNicheName={null}
        onClearSelection={onClearSelection}
      />

      <Tooltip title={t('keywords.suggestionTabs.comingSoon')}>
        <span>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            disabled
            sx={(theme) => ({
              borderColor: theme.vars.palette.divider,
              '&.Mui-disabled': {
                borderColor: theme.vars.palette.divider,
                color: theme.vars.palette.text.disabled,
              },
            })}
          >
            {t('keywords.actionBar.enrich')}
          </Button>
        </span>
      </Tooltip>
    </ActionBarRoot>
  );
};
