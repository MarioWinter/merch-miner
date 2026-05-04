import { useCallback } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { FLOW_TARGETS } from '@/components/FlowButton';

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
  /** Phase H8: save artboard to listings */
  onSaveToListings?: (artboardId: string) => void;
  /** Phase N: add to editor batch without switching tab */
  onAddToEditor?: (artboardIds: string[]) => void;
  /** Phase N: add to editor batch and switch to editor tab */
  onOpenInEditor?: (artboardIds: string[]) => void;
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
  onSaveToListings,
  onAddToEditor,
  onOpenInEditor,
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

  const handleSaveToListings = useCallback(() => {
    if (artboardId && onSaveToListings) onSaveToListings(artboardId);
    onClose();
  }, [artboardId, onSaveToListings, onClose]);

  const handleAddToEditor = useCallback(() => {
    if (artboardId && onAddToEditor) onAddToEditor([artboardId]);
    onClose();
  }, [artboardId, onAddToEditor, onClose]);

  const handleOpenInEditor = useCallback(() => {
    if (artboardId && onOpenInEditor) onOpenInEditor([artboardId]);
    onClose();
  }, [artboardId, onOpenInEditor, onClose]);

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

      {hasImage && onSaveToListings && (
        <MenuItem onClick={handleSaveToListings}>
          <ListItemIcon>
            <FLOW_TARGETS.listings.icon
              sx={{ fontSize: 20, color: FLOW_TARGETS.listings.color }}
            />
          </ListItemIcon>
          <ListItemText>
            {t('design.contextMenu.saveToListings', 'Save to Listings')}
          </ListItemText>
        </MenuItem>
      )}

      {hasImage && onAddToEditor && (
        <>
          <Divider />
          <MenuItem onClick={handleAddToEditor}>
            <ListItemIcon>
              <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText>
              {t('design.contextMenu.addToEditor', 'Add to Editor')}
            </ListItemText>
          </MenuItem>
        </>
      )}

      {hasImage && onOpenInEditor && (
        <MenuItem onClick={handleOpenInEditor}>
          <ListItemIcon>
            <OpenInNewOutlinedIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText>
            {t('design.contextMenu.openInEditor', 'Open in Editor')}
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
