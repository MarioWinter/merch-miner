import { useEffect } from 'react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setActiveSession,
  setRecentChatsOverlayOpen,
} from '@/store/chatBarSlice';
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
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.chatBar.recentChatsOverlayOpen);
  const activeSessionId = useAppSelector((s) => s.chatBar.activeSessionId);

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
        <RecentChats onSelect={handleSelect} activeSessionId={activeSessionId} />
      </OverlayBody>
    </OverlayRoot>
  );
};

export default RecentChatsOverlay;
