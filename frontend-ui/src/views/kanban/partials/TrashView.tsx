import {
  Box,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import RestoreFromTrashOutlinedIcon from '@mui/icons-material/RestoreFromTrashOutlined';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListTrashQuery, useRestoreDesignMutation } from '@/store/kanbanSlice';
import type { DesignTrashItem } from '../types';

const TrashRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1, 1.5),
  borderRadius: 8,
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const TinyThumb = styled('img')({
  width: 36,
  height: 36,
  borderRadius: 4,
  objectFit: 'cover',
});

// Compute days remaining until expiry
const daysUntil = (expiresAt: string): number => {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
};

interface TrashItemRowProps {
  item: DesignTrashItem;
  onRestore: (designId: string) => void;
}

const TrashItemRow = ({ item, onRestore }: TrashItemRowProps) => {
  const { t } = useTranslation();
  const days = daysUntil(item.expires_at);

  return (
    <TrashRow>
      {item.thumbnail_url ? (
        <TinyThumb src={item.thumbnail_url} alt={item.file_name} />
      ) : (
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ImageOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        </Box>
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap>
          {item.file_name}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {t('kanban.trash.expiresIn', { days })}
        </Typography>
      </Box>

      <Button
        size="small"
        startIcon={<RestoreFromTrashOutlinedIcon sx={{ fontSize: 16 }} />}
        onClick={() => onRestore(item.design)}
      >
        {t('kanban.trash.restore')}
      </Button>
    </TrashRow>
  );
};

interface TrashViewProps {
  nicheId?: string;
}

const TrashView = ({ nicheId }: TrashViewProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data, isLoading } = useListTrashQuery({});
  const [restore] = useRestoreDesignMutation();

  const items: DesignTrashItem[] = data?.results ?? [];

  const handleRestore = async (designId: string) => {
    try {
      await restore({ designId, nicheId: nicheId ?? '' }).unwrap();
      enqueueSnackbar(t('kanban.trash.restoreSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('kanban.trash.restoreError'), { variant: 'error' });
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 3, gap: 1 }}>
        <DeleteForeverOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.disabled">
          {t('kanban.trash.empty')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((item) => (
        <TrashItemRow key={item.id} item={item} onRestore={handleRestore} />
      ))}
    </Box>
  );
};

export default TrashView;
