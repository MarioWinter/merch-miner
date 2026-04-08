import { useCallback } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface ContextMenuPosition {
  mouseX: number;
  mouseY: number;
}

interface ArtboardContextMenuProps {
  /** Screen position for the menu anchor */
  position: ContextMenuPosition | null;
  /** ID of the right-clicked artboard */
  artboardId: string | null;
  /** Whether the right-clicked artboard has an image */
  hasImage?: boolean;
  onClose: () => void;
  onAddAiImageBoard: (sourceId: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (ids: string[]) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  /** Phase G13: analyze image -> generate prompt */
  onAnalyzeImage?: (artboardId: string) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ArtboardContextMenu = ({
  position,
  artboardId,
  hasImage = false,
  onClose,
  onAddAiImageBoard,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
  onAnalyzeImage,
}: ArtboardContextMenuProps) => {
  const { t } = useTranslation();

  const handleAddAiBoard = useCallback(() => {
    if (artboardId) onAddAiImageBoard(artboardId);
    onClose();
  }, [artboardId, onAddAiImageBoard, onClose]);

  const handleDuplicate = useCallback(() => {
    if (artboardId) onDuplicate(artboardId);
    onClose();
  }, [artboardId, onDuplicate, onClose]);

  const handleDelete = useCallback(() => {
    if (artboardId) onDelete([artboardId]);
    onClose();
  }, [artboardId, onDelete, onClose]);

  const handleAnalyzeImage = useCallback(() => {
    if (artboardId && onAnalyzeImage) onAnalyzeImage(artboardId);
    onClose();
  }, [artboardId, onAnalyzeImage, onClose]);

  const handleBringToFront = useCallback(() => {
    if (artboardId) onBringToFront(artboardId);
    onClose();
  }, [artboardId, onBringToFront, onClose]);

  const handleSendToBack = useCallback(() => {
    if (artboardId) onSendToBack(artboardId);
    onClose();
  }, [artboardId, onSendToBack, onClose]);

  return (
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
      <MenuItem onClick={handleAddAiBoard}>
        <ListItemIcon>
          <AutoAwesomeIcon sx={{ fontSize: 20 }} />
        </ListItemIcon>
        <ListItemText>
          {t('design.contextMenu.addAiBoard', 'Add AI Image Board')}
        </ListItemText>
      </MenuItem>

      {hasImage && onAnalyzeImage && (
        <MenuItem onClick={handleAnalyzeImage}>
          <ListItemIcon>
            <ImageSearchIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText>
            {t('design.contextMenu.analyzeImage', 'Analyze Image \u2192 Generate Prompt')}
          </ListItemText>
        </MenuItem>
      )}

      <MenuItem onClick={handleDuplicate}>
        <ListItemIcon>
          <ContentCopyIcon sx={{ fontSize: 20 }} />
        </ListItemIcon>
        <ListItemText>
          {t('design.contextMenu.duplicate', 'Duplicate')}
        </ListItemText>
      </MenuItem>

      <Divider />

      <MenuItem onClick={handleBringToFront}>
        <ListItemIcon>
          <FlipToFrontIcon sx={{ fontSize: 20 }} />
        </ListItemIcon>
        <ListItemText>
          {t('design.contextMenu.bringToFront', 'Bring to Front')}
        </ListItemText>
      </MenuItem>

      <MenuItem onClick={handleSendToBack}>
        <ListItemIcon>
          <FlipToBackIcon sx={{ fontSize: 20 }} />
        </ListItemIcon>
        <ListItemText>
          {t('design.contextMenu.sendToBack', 'Send to Back')}
        </ListItemText>
      </MenuItem>

      <Divider />

      <MenuItem onClick={handleDelete}>
        <ListItemIcon>
          <DeleteOutlineIcon
            sx={{ fontSize: 20, color: 'error.main' }}
          />
        </ListItemIcon>
        <ListItemText
          sx={{ '& .MuiTypography-root': { color: 'error.main' } }}
        >
          {t('design.contextMenu.delete', 'Delete')}
        </ListItemText>
      </MenuItem>
    </Menu>
  );
};

export default ArtboardContextMenu;
