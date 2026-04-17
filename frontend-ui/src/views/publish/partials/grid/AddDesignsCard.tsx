import { Box, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

interface AddDesignsCardProps {
  onClick: () => void;
}

const CardRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  aspectRatio: '1 / 1',
  border: `2px dashed ${alpha('#fff', 0.12)}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  cursor: 'pointer',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  gap: theme.spacing(1),
  '&:hover': {
    borderColor: alpha(COLORS.cyan, 0.3),
    '& .add-icon': {
      color: COLORS.cyan,
    },
    '& .add-label': {
      color: theme.vars.palette.text.primary,
    },
  },
}));

const AddDesignsCard = ({ onClick }: AddDesignsCardProps) => {
  const { t } = useTranslation();

  return (
    <CardRoot onClick={onClick} role="button" aria-label="Add designs">
      <AddCircleOutlineIcon
        className="add-icon"
        sx={{
          fontSize: 40,
          color: 'text.disabled',
          transition: `color ${DURATION.fast}ms ${EASING.standard}`,
        }}
      />
      <Typography
        className="add-label"
        variant="body2"
        color="text.disabled"
        sx={{ transition: `color ${DURATION.fast}ms ${EASING.standard}` }}
      >
        {t('publish.grid.addDesigns', { defaultValue: 'Add Designs' })}
      </Typography>
    </CardRoot>
  );
};

export default AddDesignsCard;
