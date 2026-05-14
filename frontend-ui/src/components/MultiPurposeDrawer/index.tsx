import { useRef } from 'react';
import { Box, Drawer, IconButton, Stack, Tooltip, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  closeDrawer,
  setActivePanel,
  setRecentChatsOverlayOpen,
  startNewChat,
} from '@/store/chatBarSlice';
import { clearAttachments } from '@/store/attachmentsSlice';
import type { DrawerPanel } from '@/types/search';
import DrawerSegments from './DrawerSegments';
import DrawerResizeHandle from './DrawerResizeHandle';
import DrawerLayoutToggle from './DrawerLayoutToggle';
import RecentChatsOverlay from './RecentChatsOverlay';
import { useDrawerResize } from './hooks/useDrawerResize';
import ChatPanel from './panels/ChatPanel';
import NichePipeline from './panels/NichePipeline';
import AgentPanel from './panels/AgentPanel';

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(1.5)} ${theme.spacing(2)}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
  minHeight: 52,
}));

const PanelContainer = styled(Box)({
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

const MultiPurposeDrawer = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { drawerOpen, activePanel } = useAppSelector((s) => s.chatBar);
  const { width, onPointerDown, onPointerMove, onPointerUp } = useDrawerResize();

  // Preserve scroll positions per panel
  const scrollRefs = useRef<Record<DrawerPanel, number>>({ niche: 0, chat: 0, agent: 0 });

  const handlePanelChange = (panel: DrawerPanel) => {
    const container = document.getElementById('mpd-panel-container');
    if (container) {
      scrollRefs.current[activePanel] = container.scrollTop;
    }
    dispatch(setActivePanel(panel));
    requestAnimationFrame(() => {
      const el = document.getElementById('mpd-panel-container');
      if (el) el.scrollTop = scrollRefs.current[panel] ?? 0;
    });
  };

  const handleClose = () => {
    dispatch(closeDrawer());
  };

  return (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={handleClose}
      variant={isMobile ? 'temporary' : 'persistent'}
      slotProps={{
        paper: {
          id: 'mpd-drawer-paper',
          sx: {
            width: isMobile ? '100%' : width,
            display: 'flex',
            flexDirection: 'column',
            top: isMobile ? 0 : 56,
            height: isMobile ? '100%' : 'calc(100% - 56px)',
            transition: 'width 200ms ease',
            // 1200px Full Command Center: 3-column NotebookLM layout
            ...(width >= 1200 && !isMobile
              ? {
                  '& [data-mpd-layout="full"]': {
                    display: 'grid',
                    gridTemplateColumns: '280px 1fr 320px',
                    gap: 0,
                  },
                }
              : {}),
          },
        },
      }}
    >
      {/* Drag-handle on left edge (only on desktop) */}
      {!isMobile && (
        <DrawerResizeHandle
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      )}

      {/* Layout toggle — flips between overlap and side-by-side modes */}
      <DrawerLayoutToggle />

      <DrawerHeader>
        <DrawerSegments
          activePanel={activePanel}
          onChange={handlePanelChange}
        />
        <Stack direction="row" alignItems="center" gap={0.25}>
          {activePanel === 'chat' && (
            <>
              <Tooltip title={t('search.sessions.recentChats')}>
                <IconButton
                  size="small"
                  onClick={() => dispatch(setRecentChatsOverlayOpen(true))}
                  aria-label={t('search.sessions.recentChats')}
                  sx={{ borderRadius: 1.5 }}
                >
                  <HistoryIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('search.sessions.newChat')}>
                <IconButton
                  size="small"
                  onClick={() => {
                    dispatch(startNewChat());
                    dispatch(clearAttachments());
                  }}
                  aria-label={t('search.sessions.newChat')}
                  sx={{ borderRadius: 1.5 }}
                >
                  <AddIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <IconButton
            size="small"
            onClick={handleClose}
            aria-label={t('search.drawer.close')}
            sx={{ borderRadius: 2 }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </DrawerHeader>

      <PanelContainer
        id="mpd-panel-container"
        data-mpd-width={width}
        sx={{ position: 'relative' }}
      >
        {activePanel === 'niche' && <NichePipeline />}
        {activePanel === 'chat' && <ChatPanel />}
        {activePanel === 'agent' && <AgentPanel />}
        {activePanel === 'chat' && <RecentChatsOverlay />}
      </PanelContainer>
    </Drawer>
  );
};

export default MultiPurposeDrawer;
