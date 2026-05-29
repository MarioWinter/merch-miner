/**
 * PROJ-20 Phase 3.6 — SourcesPopoverButton
 *
 * IconButton with a Popover containing toggleable sources. Currently only
 * `web` is exposed — Academic + Discussions were removed from the UI in
 * Phase 1J because their backing engines (arxiv/google scholar / reddit)
 * are unreliable on our datacenter IP (Reddit returns 403, academic
 * engines are POD-irrelevant). When Reddit OAuth is wired, the
 * `discussions` row can be re-enabled here without other code changes.
 *
 * The IconButton hides itself entirely when there's only one source —
 * a single-row "Web" popover is useless. When the SOURCES list grows
 * back beyond one row, the button reappears automatically.
 *
 * The badge dot appears when the current sources state differs from the
 * default `['web']`.
 */
import { memo, useMemo, useState, type ComponentType, type MouseEvent } from 'react';
import {
  Badge,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Popover,
  Switch,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import LanguageIcon from '@mui/icons-material/Language';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSearchSources } from '@/store/chatBarSlice';
import type { SearchSource } from '@/types/search';
import type { SvgIconProps } from '@mui/material';

interface SourceEntry {
  value: SearchSource;
  labelKey: string;
  Icon: ComponentType<SvgIconProps>;
}

const SOURCES: SourceEntry[] = [
  { value: 'web', labelKey: 'search.chat.source_web', Icon: LanguageIcon },
  // 'academic' + 'discussions' removed from UI 2026-05-13. Re-add the
  // SchoolIcon / ForumIcon imports + entries here when the upstream
  // engines (arxiv, reddit-via-oauth) come back online.
];

const DEFAULT_SOURCES: SearchSource[] = ['web'];

const PopoverInner = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0.5),
  minWidth: 240,
}));

const isDefaultState = (sources: SearchSource[]): boolean =>
  sources.length === DEFAULT_SOURCES.length &&
  DEFAULT_SOURCES.every((s) => sources.includes(s));

const SourcesPopoverButton = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const searchSources = useAppSelector((s) => s.chatBar.searchSources);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => setAnchorEl(null);

  const showBadge = useMemo(() => !isDefaultState(searchSources), [searchSources]);

  // Hide the entire button when there's nothing meaningful to toggle. The
  // "≥1 source enabled" rule prevents the user from disabling Web, so a
  // single-row popover is just chrome with no action.
  if (SOURCES.length <= 1) {
    return null;
  }

  const toggleSource = (source: SearchSource) => {
    const isOn = searchSources.includes(source);
    if (isOn) {
      // Enforce ≥1 source enabled.
      if (searchSources.length === 1) {
        enqueueSnackbar(t('search.chatBar.sourcesPopover.atLeastOne'), {
          variant: 'warning',
        });
        return;
      }
      dispatch(setSearchSources(searchSources.filter((s) => s !== source)));
    } else {
      dispatch(setSearchSources([...searchSources, source]));
    }
  };

  return (
    <>
      <Tooltip title={t('search.chatBar.sources')}>
        <IconButton
          size="small"
          onClick={handleOpen}
          data-testid="chat-input-sources-button"
          aria-label={t('search.chatBar.sourcesPopover.ariaLabel')}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Badge
            color="primary"
            variant="dot"
            invisible={!showBadge}
            data-testid="chat-input-sources-badge"
            data-active={showBadge ? 'true' : 'false'}
          >
            <LanguageIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        // PROJ-29 Phase 1J follow-up: disable MUI's default scroll-lock so
        // opening the popover doesn't trigger `body.overflow:hidden` +
        // padding-right compensation that briefly exposes the chat-panel
        // scrollbar (visible layout shift).
        disableScrollLock
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            ...({ 'data-testid': 'chat-input-sources-popover' } as object),
            sx: { mt: -0.5, borderRadius: 2 },
          },
        }}
      >
        <PopoverInner>
          <List dense disablePadding>
            {SOURCES.map(({ value, labelKey, Icon }) => {
              const checked = searchSources.includes(value);
              return (
                <ListItem
                  key={value}
                  data-testid={`chat-input-sources-row-${value}`}
                  secondaryAction={
                    <Switch
                      edge="end"
                      checked={checked}
                      onChange={() => toggleSource(value)}
                      size="small"
                      inputProps={{
                        'aria-label': t(labelKey),
                        // Allow tests to query the inner checkbox precisely.
                        ...({
                          'data-testid': `chat-input-sources-switch-${value}`,
                        } as Record<string, string>),
                      }}
                    />
                  }
                  sx={{ pr: 7 }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Icon sx={{ fontSize: 18 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={t(labelKey)}
                    primaryTypographyProps={{
                      variant: 'body2',
                      sx: { fontWeight: 500 },
                    }}
                  />
                </ListItem>
              );
            })}
          </List>
        </PopoverInner>
      </Popover>
    </>
  );
};

// Memo: no props, reads Redux only.
export default memo(SourcesPopoverButton);
