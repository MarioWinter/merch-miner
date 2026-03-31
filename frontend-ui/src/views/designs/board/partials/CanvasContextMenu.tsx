import { useCallback, useRef } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface ContextMenuPosition {
  mouseX: number;
  mouseY: number;
}

interface CanvasContextMenuProps {
  /** Screen position for the menu anchor */
  position: ContextMenuPosition | null;
  /** World coordinates where the user right-clicked */
  worldPosition: { x: number; y: number } | null;
  onClose: () => void;
  onAddArtboard: (file: File, worldX: number, worldY: number) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const CanvasContextMenu = ({
  position,
  worldPosition,
  onClose,
  onAddArtboard,
}: CanvasContextMenuProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddArtboard = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && worldPosition) {
        onAddArtboard(file, worldPosition.x, worldPosition.y);
      }
      // Reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
      onClose();
    },
    [worldPosition, onAddArtboard, onClose],
  );

  const handlePaste = useCallback(() => {
    // TODO: implement paste from clipboard
    onClose();
  }, [onClose]);

  return (
    <>
      <Menu
        open={position !== null}
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={
          position ? { top: position.mouseY, left: position.mouseX } : undefined
        }
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              bgcolor: 'background.paper',
              borderColor: 'divider',
            },
          },
        }}
      >
        <MenuItem onClick={handleAddArtboard}>
          <ListItemIcon>
            <AddPhotoAlternateIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText>
            {t('design.contextMenu.addArtboard', 'Add Artboard')}
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={handlePaste} disabled>
          <ListItemIcon>
            <ContentPasteIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText>
            {t('design.contextMenu.paste', 'Paste')}
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFileChange}
      />
    </>
  );
};

export default CanvasContextMenu;
