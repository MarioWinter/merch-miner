import { useCallback } from 'react';
import {
  Box,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import HardDriveIcon from '@mui/icons-material/SaveAlt';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { useTranslation } from 'react-i18next';
import { useGoogleDrive, useOneDrive } from '@/components/CloudStorage';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setDestination as setDestinationAction,
  setCloudTarget as setCloudTargetAction,
} from '@/store/upscaleSlice';
import type { UpscaleCloudTarget, UpscaleDestination } from '@/store/upscaleApi';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ToggleRow = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    flex: 1,
    height: 32,
    color: theme.vars.palette.text.secondary,
    border: `1px solid ${theme.vars.palette.divider}`,
    '&.Mui-selected': {
      backgroundColor: theme.vars.palette.primary.main,
      color: theme.vars.palette.common.white,
      '&:hover': {
        backgroundColor: theme.vars.palette.primary.dark,
      },
    },
  },
}));

const TargetChip = styled(Chip)(({ theme }) => ({
  height: 24,
  maxWidth: '100%',
  borderRadius: 6,
  backgroundColor: theme.vars.palette.action.hover,
  '& .MuiChip-label': {
    fontSize: 11,
    color: theme.vars.palette.text.secondary,
  },
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface UpscaleDestinationToggleProps {
  /**
   * Workspace id used to scope the last-used destination preference.
   * If null/undefined the toggle still works but won't persist.
   */
  workspaceId: string | null;
  /** Open the existing PROJ-11 SendToCloudDialog in pick-only mode. */
  onPickCloudTarget: () => void;
  /** Disable interactions while a job is in flight. */
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const UpscaleDestinationToggle = ({
  workspaceId,
  onPickCloudTarget,
  disabled,
}: UpscaleDestinationToggleProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const gdrive = useGoogleDrive();
  const onedrive = useOneDrive();
  const cloudConnected = gdrive.isConnected || onedrive.isConnected;

  const destination = useAppSelector((state) =>
    workspaceId ? state.upscale.destinationByWorkspace[workspaceId] : undefined,
  ) ?? 'local';

  const cloudTarget = useAppSelector((state) =>
    workspaceId ? state.upscale.cloudTargetByWorkspace[workspaceId] : null,
  ) as UpscaleCloudTarget | null;

  const handleChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, value: UpscaleDestination | null) => {
      if (!value || !workspaceId) return;
      dispatch(setDestinationAction({ workspaceId, destination: value }));
      // Picking Cloud without a target yet → open the picker
      if (value === 'cloud' && !cloudTarget) {
        onPickCloudTarget();
      }
    },
    [cloudTarget, dispatch, onPickCloudTarget, workspaceId],
  );

  const handleClearTarget = useCallback(() => {
    if (!workspaceId) return;
    dispatch(setCloudTargetAction({ workspaceId, target: null }));
  }, [dispatch, workspaceId]);

  return (
    <Stack spacing={1}>
      <ToggleRow
        value={destination}
        exclusive
        size="small"
        onChange={handleChange}
        disabled={disabled}
        aria-label={t('upscale.destination.label', 'Upscale destination')}
        fullWidth
      >
        <ToggleButton
          value="local"
          aria-label={t('upscale.destination.local', 'Local only')}
        >
          <Tooltip title={t('upscale.destination.localTooltip', 'Local only (Django)')}>
            <HardDriveIcon sx={{ fontSize: 18 }} />
          </Tooltip>
        </ToggleButton>
        <ToggleButton
          value="cloud"
          aria-label={t('upscale.destination.cloud', 'Local + Cloud')}
          disabled={!cloudConnected || disabled}
        >
          <Tooltip
            title={
              cloudConnected
                ? t('upscale.destination.cloudTooltip', 'Local + Cloud')
                : t(
                    'upscale.destination.cloudDisabledTooltip',
                    'Connect Google Drive or OneDrive in Settings',
                  )
            }
          >
            <span>
              <CloudUploadIcon sx={{ fontSize: 18 }} />
            </span>
          </Tooltip>
        </ToggleButton>
      </ToggleRow>

      {destination === 'cloud' && cloudTarget && (
        <Box>
          <TargetChip
            icon={<FolderOutlinedIcon sx={{ fontSize: 14 }} />}
            label={`${cloudTarget.provider === 'google_drive' ? 'Drive' : 'OneDrive'} · ${cloudTarget.folder_name}`}
            onClick={onPickCloudTarget}
            onDelete={handleClearTarget}
            size="small"
          />
        </Box>
      )}
    </Stack>
  );
};

export default UpscaleDestinationToggle;
