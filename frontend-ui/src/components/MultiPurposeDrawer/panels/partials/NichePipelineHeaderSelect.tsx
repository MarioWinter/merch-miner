import { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import CheckIcon from '@mui/icons-material/Check';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useListNichesQuery } from '@/store/nicheSlice';
import type { Niche } from '@/views/niches/list/types';

interface NichePipelineHeaderSelectProps {
  activeNicheId: string | null;
  activeNicheName?: string;
  onSelectNiche: (id: string) => void;
  onCreateNew: () => void;
}

const HeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  paddingInline: theme.spacing(1),
  paddingBlock: theme.spacing(0.5),
  gap: theme.spacing(1),
  cursor: 'pointer',
  borderRadius: theme.shape.borderRadius,
  transition: 'background-color 150ms ease',
  '&:hover': { backgroundColor: theme.vars.palette.action.hover },
  '&:focus-visible': {
    outline: '2px solid',
    outlineColor: alpha(theme.palette.primary.main, 0.3),
    outlineOffset: -2,
  },
}));

const Chevron = styled(ExpandMoreOutlinedIcon, {
  shouldForwardProp: (prop) => prop !== 'open',
})<{ open: boolean }>(({ open }) => ({
  fontSize: 18,
  opacity: 0.6,
  transition: 'transform 150ms ease',
  transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
  flexShrink: 0,
}));

const SecondaryLine = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.vars.palette.text.secondary,
}));

const ITALIC_SECONDARY = { fontStyle: 'italic', color: 'text.secondary' } as const;

const formatUpdatedAgo = (
  updatedAt: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string => {
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000);
  return days <= 0
    ? t('niches.drawer.selector.today')
    : t('niches.drawer.selector.ago', { days });
};

/**
 * Header dropdown for the NichePipeline drawer panel.
 *
 * Renders a clickable row that opens a menu listing all niches in the workspace
 * (filterable, sorted by updated_at DESC) plus a "+ Create new niche" CTA.
 * Loading shows a skeleton in place of the niche name; fetch errors fall back
 * to a plain Typography + warning chip and the menu still allows "+ Create".
 *
 * Note: the Niche type does not currently expose a keyword count field — the
 * secondary line uses `idea_count` as the available count fallback. If a
 * `keyword_count` field is later added to Niche, swap it in here.
 */
export const NichePipelineHeaderSelect = ({
  activeNicheId,
  activeNicheName,
  onSelectNiche,
  onCreateNew,
}: NichePipelineHeaderSelectProps) => {
  const { t } = useTranslation();
  // Callback-ref pattern: useState instead of useRef so the Menu's anchorEl
  // and the menu-width sx update reactively when the row mounts. React 19's
  // react-hooks/refs rule forbids reading `.current` during render.
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [filterText, setFilterText] = useState('');

  const {
    data: nicheList,
    isLoading,
    isError,
  } = useListNichesQuery({ page_size: 200, ordering: '-updated_at' });

  const niches: Niche[] = useMemo(() => {
    const raw = nicheList?.results ?? [];
    const q = filterText.trim().toLowerCase();
    const filtered = q
      ? raw.filter((n) => n.name.toLowerCase().includes(q))
      : raw;
    return [...filtered].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [nicheList, filterText]);

  const handleOpen = () => {
    setFilterText('');
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handlePickNiche = (id: string) => {
    setOpen(false);
    if (id === activeNicheId) return;
    onSelectNiche(id);
  };

  const handleCreate = () => {
    setOpen(false);
    onCreateNew();
  };

  const displayName = activeNicheName ?? t('niches.drawer.selector.placeholder');

  return (
    <>
      <HeaderRow
        ref={setAnchorEl}
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          activeNicheName
            ? t('niches.drawer.selector.currentNiche', { name: activeNicheName })
            : t('niches.drawer.selector.openMenu')
        }
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOpen();
          }
        }}
      >
        {isLoading ? (
          <Skeleton variant="text" width="60%" height={24} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
              {displayName}
            </Typography>
            {isError && (
              <Chip
                size="small"
                label={t('niches.drawer.selector.fetchError')}
                icon={<WarningAmberIcon />}
                color="warning"
                variant="outlined"
              />
            )}
          </Box>
        )}
        <Chevron open={open} />
      </HeaderRow>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              width: anchorEl?.offsetWidth ?? 320,
              maxHeight: 380,
              display: 'flex',
              flexDirection: 'column',
            },
          },
          list: {
            sx: { py: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
          },
        }}
      >
        <Box sx={{ p: 1, flexShrink: 0 }} onKeyDown={(e) => e.stopPropagation()}>
          <TextField
            size="small"
            fullWidth
            autoFocus
            placeholder={t('niches.drawer.selector.filter')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            slotProps={{
              htmlInput: { 'aria-label': t('niches.drawer.selector.filter') },
              input: {
                endAdornment: filterText ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilterText('');
                      }}
                      aria-label={t('niches.drawer.selector.filter')}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
          />
        </Box>

        <Divider />

        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {isLoading || isError || niches.length === 0 ? (
            <MenuItem disabled>
              <ListItemText
                primary={t(
                  isLoading
                    ? 'niches.drawer.selector.loading'
                    : isError
                      ? 'niches.drawer.selector.fetchError'
                      : 'niches.drawer.selector.noNichesYet',
                )}
                primaryTypographyProps={ITALIC_SECONDARY}
              />
            </MenuItem>
          ) : (
            niches.map((n) => {
              const isActive = n.id === activeNicheId;
              // Niche has no keyword_count yet — fall back to idea_count.
              // Replace with `n.keyword_count` once added to the API.
              const secondary = [
                t('niches.drawer.selector.keywordsCount', { count: n.idea_count }),
                dayjs(n.updated_at).isValid() ? formatUpdatedAgo(n.updated_at, t) : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <MenuItem
                  key={n.id}
                  onClick={() => handlePickNiche(n.id)}
                  selected={isActive}
                  aria-current={isActive ? 'true' : undefined}
                  sx={{ alignItems: 'flex-start', py: 0.75 }}
                >
                  <ListItemIcon sx={{ minWidth: 24, mt: 0.25 }}>
                    {isActive ? <CheckIcon sx={{ fontSize: 16, color: 'primary.main' }} /> : null}
                  </ListItemIcon>
                  <ListItemText
                    primary={n.name}
                    primaryTypographyProps={{ fontWeight: isActive ? 600 : 400, noWrap: true }}
                    secondary={
                      <SecondaryLine component="span" variant="caption" noWrap>
                        {secondary}
                      </SecondaryLine>
                    }
                    secondaryTypographyProps={{ component: 'span' }}
                  />
                </MenuItem>
              );
            })
          )}
        </Box>

        <Divider />

        <MenuItem
          onClick={handleCreate}
          sx={{ color: 'primary.main', fontWeight: 600, flexShrink: 0 }}
        >
          <ListItemIcon sx={{ minWidth: 28 }}>
            <AddOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          </ListItemIcon>
          <ListItemText primary={t('niches.drawer.selector.createNew')} />
        </MenuItem>
      </Menu>
    </>
  );
};
