import { useState } from 'react';
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TaggingOptionsMenuProps {
  /** Disable when the active listing has no keyword field (MBA). */
  disabled?: boolean;
  onCopyEnToAll: () => void;
  onClearAll: () => void;
  onImportCsv: () => void;
}

// ---------------------------------------------------------------------------
// Component — AC-134
// ---------------------------------------------------------------------------

const TaggingOptionsMenu = ({
  disabled = false,
  onCopyEnToAll,
  onClearAll,
  onImportCsv,
}: TaggingOptionsMenuProps) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const run = (fn: () => void) => {
    handleClose();
    fn();
  };

  return (
    <>
      <Button
        variant="text"
        size="small"
        onClick={handleOpen}
        endIcon={<ArrowDropDownIcon />}
        disabled={disabled}
        data-testid="TaggingOptionsMenu-button"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {t('publish.edit.global.tagging.button', {
          defaultValue: 'Tagging Options',
        })}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{ 'aria-label': 'tagging options' }}
      >
        <MenuItem
          onClick={() => run(onCopyEnToAll)}
          data-testid="TaggingOptionsMenu-copyEn"
        >
          <ListItemIcon>
            <ContentCopyOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('publish.edit.global.tagging.copyEn', {
              defaultValue: 'Copy EN keywords to all languages',
            })}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => run(onImportCsv)}
          data-testid="TaggingOptionsMenu-importCsv"
        >
          <ListItemIcon>
            <FileUploadOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('publish.edit.global.tagging.importCsv', {
              defaultValue: 'Import keywords from CSV',
            })}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => run(onClearAll)}
          data-testid="TaggingOptionsMenu-clearAll"
        >
          <ListItemIcon>
            <DeleteSweepOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('publish.edit.global.tagging.clearAll', {
              defaultValue: 'Clear all keywords',
            })}
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default TaggingOptionsMenu;
