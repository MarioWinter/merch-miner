import { useRef } from 'react';
import { Box, Drawer, IconButton, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeDrawer, setActivePanel } from '@/store/chatBarSlice';
import type { DrawerPanel } from '@/types/search';
import DrawerSegments from './DrawerSegments';
import ChatPanel from './panels/ChatPanel';
import SearchResultsPanel from './panels/SearchResultsPanel';
import NicheDetailPanel from './panels/NicheDetailPanel';
import AgentPanel from './panels/AgentPanel';

const DRAWER_WIDTH = 480;

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
  const { drawerOpen, activePanel, nicheContext } = useAppSelector((s) => s.chatBar);

  // Preserve scroll positions per panel
  const scrollRefs = useRef<Record<DrawerPanel, number>>({ niche: 0, chat: 0, search: 0, agent: 0 });

  const handlePanelChange = (panel: DrawerPanel) => {
    // Save current scroll position
    const container = document.getElementById('mpd-panel-container');
    if (container) {
      scrollRefs.current[activePanel] = container.scrollTop;
    }
    dispatch(setActivePanel(panel));
    // Restore scroll for new panel
    requestAnimationFrame(() => {
      const el = document.getElementById('mpd-panel-container');
      if (el) el.scrollTop = scrollRefs.current[panel] ?? 0;
    });
  };

  const handleClose = () => {
    dispatch(closeDrawer());
  };

  const showNicheTab = !!nicheContext;

  return (
    <Drawer
      anchor="right"
      open={drawerOpen}
      onClose={handleClose}
      variant={isMobile ? 'temporary' : 'persistent'}
      slotProps={{
        paper: {
          sx: {
            width: isMobile ? '100%' : DRAWER_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            top: isMobile ? 0 : 56,
            height: isMobile ? '100%' : 'calc(100% - 56px)',
          },
        },
      }}
    >
      <DrawerHeader>
        <DrawerSegments
          activePanel={activePanel}
          onChange={handlePanelChange}
          showNiche={showNicheTab}
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

      <PanelContainer id="mpd-panel-container">
        {activePanel === 'niche' && <NicheDetailPanel />}
        {activePanel === 'chat' && <ChatPanel />}
        {activePanel === 'search' && <SearchResultsPanel />}
        {activePanel === 'agent' && <AgentPanel />}
      </PanelContainer>
    </Drawer>
  );
};

export default MultiPurposeDrawer;
