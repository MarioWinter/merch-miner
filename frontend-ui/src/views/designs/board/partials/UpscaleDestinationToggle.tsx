import { useCallback } from 'react';
import {
  Box,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { useTranslation } from 'react-i18next';
import { useGoogleDrive, useOneDrive } from '@/components/CloudStorage';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setDestination as setDestinationAction,
  setCloudTarget as setCloudTargetAction,
} from '@/store/upscaleSlice';
import type { UpscaleCloudTarget } from '@/store/upscaleApi';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const Row = styled(FormControlLabel)({
  margin: 0,
  alignItems: 'center',
  gap: 8,
  '& .MuiFormControlLabel-label': {
    fontSize: 12,
    flex: 1,
  },
});

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

const HelperText = styled(Typography)(({ theme }) => ({
  fontSize: 11,
  color: theme.vars.palette.text.disabled,
  paddingLeft: 0,
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

  const isCloudOn = destination === 'cloud';

  const handleSwitchChange = useCallback(
    (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      if (!workspaceId) return;
      dispatch(
        setDestinationAction({
          workspaceId,
          destination: checked ? 'cloud' : 'local',
        }),
      );
      // Turning Cloud on without a target → auto-open the picker.
      if (checked && !cloudTarget) {
        onPickCloudTarget();
      }
    },
    [cloudTarget, dispatch, onPickCloudTarget, workspaceId],
  );

  const handleClearTarget = useCallback(() => {
    if (!workspaceId) return;
    dispatch(setCloudTargetAction({ workspaceId, target: null }));
  }, [dispatch, workspaceId]);

  const switchDisabled = disabled || !cloudConnected;

  return (
    <Stack spacing={0.5}>
      <Tooltip
        title={
          cloudConnected
            ? ''
            : t(
                'upscale.destination.cloudDisabledTooltip',
                'Connect Google Drive or OneDrive in Settings',
              )
        }
        placement="left"
      >
        <span>
          <Row
            control={
              <Switch
                size="small"
                checked={isCloudOn}
                onChange={handleSwitchChange}
                disabled={switchDisabled}
                inputProps={{
                  'aria-label': t(
                    'upscale.destination.switchAria',
                    'Also save to Cloud',
                  ),
                }}
              />
            }
            label={t('upscale.destination.switchLabel', 'Also save to Cloud')}
            labelPlacement="start"
          />
        </span>
      </Tooltip>

      {!cloudConnected && (
        <HelperText>
          {t(
            'upscale.destination.connectHint',
            'Connect Drive or OneDrive in Settings to enable cloud upload',
          )}
        </HelperText>
      )}

      {isCloudOn && cloudTarget && (
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

      {isCloudOn && !cloudTarget && cloudConnected && (
        <HelperText
          onClick={onPickCloudTarget}
          sx={{ cursor: 'pointer', textDecoration: 'underline' }}
        >
          {t('upscale.destination.pickFolder', 'Pick a folder…')}
        </HelperText>
      )}
    </Stack>
  );
};

export default UpscaleDestinationToggle;
