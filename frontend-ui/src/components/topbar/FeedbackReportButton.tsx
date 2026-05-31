import { useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import { useTranslation } from 'react-i18next';

import FeedbackReportModal from '../FeedbackReportModal';

const TopbarButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
    color: theme.vars.palette.text.primary,
  },
}));

const FeedbackReportButton = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title={t('feedback.topbar.tooltip')}>
        <TopbarButton
          size="small"
          onClick={() => setOpen(true)}
          aria-label={t('feedback.topbar.tooltip')}
          data-testid="topbar-open-feedback"
        >
          <FeedbackOutlinedIcon sx={{ fontSize: 20 }} />
        </TopbarButton>
      </Tooltip>
      <FeedbackReportModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default FeedbackReportButton;
