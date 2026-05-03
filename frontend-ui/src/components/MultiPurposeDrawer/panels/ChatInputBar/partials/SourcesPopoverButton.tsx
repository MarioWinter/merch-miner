/**
 * PROJ-20 Phase 3.6 — SourcesPopoverButton
 *
 * Replaces the Phase 3.1 stub. IconButton with a Popover containing 3
 * toggleable sources (Web / Academic / Discussions). Each row is an MUI
 * `Switch`. We enforce ≥1 source enabled at all times — toggling off the
 * last enabled source is a no-op + warning Snackbar.
 *
 * The IconButton shows a small primary-colored badge dot whenever the
 * current sources state differs from the default `['web']`.
 */
import { useMemo, useState, type ComponentType, type MouseEvent } from 'react';
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
import SchoolIcon from '@mui/icons-material/School';
import ForumIcon from '@mui/icons-material/Forum';
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
  { value: 'academic', labelKey: 'search.chat.source_academic', Icon: SchoolIcon },
  {
    value: 'discussions',
    labelKey: 'search.chat.source_discussions',
    Icon: ForumIcon,
  },
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

export default SourcesPopoverButton;
