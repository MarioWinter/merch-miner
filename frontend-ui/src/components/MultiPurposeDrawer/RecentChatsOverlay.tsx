import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setActiveSession,
  setRecentChatsOverlayOpen,
} from '@/store/chatBarSlice';
import { usePurgeAllSessionsMutation } from '@/store/searchSlice';
import type { ChatSession } from '@/types/search';
import RecentChats from './panels/RecentChats';

const OverlayRoot = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: theme.vars.palette.background.paper,
  zIndex: theme.zIndex.drawer + 1,
  display: 'flex',
  flexDirection: 'column',
}));

const OverlayHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(1.25)} ${theme.spacing(2)}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
}));

const OverlayBody = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  padding: '8px 12px',
});

const RecentChatsOverlay = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.chatBar.recentChatsOverlayOpen);
  const activeSessionId = useAppSelector((s) => s.chatBar.activeSessionId);
  const activeWorkspaceId = useAppSelector(
    (s) => s.workspace.activeWorkspaceId,
  );
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [purgeAll, { isLoading: isPurging }] = usePurgeAllSessionsMutation();

  const requiredWord = t('chatNicheRag.history.clearAllConfirm.typeWord');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(setRecentChatsOverlayOpen(false));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dispatch]);

  if (!open) return null;

  const handleSelect = (session: ChatSession) => {
    dispatch(setActiveSession(session.id));
    dispatch(setRecentChatsOverlayOpen(false));
  };

  const handleConfirmPurge = async () => {
    try {
      const res = await purgeAll().unwrap();
      // Clear the active session + the workspace-scoped pointer so the
      // user doesn't get stranded on a freshly deleted session id.
      dispatch(setActiveSession(null));
      if (activeWorkspaceId && typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(
            `mm-active-chat-session-${activeWorkspaceId}`,
          );
        } catch {
          /* quota / privacy — ignore */
        }
      }
      enqueueSnackbar(
        t('chatNicheRag.history.cleared', { count: res.deleted_count }),
        { variant: 'success' },
      );
      setPurgeOpen(false);
      setTyped('');
    } catch {
      enqueueSnackbar(t('chatNicheRag.history.clearFailed'), {
        variant: 'error',
      });
    }
  };

  const handleClosePurge = () => {
    if (isPurging) return;
    setPurgeOpen(false);
    setTyped('');
  };

  return (
    <OverlayRoot role="dialog" aria-label={t('search.sessions.recentChats')}>
      <OverlayHeader>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="subtitle2">
            {t('search.sessions.recentChats')}
          </Typography>
        </Stack>
        <IconButton
          size="small"
          aria-label={t('search.drawer.close')}
          onClick={() => dispatch(setRecentChatsOverlayOpen(false))}
          sx={{ borderRadius: 1.5 }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </OverlayHeader>
      <OverlayBody>
        <RecentChats
          onSelect={handleSelect}
          activeSessionId={activeSessionId}
          headerLeftAction={
            <Button
              variant="text"
              color="error"
              size="small"
              startIcon={<DeleteSweepOutlinedIcon sx={{ fontSize: 18 }} />}
              onClick={() => setPurgeOpen(true)}
              aria-label={t('chatNicheRag.history.clearAll')}
              sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}
            >
              {t('chatNicheRag.history.clearAll')}
            </Button>
          }
        />
      </OverlayBody>

      <Dialog
        open={purgeOpen}
        onClose={handleClosePurge}
        aria-labelledby="purge-dialog-title"
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle id="purge-dialog-title">
          {t('chatNicheRag.history.clearAllConfirm.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('chatNicheRag.history.clearAllConfirm.body')}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('chatNicheRag.history.clearAllConfirm.typePlaceholder')}
            inputProps={{ 'aria-label': requiredWord, autoComplete: 'off' }}
            disabled={isPurging}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={handleClosePurge} disabled={isPurging}>
            {t('chatNicheRag.history.clearAllConfirm.cancel')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteSweepOutlinedIcon />}
            disabled={typed !== requiredWord || isPurging}
            onClick={handleConfirmPurge}
          >
            {t('chatNicheRag.history.clearAllConfirm.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </OverlayRoot>
  );
};

export default RecentChatsOverlay;
