import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../../store';
import type { NicheStatus, PotentialRating } from '../types';
import type { DrawerMode } from '../hooks/useNicheDrawer';
import { useNicheDetailDrawer } from '../hooks/useNicheDetailDrawer';

interface NicheDetailDrawerProps {
  open: boolean;
  mode: DrawerMode;
  selectedId: string | null;
  onClose: () => void;
}

const DRAWER_WIDTH = 480;

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
}));

const DrawerBody = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const DrawerFooter = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
  gap: theme.spacing(1),
}));

const NICHE_STATUSES: NicheStatus[] = [
  'data_entry', 'deep_research', 'niche_with_potential',
  'to_designer', 'upload', 'start_ads',
  'pending', 'winner', 'loser',
];

const POTENTIAL_RATINGS: (PotentialRating | '')[] = ['', 'good', 'very_good', 'rejected'];

export const NicheDetailDrawer = ({
  open,
  mode,
  selectedId,
  onClose,
}: NicheDetailDrawerProps) => {
  const { t } = useTranslation();

  const activeWorkspaceId = useSelector((s: RootState) => s.workspace.activeWorkspaceId);
  const workspaces = useSelector((s: RootState) => s.workspace.workspaces);
  const members = workspaces.find((w) => w.id === activeWorkspaceId)?.members ?? [];

  const {
    niche,
    isFetching,
    createForm,
    editForm,
    handleCreate,
    handleUpdate,
    creating,
    updating,
    deleting,
    serverError,
    archiveDialogOpen,
    setArchiveDialogOpen,
    unsavedDialogOpen,
    setUnsavedDialogOpen,
    handleArchiveConfirm,
    requestClose,
    discardAndClose,
  } = useNicheDetailDrawer({ mode, selectedId, onClose });

  const isCreate = mode === 'create';
  const isBusy = creating || updating || deleting || isFetching;

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={requestClose}
        PaperProps={{ sx: { width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column' } }}
      >
        <DrawerHeader>
          <Typography variant="h6" fontWeight={600}>
            {isCreate ? t('niches.drawer.createTitle') : (niche?.name ?? t('niches.drawer.editTitle'))}
          </Typography>
          <IconButton size="small" onClick={requestClose} aria-label={t('niches.drawer.cancel')} sx={{ borderRadius: '8px' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DrawerHeader>

        <DrawerBody>
          {serverError && (
            <Alert severity="error" sx={{ mb: 0 }}>
              {serverError}
            </Alert>
          )}

          {isCreate ? (
            <Stack component="form" id="niche-create-form" onSubmit={createForm.handleSubmit(handleCreate)} gap={2.5}>
              <Controller
                name="name"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label={t('niches.drawer.name')}
                    placeholder={t('niches.drawer.namePlaceholder')}
                    error={!!fieldState.error}
                    helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                    required
                    fullWidth
                    size="small"
                    autoFocus
                  />
                )}
              />
              <Controller
                name="notes"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label={t('niches.drawer.notes')}
                    placeholder={t('niches.drawer.notesPlaceholder')}
                    error={!!fieldState.error}
                    helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                    multiline
                    rows={4}
                    fullWidth
                    size="small"
                  />
                )}
              />
            </Stack>
          ) : (
            <Stack component="form" id="niche-edit-form" onSubmit={editForm.handleSubmit(handleUpdate)} gap={2.5}>
              {isFetching && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={32} />
                </Box>
              )}
              {!isFetching && niche && (
                <>
                  <Controller
                    name="name"
                    control={editForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label={t('niches.drawer.name')}
                        error={!!fieldState.error}
                        helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                        required
                        fullWidth
                        size="small"
                      />
                    )}
                  />
                  <Controller
                    name="notes"
                    control={editForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label={t('niches.drawer.notes')}
                        error={!!fieldState.error}
                        helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                        multiline
                        rows={3}
                        fullWidth
                        size="small"
                      />
                    )}
                  />
                  <Controller
                    name="status"
                    control={editForm.control}
                    render={({ field }) => (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.75, color: 'text.secondary' }}>
                          {t('niches.drawer.status')}
                        </Typography>
                        <Select
                          {...field}
                          onChange={(e) => {
                            const newStatus = e.target.value as NicheStatus;
                            field.onChange(newStatus);
                            if (
                              newStatus === 'niche_with_potential' &&
                              editForm.getValues('potential_rating') !== 'good' &&
                              editForm.getValues('potential_rating') !== 'very_good'
                            ) {
                              editForm.setValue('potential_rating', 'good', { shouldDirty: true });
                            }
                          }}
                          fullWidth
                          size="small"
                          displayEmpty
                        >
                          {NICHE_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}>
                              {t(`niches.status.${s}`)}
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>
                    )}
                  />
                  <Controller
                    name="potential_rating"
                    control={editForm.control}
                    render={({ field }) => (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.75, color: 'text.secondary' }}>
                          {t('niches.drawer.potentialRating')}
                        </Typography>
                        <Select
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          fullWidth
                          size="small"
                          displayEmpty
                        >
                          {POTENTIAL_RATINGS.map((r) => (
                            <MenuItem key={r} value={r}>
                              {r ? t(`niches.potentialRating.${r}`) : t('niches.potentialRating.none')}
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>
                    )}
                  />
                  <Controller
                    name="assigned_to"
                    control={editForm.control}
                    render={({ field }) => {
                      const selectedMember = members.find((m) => m.id === field.value) ?? null;
                      return (
                        <Autocomplete
                          options={members}
                          getOptionLabel={(m) =>
                            m.first_name || m.last_name
                              ? `${m.first_name} ${m.last_name}`.trim()
                              : m.username
                          }
                          value={selectedMember}
                          onChange={(_, val) => field.onChange(val?.id ?? null)}
                          clearOnEscape
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={t('niches.drawer.assignee')}
                              size="small"
                            />
                          )}
                        />
                      );
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('niches.drawer.ideasBadge', {
                        total: niche.idea_count,
                        approved: niche.approved_idea_count,
                      })}
                    </Typography>
                  </Box>
                </>
              )}
            </Stack>
          )}
        </DrawerBody>

        <DrawerFooter>
          {isCreate ? (
            <>
              <Button variant="text" onClick={requestClose} disabled={isBusy}>
                {t('niches.drawer.cancel')}
              </Button>
              <Button
                type="submit"
                form="niche-create-form"
                variant="contained"
                color="primary"
                disabled={isBusy}
              >
                {creating ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {t('niches.drawer.create')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setArchiveDialogOpen(true)}
                disabled={isBusy}
                sx={{ borderColor: alpha(COLORS.errorDk, 0.30), '&:hover': { backgroundColor: alpha(COLORS.errorDk, 0.08) } }}
              >
                {t('niches.drawer.archive')}
              </Button>
              <Button
                type="submit"
                form="niche-edit-form"
                variant="contained"
                color="primary"
                disabled={isBusy}
              >
                {updating ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {t('niches.drawer.save')}
              </Button>
            </>
          )}
        </DrawerFooter>
      </Drawer>

      {/* Archive confirmation */}
      <Dialog open={archiveDialogOpen} onClose={() => setArchiveDialogOpen(false)} aria-labelledby="archive-drawer-dialog-title">
        <DialogTitle id="archive-drawer-dialog-title">
          {t('niches.drawer.archiveConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('niches.drawer.archiveConfirmBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setArchiveDialogOpen(false)} disabled={deleting}>
            {t('niches.drawer.archiveCancel')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleArchiveConfirm}
            disabled={deleting}
          >
            {t('niches.drawer.archiveConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unsaved changes confirmation */}
      <Dialog open={unsavedDialogOpen} onClose={() => setUnsavedDialogOpen(false)} aria-labelledby="unsaved-dialog-title">
        <DialogTitle id="unsaved-dialog-title">
          {t('niches.drawer.unsavedChangesTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('niches.drawer.unsavedChangesBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setUnsavedDialogOpen(false)}>
            {t('niches.drawer.keepEditing')}
          </Button>
          <Button variant="outlined" color="error" onClick={discardAndClose}>
            {t('niches.drawer.discardChanges')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
