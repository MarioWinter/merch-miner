import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PaletteIcon from '@mui/icons-material/Palette';
import StraightenIcon from '@mui/icons-material/Straighten';
import SettingsIcon from '@mui/icons-material/Settings';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useTranslation } from 'react-i18next';
import type { CommandAction } from '../types';

const ICON_MAP: Record<string, React.ReactNode> = {
  ContentCopy: <ContentCopyIcon sx={{ fontSize: 20 }} />,
  Assignment: <AssignmentIcon sx={{ fontSize: 20 }} />,
  Palette: <PaletteIcon sx={{ fontSize: 20 }} />,
  Straighten: <StraightenIcon sx={{ fontSize: 20 }} />,
  Settings: <SettingsIcon sx={{ fontSize: 20 }} />,
  CloudUpload: <CloudUploadIcon sx={{ fontSize: 20 }} />,
};

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  actions: CommandAction[];
}

const CommandPalette = ({
  open,
  onClose,
  query,
  onQueryChange,
  actions,
}: CommandPaletteProps) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: '16px',
            mt: '15vh',
            position: 'fixed',
            top: 0,
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <TextField
          autoFocus
          fullWidth
          placeholder={t('publish.command.searchPlaceholder')}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          variant="outlined"
          slotProps={{
            input: {
              sx: {
                borderRadius: 0,
                borderBottom: '1px solid',
                borderColor: 'divider',
              },
            },
          }}
          sx={{ '& fieldset': { border: 'none' } }}
        />

        <Box sx={{ px: 1, py: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1.5 }}>
            {t('publish.command.title')}
          </Typography>
        </Box>

        <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
          {actions.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('publish.command.noResults')}
              </Typography>
            </Box>
          ) : (
            actions.map((action) => (
              <ListItemButton
                key={action.id}
                onClick={action.action}
                sx={{ borderRadius: '8px', mx: 0.5 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {ICON_MAP[action.icon] ?? null}
                </ListItemIcon>
                <ListItemText
                  primary={action.label}
                  secondary={action.description}
                  slotProps={{
                    primary: { variant: 'body2' },
                    secondary: { variant: 'caption' },
                  }}
                />
              </ListItemButton>
            ))
          )}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
