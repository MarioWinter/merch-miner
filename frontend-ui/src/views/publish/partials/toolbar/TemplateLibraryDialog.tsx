import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListTemplatesQuery,
  useDeleteTemplateMutation,
} from '@/store/publishSlice';

interface TemplateLibraryDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Lightweight workspace UploadTemplate browser. Read-only list + single
 * delete action for MVP. Creation happens from the Edit page (via Save
 * Template CTAs); this dialog is the inventory + pruning surface.
 */
const TemplateLibraryDialog = ({ open, onClose }: TemplateLibraryDialogProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data: templates = [], isLoading } = useListTemplatesQuery(undefined, {
    skip: !open,
  });
  const [deleteTemplate, { isLoading: isDeleting }] =
    useDeleteTemplateMutation();

  const handleDelete = async (id: string, name: string) => {
    const ok = window.confirm(
      t('publish.toolbar.templateDeleteConfirm', {
        defaultValue: 'Delete template "{{name}}"? This cannot be undone.',
        name,
      }),
    );
    if (!ok) return;
    try {
      await deleteTemplate(id).unwrap();
      enqueueSnackbar(
        t('publish.toolbar.templateDeleteSuccess', {
          defaultValue: 'Template deleted',
        }),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar(
        t('publish.toolbar.templateDeleteError', {
          defaultValue: 'Failed to delete template',
        }),
        { variant: 'error' },
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        {/* `component="span"` — DialogTitle already renders as <h2>; a nested
            <h6> (Typography default for variant=h6) is invalid HTML. */}
        <Typography variant="h6" component="span">
          {t('publish.toolbar.templateLibraryTitle', {
            defaultValue: 'Upload Templates',
          })}
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t('common.close', { defaultValue: 'Close' })}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading && (
          <Typography variant="body2" color="text.secondary">
            {t('publish.toolbar.templateLoading', { defaultValue: 'Loading…' })}
          </Typography>
        )}
        {!isLoading && templates.length === 0 && (
          <Stack gap={1} alignItems="center" py={4}>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {t('publish.toolbar.templateEmpty', {
                defaultValue:
                  'No upload templates yet. Save one from the Edit page to reuse product + pricing config across designs.',
              })}
            </Typography>
          </Stack>
        )}
        {!isLoading && templates.length > 0 && (
          <List dense>
            {templates.map((tpl) => (
              <ListItem
                key={tpl.id}
                secondaryAction={
                  <Tooltip
                    title={t('publish.toolbar.templateDelete', {
                      defaultValue: 'Delete template',
                    })}
                  >
                    <span>
                      <IconButton
                        edge="end"
                        size="small"
                        disabled={isDeleting}
                        onClick={() => void handleDelete(tpl.id, tpl.name)}
                        aria-label={t('publish.toolbar.templateDelete', {
                          defaultValue: 'Delete template',
                        })}
                        color="error"
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="subtitle2">{tpl.name}</Typography>
                      {(tpl as { is_default?: boolean }).is_default && (
                        <Chip
                          label={t('publish.toolbar.templateDefaultChip', {
                            defaultValue: 'Default',
                          })}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {(tpl as { marketplace_type?: string }).marketplace_type && (
                        <Chip
                          label={(
                            (tpl as { marketplace_type?: string }).marketplace_type ?? ''
                          ).toUpperCase()}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    tpl.brand_name
                      ? t('publish.toolbar.templateBrand', {
                          defaultValue: 'Brand: {{brand}}',
                          brand: tpl.brand_name,
                        })
                      : undefined
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TemplateLibraryDialog;
