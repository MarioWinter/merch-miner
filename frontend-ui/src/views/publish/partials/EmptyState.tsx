import { Box, Typography, Button } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  onImport: () => void;
  onUpload: () => void;
}

const EmptyState = ({ onImport, onUpload }: EmptyStateProps) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
      }}
    >
      <ImageOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h5" color="text.secondary" gutterBottom>
        {t('publish.empty.noDesigns')}
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
        {t('publish.empty.hint')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          startIcon={<CloudUploadOutlinedIcon />}
          onClick={onUpload}
        >
          {t('publish.empty.upload')}
        </Button>
        <Button variant="outlined" onClick={onImport}>
          {t('publish.empty.import')}
        </Button>
      </Box>
    </Box>
  );
};

export default EmptyState;
