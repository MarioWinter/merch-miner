// z-index stack (MUI defaults + our overrides):
//   Modal (Dialog) 1300 > MultiPurposeDrawer 1200 > AppBar/Topbar 1100 >
//   Snackbar 1400 (notistack ≥ Dialog by design)
// Document any change here so future shell tweaks don't introduce overlap bugs.

import { useRef } from 'react';
import { Box, Drawer, IconButton, Stack, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
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
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
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
  // PROJ-30 T2.8 — viewport-tier source-of-truth.
  const { isMobile, isTablet, isDesktop } = useResponsiveLayout();
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

  // Geometry per viewport tier (design Section 7):
  //   <600px        → 100vw, top:0 (covers Topbar), variant=temporary
  //   600–899px     → 80vw,  variant=temporary
  //   ≥900px        → user-resized width, top:56, variant=persistent
  const variant = isDesktop ? 'persistent' : 'temporary';
  const paperWidth = isMobile
    ? '100vw'
    : isTablet
      ? '80vw'
      : width;
  const paperTop = isMobile ? 0 : 56;
  const paperHeight = isMobile ? '100%' : 'calc(100% - 56px)';

  return (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={handleClose}
      variant={variant}
      slotProps={{
        paper: {
          id: 'mpd-drawer-paper',
          sx: {
            width: paperWidth,
            display: 'flex',
            flexDirection: 'column',
            top: paperTop,
            height: paperHeight,
            transition: 'width 200ms ease',
            // FIX-dashboard Item 2 — DrawerLayoutToggle floats at left:-24
            // off the Paper's left edge. MUI's default Paper clips that
            // wrap so only the IconButton is visible, letting underlying
            // page content (NicheFilterToolbar pills etc.) bleed through
            // the cutout ring. Mirror the sidebar's pattern by allowing
            // the toggle to overflow; the panel-container scroll lives
            // INSIDE its own #mpd-panel-container so this doesn't break
            // body scrolling.
            overflow: 'visible',
            // 1200px Full Command Center: 3-column NotebookLM layout (desktop only)
            ...(isDesktop && width >= 1200
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
      {/* Drag-handle on left edge — desktop only */}
      {isDesktop && (
        <DrawerResizeHandle
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      )}

      {/* Layout toggle — flips between overlap and side-by-side modes (desktop only) */}
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
          {/* Close button: always visible. On <md the explicit i18n
              `responsive.drawer.closeLabel` is used to make the affordance
              clear; on desktop we keep the chat-scoped `search.drawer.close`. */}
          <IconButton
            size="small"
            onClick={handleClose}
            aria-label={
              isDesktop
                ? t('search.drawer.close')
                : t('responsive.drawer.closeLabel')
            }
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
