import { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Typography, TextField } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

interface FolderCardProps {
  id: string;
  name: string;
  assetCount: number;
  childCount: number;
  isSelected: boolean;
  onClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
}

interface AddFolderCardProps {
  onAdd: (name: string) => void;
}

const CardRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${isSelected ? COLORS.cyan : theme.vars.palette.divider}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  cursor: 'pointer',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  aspectRatio: '1 / 1',
  minHeight: 120,
  ...(isSelected && {
    boxShadow: `0 0 8px ${alpha(COLORS.cyan, 0.2)}`,
  }),
  '&:hover': {
    borderColor: isSelected ? COLORS.cyan : alpha('#fff', 0.16),
    transform: 'translateY(-1px)',
  },
}));

const AddCardRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  border: `2px dashed ${alpha('#fff', 0.12)}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  cursor: 'pointer',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  aspectRatio: '1 / 1',
  minHeight: 120,
  '&:hover': {
    borderColor: alpha(COLORS.cyan, 0.3),
    '& .add-icon': { color: COLORS.cyan },
  },
}));

export const FolderCard = ({
  id,
  name,
  assetCount,
  childCount,
  isSelected,
  onClick,
  onDoubleClick,
}: FolderCardProps) => {
  const { t } = useTranslation();
  const totalItems = assetCount + childCount;

  return (
    <CardRoot
      isSelected={isSelected}
      onClick={() => onClick(id)}
      onDoubleClick={() => onDoubleClick(id)}
      role="button"
      aria-label={name}
    >
      <FolderOutlinedIcon sx={{ fontSize: 40, color: isSelected ? COLORS.cyan : 'text.secondary' }} />
      <Typography variant="subtitle2" noWrap sx={{ maxWidth: '100%', textAlign: 'center' }}>
        {name}
      </Typography>
      <Typography variant="caption" color="text.disabled">
        {t('publish.collections.itemCount', {
          defaultValue: '{{count}} items',
          count: totalItems,
        })}
      </Typography>
    </CardRoot>
  );
};

export const AddFolderCard = ({ onAdd }: AddFolderCardProps) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [folderName, setFolderName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(() => {
    const trimmed = folderName.trim();
    if (trimmed) {
      onAdd(trimmed);
    }
    setFolderName('');
    setIsEditing(false);
  }, [folderName, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
      if (e.key === 'Escape') {
        setFolderName('');
        setIsEditing(false);
      }
    },
    [handleSubmit],
  );

  if (isEditing) {
    return (
      <AddCardRoot>
        <FolderOutlinedIcon sx={{ fontSize: 32, color: COLORS.cyan }} />
        <TextField
          inputRef={inputRef}
          size="small"
          variant="outlined"
          placeholder={t('publish.collections.folderName', { defaultValue: 'Folder name' })}
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          sx={{ width: '90%' }}
          slotProps={{ input: { sx: { fontSize: '0.8125rem' } } }}
        />
      </AddCardRoot>
    );
  }

  return (
    <AddCardRoot onClick={() => setIsEditing(true)} role="button" aria-label="Add folder">
      <AddCircleOutlineIcon
        className="add-icon"
        sx={{
          fontSize: 40,
          color: 'text.disabled',
          transition: `color ${DURATION.fast}ms ${EASING.standard}`,
        }}
      />
      <Typography variant="body2" color="text.disabled">
        {t('publish.collections.addFolder', { defaultValue: 'Add Folder' })}
      </Typography>
    </AddCardRoot>
  );
};

export default FolderCard;
