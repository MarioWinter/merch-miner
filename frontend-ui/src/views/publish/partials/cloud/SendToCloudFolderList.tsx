import { Box, Typography, Skeleton, Alert } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { CloudFolder } from '@/components/CloudStorage';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const FolderList = styled(Box)(({ theme }) => ({
  minHeight: 320,
  maxHeight: 420,
  overflowY: 'auto',
  padding: theme.spacing(1, 0),
}));

const FolderRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 3),
  cursor: 'pointer',
  position: 'relative',
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
  ...(isSelected && {
    backgroundColor: alpha(COLORS.cyan, 0.06),
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: COLORS.cyan,
    },
  }),
  '&:hover': {
    backgroundColor: isSelected
      ? alpha(COLORS.cyan, 0.08)
      : alpha('#fff', 0.04),
  },
}));

const EmptyBlock = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 320,
  color: theme.vars.palette.text.disabled,
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SendToCloudFolderListProps {
  folders: CloudFolder[];
  selectedFolderId: string | null | undefined;
  isLoading: boolean;
  loadError: string | null;
  isConnected: boolean;
  providerName: string;
  onFolderClick: (folder: CloudFolder) => void;
  onFolderDoubleClick: (folder: CloudFolder) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SendToCloudFolderList = ({
  folders,
  selectedFolderId,
  isLoading,
  loadError,
  isConnected,
  providerName,
  onFolderClick,
  onFolderDoubleClick,
}: SendToCloudFolderListProps) => {
  const { t } = useTranslation();

  if (!isConnected) {
    return (
      <EmptyBlock>
        <Typography variant="body2">
          {t('publish.cloud.notConnected', {
            defaultValue: 'Not connected to {{provider}}',
            provider: providerName,
          })}
        </Typography>
      </EmptyBlock>
    );
  }

  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{loadError}</Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <FolderList>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              px: 3,
              py: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Skeleton variant="circular" width={18} height={18} />
            <Skeleton variant="text" width={`${40 + (i % 3) * 15}%`} />
          </Box>
        ))}
      </FolderList>
    );
  }

  if (folders.length === 0) {
    return (
      <EmptyBlock>
        <Typography variant="body2">
          {t('publish.cloud.noSubfolders', {
            defaultValue: 'No subfolders in this folder',
          })}
        </Typography>
      </EmptyBlock>
    );
  }

  return (
    <FolderList>
      {folders.map((folder) => {
        const isSelected = selectedFolderId === folder.id;
        return (
          <FolderRow
            key={folder.id}
            isSelected={isSelected}
            onClick={() => onFolderClick(folder)}
            onDoubleClick={() => onFolderDoubleClick(folder)}
            role="option"
            aria-selected={isSelected}
          >
            <FolderOutlinedIcon
              sx={{
                fontSize: 18,
                color: isSelected ? 'secondary.main' : 'text.secondary',
              }}
            />
            <Typography
              variant="body2"
              noWrap
              sx={{
                flex: 1,
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? 'secondary.main' : 'text.primary',
              }}
            >
              {folder.name}
            </Typography>
          </FolderRow>
        );
      })}
    </FolderList>
  );
};

export default SendToCloudFolderList;
