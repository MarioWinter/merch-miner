import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import { useTranslation } from 'react-i18next';
import type { Design } from '../types';
import DesignSlide from './DesignSlide';

const ScrollRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1.5),
  overflowX: 'auto',
  paddingBottom: theme.spacing(1),
  '&::-webkit-scrollbar': {
    height: 6,
  },
  '&::-webkit-scrollbar-thumb': {
    borderRadius: 3,
    background: theme.vars.palette.divider,
  },
}));

interface DesignCarouselProps {
  designs: Design[];
  onApprove: (designId: string) => void;
  onReject: (designId: string, feedback: string) => void;
  onDelete: (designId: string) => void;
}

const DesignCarousel = ({ designs, onApprove, onReject, onDelete }: DesignCarouselProps) => {
  const { t } = useTranslation();

  if (designs.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 1 }}>
        <BrushOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.disabled">
          {t('kanban.empty.designs')}
        </Typography>
      </Box>
    );
  }

  return (
    <ScrollRow>
      {designs.map((d) => (
        <DesignSlide
          key={d.id}
          design={d}
          onApprove={onApprove}
          onReject={onReject}
          onDelete={onDelete}
        />
      ))}
    </ScrollRow>
  );
};

export default DesignCarousel;
