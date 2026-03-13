import { useState, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import { useFilterTemplates } from '../hooks/useFilterTemplates';
import type { UseNicheFiltersReturn } from '../hooks/useNicheFilters';
import type { FilterTemplate } from '../types';

interface FilterTemplateDropdownProps {
  filterState: UseNicheFiltersReturn;
}

const TriggerButton = styled(Button)(({ theme }) => ({
  height: 36,
  fontSize: '0.8125rem',
  fontWeight: 500,
  borderColor: alpha(COLORS.ink, 0.18),
  color: theme.vars.palette.text.secondary,
  whiteSpace: 'nowrap',
  minWidth: 'auto',
  ...theme.applyStyles('dark', {
    borderColor: alpha(COLORS.white, 0.12),
    color: theme.vars.palette.text.secondary,
  }),
  '&:hover': {
    borderColor: alpha(COLORS.ink, 0.30),
    color: theme.vars.palette.text.primary,
    backgroundColor: alpha(COLORS.ink, 0.04),
    ...theme.applyStyles('dark', {
      borderColor: alpha(COLORS.white, 0.22),
      backgroundColor: alpha(COLORS.white, 0.04),
    }),
  },
}));

const TemplateMenuItem = styled(MenuItem)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  paddingRight: theme.spacing(0.5),
  minWidth: 200,
}));

const DeleteBtn = styled(IconButton)(({ theme }) => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  color: theme.vars.palette.text.secondary,
  flexShrink: 0,
  '&:hover': {
    color: theme.vars.palette.error.main,
    backgroundColor: alpha(COLORS.errorDk, 0.10),
  },
}));

const SaveRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
}));

export const FilterTemplateDropdown = ({ filterState }: FilterTemplateDropdownProps) => {
  const { t } = useTranslation();
  const {
    templates,
    isLoading,
    activeTemplateId,
    applyTemplate,
    saveCurrentFilters,
    updateTemplate,
    deleteTemplate,
  } = useFilterTemplates(filterState);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = Boolean(anchorEl);

  const activeTemplate = templates.find((t) => t.id === activeTemplateId) ?? null;

  const handleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setShowSaveInput(false);
    setSaveName('');
  };

  const handleApply = (template: FilterTemplate) => {
    applyTemplate(template);
    handleClose();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    await deleteTemplate(id);
    setDeletingId(null);
  };

  const handleSaveClick = () => {
    setShowSaveInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSaveConfirm = async () => {
    const name = saveName.trim();
    if (!name) return;
    setIsSaving(true);
    await saveCurrentFilters(name);
    setIsSaving(false);
    setSaveName('');
    setShowSaveInput(false);
  };

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSaveConfirm();
    if (e.key === 'Escape') {
      setShowSaveInput(false);
      setSaveName('');
    }
  };

  const handleUpdateCurrent = async () => {
    if (!activeTemplateId) return;
    await updateTemplate(activeTemplateId);
    handleClose();
  };

  const buttonLabel = activeTemplate
    ? activeTemplate.name
    : t('niches.filterTemplates.button');

  const ButtonIcon = activeTemplate ? BookmarkIcon : BookmarkBorderIcon;

  return (
    <>
      <TriggerButton
        variant="outlined"
        size="small"
        startIcon={<ButtonIcon sx={{ fontSize: 16 }} />}
        onClick={handleOpen}
        aria-label={t('niches.filterTemplates.button')}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {buttonLabel}
      </TriggerButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        {isLoading && (
          <MenuItem disabled>
            <CircularProgress size={14} sx={{ mr: 1 }} />
            <Typography variant="body2">{t('niches.filterTemplates.loading')}</Typography>
          </MenuItem>
        )}

        {!isLoading && templates.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {t('niches.filterTemplates.empty')}
            </Typography>
          </MenuItem>
        )}

        {!isLoading && templates.map((template) => (
          <TemplateMenuItem
            key={template.id}
            onClick={() => handleApply(template)}
            selected={template.id === activeTemplateId}
          >
            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
              {template.name}
            </Typography>
            <Tooltip title={t('niches.filterTemplates.delete')} placement="right">
              <span>
                <DeleteBtn
                  size="small"
                  aria-label={t('niches.filterTemplates.delete')}
                  onClick={(e) => void handleDelete(e, template.id)}
                  disabled={deletingId === template.id}
                >
                  {deletingId === template.id
                    ? <CircularProgress size={12} />
                    : <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  }
                </DeleteBtn>
              </span>
            </Tooltip>
          </TemplateMenuItem>
        ))}

        {templates.length > 0 && <Divider />}

        {activeTemplateId && (
          <MenuItem onClick={() => void handleUpdateCurrent()}>
            <SaveIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
            <Typography variant="body2">{t('niches.filterTemplates.updateCurrent')}</Typography>
          </MenuItem>
        )}

        {!showSaveInput && (
          <MenuItem onClick={handleSaveClick}>
            <BookmarkBorderIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
            <Typography variant="body2">{t('niches.filterTemplates.saveFilters')}</Typography>
          </MenuItem>
        )}

        {showSaveInput && (
          <SaveRow onClick={(e) => e.stopPropagation()}>
            <TextField
              inputRef={inputRef}
              size="small"
              placeholder={t('niches.filterTemplates.namePlaceholder')}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={handleSaveKeyDown}
              disabled={isSaving}
              sx={{ flex: 1, '& .MuiInputBase-root': { height: 32, fontSize: '0.8125rem' } }}
            />
            <Button
              size="small"
              variant="contained"
              onClick={() => void handleSaveConfirm()}
              disabled={isSaving || !saveName.trim()}
              sx={{ height: 32, minWidth: 'auto', px: 1.5 }}
            >
              {isSaving
                ? <CircularProgress size={14} color="inherit" />
                : t('niches.filterTemplates.save')
              }
            </Button>
          </SaveRow>
        )}
      </Menu>
    </>
  );
};
