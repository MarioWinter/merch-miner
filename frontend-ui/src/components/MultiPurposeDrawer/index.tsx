import { useRef } from 'react';
import { Box, Drawer, IconButton, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeDrawer, setActivePanel } from '@/store/chatBarSlice';
import type { DrawerPanel } from '@/types/search';
import DrawerSegments from './DrawerSegments';
import DrawerResizeHandle from './DrawerResizeHandle';
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

      <DrawerHeader>
        <DrawerSegments
          activePanel={activePanel}
          onChange={handlePanelChange}
        />
        <IconButton
          size="small"
          onClick={handleClose}
          aria-label={t('search.drawer.close')}
          sx={{ borderRadius: 2 }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DrawerHeader>

      <PanelContainer id="mpd-panel-container" data-mpd-width={width}>
        {activePanel === 'niche' && <NichePipeline />}
        {activePanel === 'chat' && <ChatPanel />}
        {activePanel === 'agent' && <AgentPanel />}
      </PanelContainer>
    </Drawer>
  );
};

export default MultiPurposeDrawer;
