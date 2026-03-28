import { useState } from 'react';
import { IconButton, Tooltip, CircularProgress } from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useTranslation } from 'react-i18next';

interface CSVExportButtonProps {
  onExport: () => Promise<void>;
}

const CSVExportButton = ({ onExport }: CSVExportButtonProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await onExport();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip title={t('dashboard.export.tooltip')}>
      <IconButton
        size="small"
        onClick={handleClick}
        disabled={loading}
        aria-label={t('dashboard.export.tooltip')}
      >
        {loading ? (
          <CircularProgress size={16} color="inherit" />
        ) : (
          <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
        )}
      </IconButton>
    </Tooltip>
  );
};

export default CSVExportButton;
