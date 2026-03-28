import { useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListTemplatesQuery,
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
} from '@/store/publishSlice';
import type { UploadTemplate, UploadTemplateCreateBody } from '../types';

interface UploadTemplateDropdownProps {
  currentConfig: Omit<UploadTemplateCreateBody, 'name'>;
  onApplyTemplate: (template: UploadTemplate) => void;
}

const UploadTemplateDropdown = ({
  currentConfig,
  onApplyTemplate,
}: UploadTemplateDropdownProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const { data: templates = [], isLoading } = useListTemplatesQuery();
  const [createTemplate, { isLoading: isCreating }] = useCreateTemplateMutation();
  const [deleteTemplate] = useDeleteTemplateMutation();

  const handleSave = async () => {
    if (!templateName.trim()) return;
    try {
      await createTemplate({ ...currentConfig, name: templateName.trim() }).unwrap();
      enqueueSnackbar(t('publish.template.saveSuccess'), { variant: 'success' });
      setSaveDialogOpen(false);
      setTemplateName('');
    } catch {
      enqueueSnackbar(t('publish.template.saveError'), { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate(id).unwrap();
      enqueueSnackbar(t('publish.template.deleteSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('publish.template.deleteError'), { variant: 'error' });
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<BookmarkBorderIcon />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        {t('publish.template.button')}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setSaveDialogOpen(true);
          }}
        >
          <ListItemIcon>
            <AddIcon />
          </ListItemIcon>
          <ListItemText>{t('publish.template.saveNew')}</ListItemText>
        </MenuItem>

        <Divider />

        {isLoading && (
          <MenuItem disabled>
            <CircularProgress size={16} />
          </MenuItem>
        )}

        {!isLoading && templates.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {t('publish.template.empty')}
            </Typography>
          </MenuItem>
        )}

        {templates.map((tpl) => (
          <MenuItem
            key={tpl.id}
            onClick={() => {
              onApplyTemplate(tpl);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>
              <BookmarkIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText>{tpl.name}</ListItemText>
            <DeleteOutlineIcon
              sx={{ fontSize: 18, color: 'text.secondary', ml: 1 }}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(tpl.id);
              }}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Save Template Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('publish.template.saveTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label={t('publish.template.nameLabel')}
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            size="small"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>
            {t('publish.template.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isCreating || !templateName.trim()}
          >
            {t('publish.template.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default UploadTemplateDropdown;
