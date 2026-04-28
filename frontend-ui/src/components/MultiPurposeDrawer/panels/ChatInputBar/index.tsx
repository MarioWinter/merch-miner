import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, Stack } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import ModePopoverButton from './partials/ModePopoverButton';
import SourcesPopoverButton from './partials/SourcesPopoverButton';
import ModelPopoverButton from './partials/ModelPopoverButton';
import AttachmentButton from './partials/AttachmentButton';
import SendButton from './partials/SendButton';
import HelperHint from './partials/HelperHint';
import SmartTextarea, {
  type SmartTextareaHandle,
  type SmartTextareaValue,
} from './SmartTextarea';
import MentionPicker, {
  type MentionPickerNiche,
} from './partials/MentionPicker';
import CommandPalette from './partials/CommandPalette';
import HelpCommandsPopup from './partials/HelpCommandsPopup';
import { useMentionTrigger } from './hooks/useMentionTrigger';
import { useCommandTrigger } from './hooks/useCommandTrigger';
import { useNicheChipSync } from './hooks/useNicheChipSync';
import { useListNichesQuery } from '@/store/nicheSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setInputChip } from '@/store/chatBarSlice';
import type { CommandContext } from './utils/commandRegistry';

/**
 * PROJ-20 Phase 3.7 — ChatInputBar imperative handle.
 *
 * Parent surfaces (FloatingChatBar, ChatPanel) drive send-flow via this
 * handle. They read the captured chip + text at send-time (EC-10 semantics)
 * and call `clear()` once the message is in flight.
 */
export interface ChatInputBarHandle {
  getValue: () => SmartTextareaValue;
  clear: () => void;
  focus: () => void;
}

export interface ChatInputBarSubmitPayload {
  text: string;
  chip: SmartTextareaValue['chip'];
}

interface ChatInputBarProps {
  appearance: 'floating' | 'panel';
  /**
   * Fired when the user presses Enter or clicks Send. Receives the captured
   * `{text, chip}` snapshot at submit time. The parent is responsible for
   * clearing the input via the imperative handle once the message is in
   * flight.
   */
  onSubmit?: (payload: ChatInputBarSubmitPayload) => void;
  /**
   * External signal that a send is currently in flight (SSE streaming or
   * Agent-mode POST). Disables the Send button + the textarea.
   */
  isSending?: boolean;
  /**
   * Hard-disable the entire input (e.g. Vane offline). Disables submission
   * and styles the editable surface as disabled.
   */
  disabled?: boolean;
}

interface ShellProps {
  appearance: 'floating' | 'panel';
}

const Shell = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'appearance',
})<ShellProps>(({ theme, appearance }) => ({
  width: '100%',
  borderRadius: 22,
  padding: theme.spacing(1.5, 1.75),
  border: `1px solid ${theme.vars.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  transition: 'border-color 150ms ease, background-color 150ms ease',
  ...(appearance === 'floating'
    ? {
        // Vane-style dark glass. We can't use `theme.vars.palette.background.paper`
        // here because we wrap it in `alpha()` for the translucent surface and
        // need different alpha values per scheme. Use COLORS tokens + applyStyles.
        backgroundColor: alpha(COLORS.white, 0.85),
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: `0 8px 32px ${alpha(COLORS.ink, 0.3)}`,
        ...theme.applyStyles('dark', {
          backgroundColor: alpha(COLORS.inkPaper, 0.75),
        }),
      }
    : {
        backgroundColor: theme.vars.palette.background.paper,
      }),
  '&:focus-within': {
    borderColor: theme.vars.palette.primary.main,
  },
}));

const ActionBar = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  paddingLeft: theme.spacing(0.5),
  paddingRight: theme.spacing(0.5),
}));

const ChatInputBar = forwardRef<ChatInputBarHandle, ChatInputBarProps>(
  function ChatInputBar(
    { appearance, onSubmit, isSending = false, disabled = false },
    ref,
  ) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const placeholder = t('search.chatBar.placeholder');
  const textareaRef = useRef<SmartTextareaHandle>(null);
  const reduxInputChip = useAppSelector((s) => s.chatBar.inputChip);
  // PROJ-20 Phase 3.7: empty-state drives Send-button disabled rendering.
  const [isEmpty, setIsEmpty] = useState(true);
  const isStreaming = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage.isStreaming,
  );

  // PROJ-20 Phase 3.7 — expose imperative handle so parent surfaces can
  // capture chip/text at submit time (EC-10) and clear/focus the input.
  useImperativeHandle(
    ref,
    (): ChatInputBarHandle => ({
      getValue: () =>
        textareaRef.current?.getValue() ?? { text: '', chip: null },
      clear: () => textareaRef.current?.clear(),
      focus: () => textareaRef.current?.focus(),
    }),
    [],
  );

  const handleSubmit = useCallback(() => {
    if (disabled || isSending || isStreaming) return;
    const value = textareaRef.current?.getValue();
    if (!value) return;
    const trimmed = value.text.trim();
    // Plain text is required — a chip alone is not enough to send a message.
    if (trimmed.length === 0) return;
    onSubmit?.({ text: trimmed, chip: value.chip });
  }, [onSubmit, disabled, isSending, isStreaming]);

  // Niches for the @-mention picker. We fetch a generous first page (200) —
  // typical workspaces have far fewer than that, and the picker filters
  // client-side.
  const { data: nichesData, isLoading: nichesLoading } = useListNichesQuery({
    page_size: 200,
  });

  // PROJ-20 Phase 3.4: keep Redux `inputChip` in sync with the chip in the
  // contenteditable DOM. The DOM is the source of truth while the user is
  // typing, but Redux is the canonical state read on send (ChatPanel reads
  // `inputChip` to build SSE/POST payload). Without this wiring, manually
  // selecting a chip via @-mention or auto-prefill would never reach the
  // backend.
  const handleValueChange = useCallback(
    (value: SmartTextareaValue) => {
      // PROJ-20 Phase 3.6: drive Send-button disabled state.
      const empty = value.text.trim().length === 0 && value.chip === null;
      setIsEmpty(empty);

      const chip = value.chip;
      const reduxChipId = reduxInputChip?.niche_id ?? null;
      const domChipId = chip?.niche_id ?? null;
      if (reduxChipId === domChipId) return;
      if (chip) {
        dispatch(
          setInputChip({ niche_id: chip.niche_id, niche_name: chip.niche_name }),
        );
      } else {
        dispatch(setInputChip(null));
      }
    },
    [dispatch, reduxInputChip],
  );

  // PROJ-20 Phase 3.4: auto-prefill chip from drawer-niche.
  useNicheChipSync({ smartTextareaRef: textareaRef });

  const niches = useMemo<MentionPickerNiche[]>(() => {
    const list = nichesData?.results ?? [];
    return list.map((n) => ({
      id: n.id,
      name: n.name,
      // Niche type currently has no slug — fall back to a derived form.
      slug: n.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    }));
  }, [nichesData]);

  const { pickerProps } = useMentionTrigger({
    smartTextareaRef: textareaRef,
    niches,
    isLoading: nichesLoading,
    onCreateNicheRequested: () => {
      // Stub — Phase 3.7 / a follow-up task will open NicheCreate modal here.
      // For now, just notify the user so the UX surface is at least visible.
      console.log('open niche create modal');
      enqueueSnackbar(
        t('search.chatBar.mentionPicker.createNicheStubMsg'),
        { variant: 'info' },
      );
    },
  });

  // PROJ-20 Phase 3.5: slash command palette state.
  const [helpOpen, setHelpOpen] = useState(false);
  // `pendingCommand` is set by the `/niche` executor — after the palette
  // closes (and the `/niche` text has been stripped) we run a follow-up
  // effect-style action: insert `@` at cursor so `useMentionTrigger` opens.
  // We use a callback ref + effectful follow-up via a custom imperative
  // path: the simplest reliable approach is to fire a synthetic `@`
  // KeyboardEvent on the editable element. SmartTextarea + useMentionTrigger
  // already handle that path.
  const triggerMentionFromCommand = useCallback(() => {
    const handle = textareaRef.current;
    const root = handle?.getEditableElement();
    if (!root) return;
    handle?.focus();
    // Insert `@` at the current selection so the editor naturally has an
    // `@` character to anchor against. We then dispatch a keydown so
    // useMentionTrigger fires its open routine.
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const at = document.createTextNode('@');
      range.insertNode(at);
      range.setStartAfter(at);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      // Notify SmartTextarea so it updates data-has-content.
      root.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Synthesize an `@` keydown so the mention hook opens its picker.
    root.dispatchEvent(
      new KeyboardEvent('keydown', { key: '@', bubbles: true }),
    );
  }, []);

  const getCommandContext = useCallback(
    (): CommandContext => ({
      dispatch,
      enqueueSnackbar,
      t,
      openMentionPicker: triggerMentionFromCommand,
      openModelPopover: undefined, // Phase 3.6 will wire this
      openHelpPopup: () => setHelpOpen(true),
      removeChip: () => {
        textareaRef.current?.removeChip();
      },
    }),
    [dispatch, enqueueSnackbar, t, triggerMentionFromCommand],
  );

  const { paletteProps } = useCommandTrigger({
    smartTextareaRef: textareaRef,
    getCommandContext,
  });

  const sendDisabled = disabled || isSending || isStreaming;

  return (
    <Box data-testid="chat-input-bar" sx={{ width: '100%' }}>
      <Shell appearance={appearance} data-appearance={appearance}>
        <SmartTextarea
          ref={textareaRef}
          appearance={appearance}
          placeholder={placeholder}
          ariaLabel={placeholder}
          disabled={disabled}
          onValueChange={handleValueChange}
          onSubmit={handleSubmit}
        />
        <ActionBar>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <ModePopoverButton />
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.25}>
            <SourcesPopoverButton />
            <ModelPopoverButton />
            <AttachmentButton />
            <Box sx={{ ml: 0.5 }}>
              <SendButton
                isEmpty={isEmpty}
                isStreaming={sendDisabled}
                onSubmit={handleSubmit}
              />
            </Box>
          </Stack>
        </ActionBar>
      </Shell>
      <HelperHint />
      <MentionPicker {...pickerProps} />
      <CommandPalette {...paletteProps} />
      <HelpCommandsPopup open={helpOpen} onClose={() => setHelpOpen(false)} />
    </Box>
  );
  },
);

export default ChatInputBar;
