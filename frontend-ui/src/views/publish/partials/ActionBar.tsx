import { Box, Button, Typography, Slide } from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

const Bar = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar + 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 3),
  borderTop: '1px solid',
  borderColor: theme.vars.palette.divider,
  backdropFilter: 'blur(16px)',
  backgroundColor: 'rgba(11,39,49,0.85)',
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255,255,255,0.90)',
  }),
}));

interface ActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onBulkUpload: () => void;
  onBulkDelete: () => void;
  onBulkEdit?: () => void;
  isBulkProcessing?: boolean;
}

const ActionBar = ({
  selectedCount,
  onClear,
  onBulkUpload,
  onBulkDelete,
  onBulkEdit,
  isBulkProcessing,
}: ActionBarProps) => {
  const { t } = useTranslation();

  return (
    <Slide direction="up" in={selectedCount > 0} mountOnEnter unmountOnExit>
      <Bar role="toolbar" aria-label={t('publish.actionBar.label')}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t('publish.actionBar.selected', { count: selectedCount })}
        </Typography>

        {onBulkEdit && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<EditOutlinedIcon />}
            onClick={onBulkEdit}
          >
            {t('publish.actionBar.edit')}
          </Button>
        )}

        <Button
          variant="contained"
          size="small"
          startIcon={<CloudUploadOutlinedIcon />}
          onClick={onBulkUpload}
          disabled={isBulkProcessing}
        >
          {t('publish.actionBar.uploadBatch')}
        </Button>

        <Button
          variant="outlined"
          size="small"
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={onBulkDelete}
          disabled={isBulkProcessing}
        >
          {t('publish.actionBar.delete')}
        </Button>

        <Button
          size="small"
          onClick={onClear}
          startIcon={<CloseIcon />}
        >
          {t('publish.actionBar.clear')}
        </Button>
      </Bar>
    </Slide>
  );
};

export default ActionBar;
