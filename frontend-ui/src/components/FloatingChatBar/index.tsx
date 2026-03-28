import { useCallback, useRef, useEffect } from 'react';
import { Box, Fade, Slide } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  expandBar,
  collapseBar,
  hideBar,
  showBar,
  openDrawer,
  setActiveSession,
  setSearching,
} from '@/store/chatBarSlice';
import { useCreateSessionMutation, useSendMessageMutation } from '@/store/searchSlice';
import { useSearchHealth } from '../MultiPurposeDrawer/hooks/useSearchHealth';
import ChatBarInput from './ChatBarInput';
import { EASING, DURATION } from '@/style/constants';

const BAR_HEIGHT = 52;
const BAR_MAX_WIDTH = 560;

const BarContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: theme.zIndex.speedDial,
  width: '90%',
  maxWidth: BAR_MAX_WIDTH,
  [theme.breakpoints.down('sm')]: {
    width: 'calc(100% - 32px)',
    bottom: theme.spacing(2),
  },
}));

const BarSurface = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: BAR_HEIGHT,
  padding: `0 ${theme.spacing(2)}`,
  borderRadius: 26,
  backgroundColor: alpha(theme.palette.background.paper, 0.85),
  backdropFilter: 'blur(16px)',
  border: `1px solid ${alpha(theme.palette.divider, 1)}`,
  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}`,
  transition: `all ${DURATION.default}ms ${EASING.standard}`,
  cursor: 'pointer',
  '&:hover': {
    boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.45)}`,
  },
}));

const ExpandedSurface = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  minHeight: BAR_HEIGHT,
  padding: `${theme.spacing(1)} ${theme.spacing(2)}`,
  borderRadius: 26,
  backgroundColor: alpha(theme.palette.background.paper, 0.9),
  backdropFilter: 'blur(16px)',
  border: `1px solid ${alpha(theme.palette.divider, 1)}`,
  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}`,
}));

const HoverTrigger = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 80,
  height: 24,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: theme.zIndex.speedDial - 1,
  color: theme.vars.palette.text.secondary,
  opacity: 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.enter}`,
  '&:hover': { opacity: 1 },
}));

const FloatingChatBar = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const { barExpanded, barHidden, nicheContext, searching, searchMode, searchSources, selectedModel } =
    useAppSelector((s) => s.chatBar);
  const { vaneOnline } = useSearchHealth();

  const [createSession] = useCreateSessionMutation();
  const [sendMessage] = useSendMessageMutation();
  const containerRef = useRef<HTMLDivElement>(null);

  // Click outside to collapse
  useEffect(() => {
    if (!barExpanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dispatch(collapseBar());
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [barExpanded, dispatch]);

  const handleSend = useCallback(
    async (message: string) => {
      dispatch(setSearching(true));
      try {
        // Create session if none active
        const session = await createSession({
          niche_context: nicheContext?.id,
          title: message.slice(0, 100),
        }).unwrap();

        dispatch(setActiveSession(session.id));
        dispatch(openDrawer('chat'));
        dispatch(collapseBar());

        // Send message
        await sendMessage({
          sessionId: session.id,
          body: {
            content: message,
            search_mode: searchMode,
            search_sources: searchSources,
            model: selectedModel,
          },
        }).unwrap();
      } catch {
        enqueueSnackbar(t('search.chat.sendError'), { variant: 'error' });
      } finally {
        dispatch(setSearching(false));
      }
    },
    [dispatch, createSession, sendMessage, nicheContext, searchMode, searchSources, selectedModel, enqueueSnackbar, t],
  );

  const handleDismiss = useCallback(() => {
    dispatch(hideBar());
  }, [dispatch]);

  const handleReveal = useCallback(() => {
    dispatch(showBar());
  }, [dispatch]);

  return (
    <>
      {/* Hidden state: hover trigger */}
      {barHidden && (
        <HoverTrigger onClick={handleReveal} aria-label={t('search.chatBar.reveal')}>
          <KeyboardArrowUpIcon sx={{ fontSize: 20 }} />
        </HoverTrigger>
      )}

      {/* Visible states */}
      {!barHidden && (
        <Slide direction="up" in={!barHidden} timeout={DURATION.slow}>
          <BarContainer ref={containerRef}>
            {!barExpanded ? (
              <Fade in={!barExpanded} timeout={DURATION.fast}>
                <BarSurface
                  onClick={() => dispatch(expandBar())}
                  role="button"
                  tabIndex={0}
                  aria-label={t('search.chatBar.expand')}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') dispatch(expandBar());
                  }}
                >
                  <Box component="span" sx={{ color: 'text.secondary', fontSize: '0.8125rem', fontWeight: 500 }}>
                    {t('search.chatBar.placeholder')}
                  </Box>
                </BarSurface>
              </Fade>
            ) : (
              <ExpandedSurface>
                <ChatBarInput
                  onSend={handleSend}
                  onDismiss={handleDismiss}
                  sending={searching}
                  disabled={!vaneOnline}
                />
              </ExpandedSurface>
            )}
          </BarContainer>
        </Slide>
      )}
    </>
  );
};

export default FloatingChatBar;
