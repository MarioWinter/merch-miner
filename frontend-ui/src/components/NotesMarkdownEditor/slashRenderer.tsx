/* eslint-disable react-refresh/only-export-components */
/**
 * MUI Popper UI for the TipTap slash-command suggestion. Imperatively
 * mounted/unmounted by the suggestion plugin via `slashCommand.ts`.
 *
 * This file exports BOTH a non-component bridge function
 * (`renderSlashPopup`) and React components. Fast-refresh lints flag this
 * but the imperative bridge is the whole point of the file — they belong
 * together for cohesion.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  ClickAwayListener,
  MenuList,
  MenuItem,
  Paper,
  Popper,
  Typography,
} from '@mui/material';
import { CssVarsProvider, styled } from '@mui/material/styles';
import { createRoot, type Root } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { SnackbarProvider } from 'notistack';
import theme from '@/style/theme';
import type { SlashCommandItem } from './slashCommand';

export interface SlashRenderState {
  items: SlashCommandItem[];
  clientRect: (() => DOMRect | null) | null;
  onSelect: (item: SlashCommandItem) => void;
}

export interface SlashRenderApi {
  update: (next: SlashRenderState) => void;
  handleKeyDown: (event: KeyboardEvent) => boolean;
  destroy: () => void;
}

const MenuPaper = styled(Paper)({
  width: 300,
  maxHeight: 360,
  overflowY: 'auto',
});

const Row = styled(MenuItem, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  flexDirection: 'column',
  gap: theme.spacing(0.25),
  padding: theme.spacing(0.75, 1.25),
  backgroundColor: isActive
    ? theme.vars.palette.action.selected
    : 'transparent',
  '&:hover': { backgroundColor: theme.vars.palette.action.hover },
}));

// Imperative API exposed to the TipTap plugin. The component talks to the
// plugin via a ref so keydown returns true/false synchronously.
interface SlashMenuRefApi {
  handleKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashMenuProps {
  state: SlashRenderState;
  apiRef: RefObject<SlashMenuRefApi | null>;
  onDestroy: () => void;
}

const SlashMenu = ({ state, apiRef, onDestroy }: SlashMenuProps) => {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const itemsRef = useRef(state.items);
  const onSelectRef = useRef(state.onSelect);
  const activeRef = useRef(0);

  useEffect(() => {
    itemsRef.current = state.items;
    onSelectRef.current = state.onSelect;
  }, [state.items, state.onSelect]);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(0);
  }, [state.items]);

  useEffect(() => {
    apiRef.current = {
      handleKeyDown: (event: KeyboardEvent) => {
        const items = itemsRef.current;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActive((i) => (items.length ? (i + 1) % items.length : 0));
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActive((i) =>
            items.length ? (i - 1 + items.length) % items.length : 0,
          );
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          const item = items[activeRef.current];
          if (item) onSelectRef.current(item);
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onDestroy();
          return true;
        }
        return false;
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, onDestroy]);

  const rect = state.clientRect?.() ?? null;
  if (!rect) return null;

  // Virtual element for Popper positioning at caret rect.
  const anchorEl = {
    getBoundingClientRect: () => rect,
  } as Element;

  const isEmpty = state.items.length === 0;

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="bottom-start"
      modifiers={[
        { name: 'offset', options: { offset: [0, 4] } },
        { name: 'flip', enabled: true },
        {
          name: 'preventOverflow',
          enabled: true,
          options: { boundary: 'viewport' },
        },
      ]}
      sx={(t) => ({ zIndex: t.zIndex.tooltip + 1 })}
    >
      <ClickAwayListener onClickAway={onDestroy}>
        <MenuPaper elevation={3}>
          {isEmpty ? (
            <Row isActive={false} disabled>
              <Typography variant="body2" color="text.secondary">
                {t('notesEditor.commands.empty')}
              </Typography>
            </Row>
          ) : (
            <MenuList dense role="listbox" sx={{ py: 0.5 }}>
              {state.items.map((item, idx) => (
                <Row
                  key={item.id}
                  isActive={idx === active}
                  role="option"
                  aria-selected={idx === active}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => state.onSelect(item)}
                >
                  <Typography variant="body2" fontWeight={600}>
                    {item.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                </Row>
              ))}
            </MenuList>
          )}
        </MenuPaper>
      </ClickAwayListener>
    </Popper>
  );
};

const RootWrapper = ({
  state,
  apiRef,
  onDestroy,
}: SlashMenuProps) => (
  <CssVarsProvider theme={theme} defaultMode="dark">
    <SnackbarProvider>
      {createPortal(
        <SlashMenu state={state} apiRef={apiRef} onDestroy={onDestroy} />,
        document.body,
      )}
    </SnackbarProvider>
  </CssVarsProvider>
);

export const renderSlashPopup = (initial: SlashRenderState): SlashRenderApi => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const apiRef: { current: SlashMenuRefApi | null } = { current: null };
  let currentState = initial;

  const destroy = () => {
    root.unmount();
    container.remove();
  };

  const renderRoot = () => {
    root.render(
      <RootWrapper
        state={currentState}
        apiRef={apiRef}
        onDestroy={destroy}
      />,
    );
  };

  renderRoot();

  return {
    update: (next) => {
      currentState = next;
      renderRoot();
    },
    handleKeyDown: (event) => apiRef.current?.handleKeyDown(event) ?? false,
    destroy,
  };
};
