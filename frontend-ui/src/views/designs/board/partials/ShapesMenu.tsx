import { useCallback, useState } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import GestureIcon from '@mui/icons-material/Gesture';
import { useTranslation } from 'react-i18next';
import type { CanvasTool } from './BottomToolbar';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

type ShapeTool = Extract<CanvasTool, 'rectangle' | 'ellipse' | 'triangle' | 'line' | 'pen'>;

const SHAPE_TOOLS: { tool: ShapeTool; icon: React.ReactNode; labelKey: string; fallback: string }[] = [
  { tool: 'rectangle', icon: <RectangleOutlinedIcon sx={{ fontSize: 18 }} />, labelKey: 'design.canvas.shapes.rectangle', fallback: 'Rectangle' },
  { tool: 'ellipse', icon: <CircleOutlinedIcon sx={{ fontSize: 18 }} />, labelKey: 'design.canvas.shapes.ellipse', fallback: 'Ellipse' },
  { tool: 'triangle', icon: <ChangeHistoryIcon sx={{ fontSize: 18 }} />, labelKey: 'design.canvas.shapes.triangle', fallback: 'Triangle' },
  { tool: 'line', icon: <HorizontalRuleIcon sx={{ fontSize: 18 }} />, labelKey: 'design.canvas.shapes.line', fallback: 'Line' },
  { tool: 'pen', icon: <GestureIcon sx={{ fontSize: 18 }} />, labelKey: 'design.canvas.shapes.pen', fallback: 'Pen' },
];

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ShapesMenuProps {
  activeTool: CanvasTool;
  onSelect: (tool: CanvasTool) => void;
  children: (props: {
    onClick: (e: React.MouseEvent<HTMLElement>) => void;
    open: boolean;
  }) => React.ReactNode;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ShapesMenu = ({ activeTool, onSelect, children }: ShapesMenuProps) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleSelect = useCallback(
    (tool: CanvasTool) => {
      onSelect(tool);
      setAnchorEl(null);
    },
    [onSelect],
  );

  return (
    <>
      {children({ onClick: handleOpen, open })}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { mt: -1 } } }}
      >
        {SHAPE_TOOLS.map(({ tool, icon, labelKey, fallback }) => (
          <MenuItem
            key={tool}
            selected={activeTool === tool}
            onClick={() => handleSelect(tool)}
          >
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText>{t(labelKey, fallback)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default ShapesMenu;
