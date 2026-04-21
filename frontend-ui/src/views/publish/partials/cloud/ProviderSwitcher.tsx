import { useState, useCallback } from 'react';
import {
  Box,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CloudProvider = 'google_drive' | 'onedrive';

interface ProviderInfo {
  id: CloudProvider;
  label: string;
  icon: string;
  color: string;
  isConnected: boolean;
}

interface ProviderSwitcherProps {
  activeProvider: CloudProvider;
  onProviderChange: (provider: CloudProvider) => void;
  googleConnected: boolean;
  onedriveConnected: boolean;
  onManageConnections: () => void;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ConnectionDot = styled(Box, {
  shouldForwardProp: (p) => p !== 'connected',
})<{ connected: boolean }>(({ connected }) => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  backgroundColor: connected ? COLORS.successDk : COLORS.warningDk,
  flexShrink: 0,
  ...(connected
    ? {}
    : {
        animation: `pulse-dot 2s ease-in-out infinite`,
        '@keyframes pulse-dot': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
      }),
}));

const ProviderChip = styled(Chip)(({ theme }) => ({
  height: theme.spacing(3.5),
  backgroundColor: alpha(COLORS.inkElevated, 0.8),
  borderRadius: Number(theme.shape.borderRadius),
  cursor: 'pointer',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '& .MuiChip-label': {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 600,
    paddingRight: theme.spacing(0.5),
  },
  '& .MuiChip-deleteIcon': {
    fontSize: 14,
    color: theme.vars.palette.text.secondary,
  },
  '&:hover': {
    backgroundColor: alpha(COLORS.inkElevated, 1),
  },
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ProviderSwitcher = ({
  activeProvider,
  onProviderChange,
  googleConnected,
  onedriveConnected,
  onManageConnections,
}: ProviderSwitcherProps) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const providers: ProviderInfo[] = [
    {
      id: 'google_drive',
      label: 'Google Drive',
      icon: 'G',
      color: COLORS.brandGoogleDrive,
      isConnected: googleConnected,
    },
    {
      id: 'onedrive',
      label: 'OneDrive',
      icon: 'O',
      color: COLORS.brandOneDrive,
      isConnected: onedriveConnected,
    },
  ];

  const active = providers.find((p) => p.id === activeProvider) ?? providers[0];

  const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleSelect = useCallback(
    (id: CloudProvider) => {
      onProviderChange(id);
      handleClose();
    },
    [onProviderChange, handleClose],
  );

  return (
    <>
      <ProviderChip
        avatar={
          <Avatar
            sx={{
              width: 16,
              height: 16,
              fontSize: 10,
              fontWeight: 700,
              backgroundColor: active.color,
            }}
          >
            {active.icon}
          </Avatar>
        }
        label={active.label}
        deleteIcon={<ExpandMoreIcon />}
        onDelete={handleOpen}
        onClick={handleOpen}
      />

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {providers.map((provider) => (
          <MenuItem
            key={provider.id}
            selected={provider.id === activeProvider}
            onClick={() => handleSelect(provider.id)}
          >
            <ListItemIcon>
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: provider.color,
                }}
              >
                {provider.icon}
              </Avatar>
            </ListItemIcon>
            <ListItemText>
              <Typography variant="body2">{provider.label}</Typography>
            </ListItemText>
            <Box sx={{ ml: 1.5 }}>
              <ConnectionDot connected={provider.isConnected} />
            </Box>
          </MenuItem>
        ))}
        <MenuItem onClick={() => { onManageConnections(); handleClose(); }}>
          <ListItemIcon>
            <SettingsOutlinedIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText>
            <Typography variant="body2" color="text.secondary">
              {t('publish.cloud.manageConnections', { defaultValue: 'Manage Connections' })}
            </Typography>
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ProviderSwitcher;
