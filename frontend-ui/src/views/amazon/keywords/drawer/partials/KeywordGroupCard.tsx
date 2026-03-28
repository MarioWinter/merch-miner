import { useState } from 'react';
import {
  Box,
  Collapse,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { KeywordChipRow } from './KeywordChipRow';
import type { NicheKeyword, NicheKeywordGroup } from '../types';

const GroupContainer = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 8,
  overflow: 'hidden',
}));

const GroupHeader = styled(Stack)(({ theme }) => ({
  padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
  backgroundColor: theme.vars.palette.background.default,
  cursor: 'pointer',
}));

interface KeywordGroupCardProps {
  group: NicheKeywordGroup;
  keywords: NicheKeyword[];
  onDeleteKeyword: (id: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

export const KeywordGroupCard = ({
  group,
  keywords,
  onDeleteKeyword,
  onRenameGroup,
  onDeleteGroup,
}: KeywordGroupCardProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const handleSaveRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== group.name) {
      onRenameGroup(group.id, trimmed);
    }
    setIsEditing(false);
  };

  return (
    <GroupContainer>
      <GroupHeader
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={() => !isEditing && setExpanded((p) => !p)}
      >
        <IconButton size="small" sx={{ p: 0 }}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </IconButton>

        {isEditing ? (
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
            <TextField
              size="small"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
              autoFocus
              sx={{ flex: 1 }}
            />
            <IconButton size="small" onClick={handleSaveRename}>
              <CheckIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton size="small" onClick={() => setIsEditing(false)}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              {group.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {keywords.length}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditName(group.name); }}
              aria-label={t('keywords.drawer.editGroup')}
              sx={{ borderRadius: '6px' }}
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.id); }}
              aria-label={t('keywords.drawer.deleteGroup')}
              sx={{ borderRadius: '6px' }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </>
        )}
      </GroupHeader>

      <Collapse in={expanded}>
        <Box sx={{ px: 1, py: 0.5 }}>
          {keywords.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ px: 1, py: 1, display: 'block' }}>
              {t('keywords.drawer.emptyGroup')}
            </Typography>
          ) : (
            keywords.map((kw) => (
              <KeywordChipRow
                key={kw.id}
                keyword={kw}
                onDelete={onDeleteKeyword}
              />
            ))
          )}
        </Box>
      </Collapse>
    </GroupContainer>
  );
};
