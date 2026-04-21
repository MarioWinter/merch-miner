import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DesignCardMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onAddTags: () => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DesignCardMenu = ({
  anchorEl,
  open,
  onClose,
  onEdit,
  onDuplicate,
  onMove,
  onAddTags,
  onDelete,
}: DesignCardMenuProps) => {
  const { t } = useTranslation();

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      onClick={(e) => e.stopPropagation()}
      slotProps={{ paper: { sx: { minWidth: 180 } } }}
    >
      <MenuItem onClick={onEdit}>
        <ListItemIcon>
          <EditOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>
          {t('publish.card.menu.edit', { defaultValue: 'Edit' })}
        </ListItemText>
      </MenuItem>
      <MenuItem onClick={onDuplicate}>
        <ListItemIcon>
          <ContentCopyOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>
          {t('publish.card.menu.duplicate', { defaultValue: 'Duplicate' })}
        </ListItemText>
      </MenuItem>
      <MenuItem onClick={onMove}>
        <ListItemIcon>
          <DriveFileMoveOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>
          {t('publish.card.menu.move', { defaultValue: 'Move to Collection' })}
        </ListItemText>
      </MenuItem>
      <MenuItem onClick={onAddTags}>
        <ListItemIcon>
          <LocalOfferOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>
          {t('publish.card.menu.addTags', { defaultValue: 'Add Tags' })}
        </ListItemText>
      </MenuItem>
      <MenuItem onClick={onDelete} sx={{ color: 'error.main' }}>
        <ListItemIcon>
          <DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} />
        </ListItemIcon>
        <ListItemText>
          {t('publish.card.menu.delete', { defaultValue: 'Delete' })}
        </ListItemText>
      </MenuItem>
    </Menu>
  );
};

export default DesignCardMenu;
