import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import { useTranslation } from 'react-i18next';

const Root = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(4, 2),
  gap: theme.spacing(1),
}));

const EmptyColumn = () => {
  const { t } = useTranslation();
  return (
    <Root>
      <ViewKanbanOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
      <Typography variant="body2" color="text.disabled">
        {t('kanban.empty.column')}
      </Typography>
    </Root>
  );
};

export default EmptyColumn;
