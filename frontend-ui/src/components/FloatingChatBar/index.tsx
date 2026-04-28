import { useCallback, useRef, useEffect } from 'react';
import { Box, Fade, IconButton } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ChatOutlinedIcon from '@mui/icons-material/ChatOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  expandBar,
  collapseBar,
  openDrawer,
  setActiveSession,
  setSearching,
} from '@/store/chatBarSlice';
import {
  useCreateSessionMutation,
  useSendMessageMutation,
} from '@/store/searchSlice';
import { useSendMessageStream } from '@/hooks/useSendMessageStream';
import { useSearchHealth } from '../MultiPurposeDrawer/hooks/useSearchHealth';
import ChatInputBar, {
  type ChatInputBarHandle,
  type ChatInputBarSubmitPayload,
} from '../MultiPurposeDrawer/panels/ChatInputBar';
import ChevronIndicator from './ChevronIndicator';
import { COLORS, EASING, DURATION } from '@/style/constants';

const BAR_MAX_WIDTH = 600;

const BarContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: theme.zIndex.speedDial,
  width: '90%',
  maxWidth: BAR_MAX_WIDTH,
  [theme.breakpoints.down('sm')]: {
    width: 'calc(100% - 24px)',
    bottom: theme.spacing(1.5),
  },
}));

const ExpandedSurface = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  padding: `${theme.spacing(0.5)} ${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)}`,
  borderRadius: 22,
  backgroundColor: alpha(COLORS.white, 0.85),
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${theme.vars.palette.divider}`,
  boxShadow: `0 8px 32px ${alpha(COLORS.ink, 0.3)}`,
  transition: `all ${DURATION.default}ms ${EASING.standard}`,
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(COLORS.inkPaper, 0.75),
  }),
}));

const CollapseHandle = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: theme.spacing(0.25),
  height: 20,
}));

const FloatingChatBar = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const {
    barExpanded,
    drawerOpen,
    activePanel,
    activeSessionId,
    searching,
    searchSources,
    selectedModel,
    modeOverride,
  } = useAppSelector((s) => s.chatBar);
  const isStreaming = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage.isStreaming,
  );
  const { vaneOnline } = useSearchHealth();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatInputBarHandle>(null);

  const [createSession] = useCreateSessionMutation();
  const [sendMessage] = useSendMessageMutation();
  const { start: startStream } = useSendMessageStream({
    sessionId: activeSessionId,
    onDone: () => dispatch(setSearching(false)),
  });

  // Restore persisted bar state on mount
  useEffect(() => {
    const persisted = localStorage.getItem('chatBar.expanded');
    if (persisted === 'true') {
      dispatch(expandBar());
    }
  }, [dispatch]);

  // Persist bar state on change
  useEffect(() => {
    localStorage.setItem('chatBar.expanded', String(barExpanded));
  }, [barExpanded]);

  // Click outside to collapse — but ignore clicks inside any Portal-rendered
  // popover that belongs to the bar (Mode/Sources/Model, @-mention picker,
  // /-command palette, /help dialog, and any MUI Menu/Popover/Modal). These
  // render into document.body via Portal so the bar's containerRef does not
  // contain them, and we'd otherwise collapse on every interaction.
  useEffect(() => {
    if (!barExpanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement | null;
        if (
          target?.closest('[data-testid="mention-picker"]') ||
          target?.closest('[data-testid="command-palette"]') ||
          target?.closest('.MuiPopover-root') ||
          target?.closest('.MuiMenu-root') ||
          target?.closest('.MuiModal-root') ||
          target?.closest('.MuiDialog-root') ||
          target?.closest('.MuiBackdrop-root') ||
          target?.closest('.notistack-SnackbarContainer')
        ) {
          return;
        }
        dispatch(collapseBar());
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [barExpanded, dispatch]);

  const handleExpand = useCallback(() => dispatch(expandBar()), [dispatch]);
  const handleCollapse = useCallback(() => dispatch(collapseBar()), [dispatch]);
  const handleOpenChat = useCallback(() => dispatch(openDrawer('chat')), [dispatch]);

  // PROJ-20 Phase 3.7 — submit flow.
  // Mirrors ChatPanel.handleSubmit: agent → POST mutation, auto/web → SSE.
  // Chip is captured at submit time via `payload.chip` (EC-10).
  const handleSubmit = useCallback(
    async (payload: ChatInputBarSubmitPayload) => {
      const trimmed = payload.text.trim();
      if (!trimmed || searching || !vaneOnline || isStreaming) return;

      const niche_id = payload.chip?.niche_id ?? null;

      dispatch(setSearching(true));
      inputRef.current?.clear();

      try {
        let sessionId = activeSessionId;
        if (!sessionId) {
          const newSession = await createSession({
            niche_context: niche_id ?? undefined,
            title: trimmed.slice(0, 100),
          }).unwrap();
          sessionId = newSession.id;
          dispatch(setActiveSession(sessionId));
          dispatch(openDrawer('chat'));
        }

        if (modeOverride === 'agent') {
          await sendMessage({
            sessionId,
            body: {
              content: trimmed,
              search_sources: searchSources,
              model: selectedModel,
              mode_override: modeOverride,
            },
          }).unwrap();
          dispatch(setSearching(false));
        } else {
          startStream({
            content: trimmed,
            mode_override: modeOverride,
            niche_id,
            sessionIdOverride: sessionId,
          });
          // searching cleared by useSendMessageStream onDone callback
        }
      } catch {
        enqueueSnackbar(t('search.chat.sendError'), { variant: 'error' });
        dispatch(setSearching(false));
      }
    },
    [
      searching,
      vaneOnline,
      isStreaming,
      activeSessionId,
      searchSources,
      selectedModel,
      modeOverride,
      dispatch,
      createSession,
      sendMessage,
      startStream,
      enqueueSnackbar,
      t,
    ],
  );

  // PROJ-17 fix: hide bar VISUALLY when drawer is open on chat panel — drawer
  // owns its own input. We do NOT unmount because that would kill the active
  // EventSource (useSendMessageStream lives in this component's tree and the
  // stream might still be flushing chunks the user just kicked off).
  const hiddenForDrawer = drawerOpen && activePanel === 'chat';

  // Default-collapsed state: only the chevron indicator at bottom-center.
  // Even when hidden for drawer, we keep an invisible mount alive so the
  // streaming EventSource started by handleSend doesn't get torn down.
  if (!barExpanded) {
    if (hiddenForDrawer) {
      return <Box sx={{ display: 'none' }} aria-hidden="true" />;
    }
    return (
      <ChevronIndicator
        onClick={handleExpand}
        ariaLabel={t('search.chatBar.expand')}
      />
    );
  }

  // Expanded state: full input bar with close-chevron at top.
  // Fade animates opacity only — does NOT inject a transform like Slide
  // would, which previously clobbered the BarContainer's `translateX(-50%)`
  // centering and pushed the bar off to the left.
  // Fade only animates between visible expanded states; when hiddenForDrawer
  // we just keep BarContainer mounted but display:none — avoids an animation
  // race with the in-flight EventSource that would re-trigger renders.
  if (hiddenForDrawer) {
    return <Box sx={{ display: 'none' }} aria-hidden="true" />;
  }

  return (
    <Fade in={barExpanded} timeout={DURATION.default}>
      <BarContainer ref={containerRef}>
        <ExpandedSurface>
          <CollapseHandle>
            <IconButton
              size="small"
              onClick={handleOpenChat}
              aria-label={t('search.chatBar.openChat')}
              sx={{ p: 0.25, color: 'text.secondary' }}
            >
              <ChatOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleCollapse}
              aria-label={t('search.chatBar.collapse')}
              sx={{ p: 0.25, color: 'text.secondary' }}
            >
              <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </CollapseHandle>
          <ChatInputBar
            ref={inputRef}
            appearance="floating"
            onSubmit={handleSubmit}
            isSending={searching || isStreaming}
            disabled={!vaneOnline}
          />
        </ExpandedSurface>
      </BarContainer>
    </Fade>
  );
};

export default FloatingChatBar;
