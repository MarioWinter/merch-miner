/**
 * FIX-ai-research-like-and-notes-editor — Phase 4D
 *
 * MUI `Popper` rendering the 15 slash commands. Anchors to a virtual element
 * built from the caret rect (textarea-relative top/left/height) + the
 * textarea's `getBoundingClientRect()` so the Popper tracks the caret in
 * screen coordinates. Flips above the caret when near the viewport bottom
 * (EC-B8) and shifts left when near the right edge (EC-B9).
 */
import { useMemo, type RefObject } from 'react';
import {
  ClickAwayListener,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import TitleIcon from '@mui/icons-material/Title';
import TitleOutlinedIcon from '@mui/icons-material/TitleOutlined';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import CodeIcon from '@mui/icons-material/Code';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import LinkIcon from '@mui/icons-material/Link';
import type {
  SlashAnchorRect,
  SlashMenuProps,
} from '../hooks/useTextareaSlashMenu';
import type {
  SlashCommand,
  SlashIconName,
} from '../utils/commandRegistry';

const ICON_MAP: Record<SlashIconName, typeof FormatListBulletedIcon> = {
  FormatListBulleted: FormatListBulletedIcon,
  CheckBoxOutlined: CheckBoxOutlinedIcon,
  FormatListNumbered: FormatListNumberedIcon,
  Title: TitleIcon,
  TitleOutlined: TitleOutlinedIcon,
  Subtitles: SubtitlesIcon,
  FormatQuote: FormatQuoteIcon,
  InfoOutlined: InfoOutlinedIcon,
  LightbulbOutlined: LightbulbOutlinedIcon,
  WarningAmberOutlined: WarningAmberOutlinedIcon,
  PriorityHigh: PriorityHighIcon,
  Code: CodeIcon,
  HorizontalRule: HorizontalRuleIcon,
  FormatBold: FormatBoldIcon,
  Link: LinkIcon,
};

interface SlashCommandMenuComponentProps extends SlashMenuProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
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
  gap: theme.spacing(1.25),
  padding: theme.spacing(0.75, 1.25),
  backgroundColor: isActive
    ? theme.vars.palette.action.selected
    : 'transparent',
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
  },
}));

const IconWrap = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: theme.vars.palette.text.secondary,
  marginTop: 2,
}));

const computeScreenRect = (
  anchor: SlashAnchorRect | null,
  textarea: HTMLTextAreaElement | null,
): DOMRect | null => {
  if (!anchor || !textarea) return null;
  const taRect = textarea.getBoundingClientRect();
  const top = taRect.top + anchor.top;
  const left = taRect.left + anchor.left;
  const height = anchor.height;
  return {
    top,
    left,
    right: left,
    bottom: top + height,
    width: 0,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
};

const SlashCommandMenu = (props: SlashCommandMenuComponentProps) => {
  const {
    open,
    anchorRect,
    commands,
    activeIndex,
    onSelect,
    onHoverIndex,
    onClose,
    textareaRef,
  } = props;
  const { t } = useTranslation();

  const virtualAnchor = useMemo(() => {
    if (!open) return null;
    return {
      getBoundingClientRect: () =>
        computeScreenRect(anchorRect, textareaRef.current) ??
        ({
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect),
    };
    // Re-create on each open/anchor change so the Popper recomputes position.
  }, [open, anchorRect, textareaRef]);

  if (!open) return null;

  const isEmpty = commands.length === 0;

  return (
    <Popper
      open={open}
      anchorEl={virtualAnchor}
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
      // The Popper is portaled to <body>, but its outer wrapper defaults to
      // z-index:auto which loses against the Drawer's z-index:1200. The Paper's
      // own z-index can't escape this stacking context — so we must lift the
      // wrapper itself above the Drawer. Tooltip layer + 1 keeps it above any
      // surface MUI ever puts on top of a drawer.
      sx={(theme) => ({ zIndex: theme.zIndex.tooltip + 1 })}
      data-testid="notes-editor-slash-menu"
    >
      <ClickAwayListener onClickAway={onClose}>
        <MenuPaper elevation={3} data-testid="notes-editor-slash-menu-paper">
          {isEmpty ? (
            <Row
              isActive={false}
              disabled
              data-testid="notes-editor-slash-menu-empty"
            >
              <Typography variant="body2" color="text.secondary">
                {t('notesEditor.commands.empty')}
              </Typography>
            </Row>
          ) : (
            <MenuList
              dense
              role="listbox"
              aria-label={t('notesEditor.commands.listboxAriaLabel', {
                defaultValue: 'Slash commands',
              })}
            >
              {commands.map((cmd: SlashCommand, idx) => {
                const Icon = ICON_MAP[cmd.iconName];
                const isActive = idx === activeIndex;
                return (
                  <Row
                    key={cmd.id}
                    isActive={isActive}
                    role="option"
                    aria-selected={isActive}
                    selected={isActive}
                    onMouseDown={(e) => {
                      // Prevent the textarea from losing focus on click.
                      e.preventDefault();
                    }}
                    onClick={() => onSelect(cmd)}
                    onMouseEnter={() => onHoverIndex(idx)}
                    data-testid={`notes-editor-slash-menu-row-${idx}`}
                  >
                    <IconWrap>
                      <Icon fontSize="small" />
                    </IconWrap>
                    <span
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 500, lineHeight: 1.25 }}
                        noWrap
                      >
                        {t(cmd.labelKey)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ lineHeight: 1.2 }}
                        noWrap
                      >
                        {t(cmd.descriptionKey)}
                      </Typography>
                    </span>
                  </Row>
                );
              })}
            </MenuList>
          )}
        </MenuPaper>
      </ClickAwayListener>
    </Popper>
  );
};

export default SlashCommandMenu;
