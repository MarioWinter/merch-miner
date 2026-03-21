import {
  Alert,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { COLORS } from '@/style/constants';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import type { DrawerMode } from '../hooks/useNicheDrawer';
import { useNicheDetailDrawer } from '../hooks/useNicheDetailDrawer';
import { DrawerCreateForm } from './DrawerCreateForm';
import { DrawerEditForm } from './DrawerEditForm';
import { DrawerResearchSection } from './DrawerResearchSection';
import { DrawerConfirmDialogs } from './DrawerConfirmDialogs';

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

export const NicheDetailDrawer = ({
  open,
  mode,
  selectedId,
  onClose,
}: NicheDetailDrawerProps) => {
  const { t } = useTranslation();

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
        slotProps={{ paper: { sx: { width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column' } } }}
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
            <DrawerCreateForm form={createForm} onSubmit={handleCreate} />
          ) : (
            <>
              <DrawerEditForm
                form={editForm}
                onSubmit={handleUpdate}
                niche={niche}
                isFetching={isFetching}
              />
              {niche && <DrawerResearchSection niche={niche} isBusy={isBusy} />}
            </>
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

      <DrawerConfirmDialogs
        archiveDialogOpen={archiveDialogOpen}
        setArchiveDialogOpen={setArchiveDialogOpen}
        handleArchiveConfirm={handleArchiveConfirm}
        deleting={deleting}
        unsavedDialogOpen={unsavedDialogOpen}
        setUnsavedDialogOpen={setUnsavedDialogOpen}
        discardAndClose={discardAndClose}
      />
    </>
  );
};
