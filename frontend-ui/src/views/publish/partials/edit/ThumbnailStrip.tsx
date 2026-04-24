import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { DesignAsset } from '../../types';
import DesignTagsInput from './DesignTagsInput';
import ThumbnailItem from './ThumbnailItem';

// ---------------------------------------------------------------------------
// Tag preset persistence — localStorage-backed, per-user scoping is the
// axiosBaseQuery's job (cookies). Keeping presets client-local until a
// backend CRUD endpoint is requested.
// ---------------------------------------------------------------------------

const PRESET_STORAGE_KEY = 'mm.publish.designTagPresets';
const MAX_PRESETS = 10;

const readPresets = (): string[][] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is string[] =>
          Array.isArray(p) && p.every((x) => typeof x === 'string'),
      )
      .slice(0, MAX_PRESETS);
  } catch {
    return [];
  }
};

const writePresets = (presets: string[][]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify(presets.slice(0, MAX_PRESETS)),
    );
  } catch {
    /* storage quota / SSR — safe to ignore */
  }
};

interface ThumbnailStripProps {
  designIds: string[];
  designs: DesignAsset[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  isLoading?: boolean;
}

const StripRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  height: '100%',
  minHeight: 0,
  backgroundColor: theme.vars.palette.background.paper,
  borderRight: `1px solid ${theme.vars.palette.divider}`,
  [theme.breakpoints.down('md')]: {
    borderRight: 'none',
    borderBottom: `1px solid ${theme.vars.palette.divider}`,
    padding: theme.spacing(1.5),
  },
}));

const ActionRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  '& > *': {
    flex: 1,
    height: 28,
  },
}));

const CounterRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(0.5),
}));

const ThumbList = styled(Stack)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  alignItems: 'center',
  gap: theme.spacing(1),
  paddingRight: theme.spacing(0.5),
  [theme.breakpoints.down('md')]: {
    flexDirection: 'row',
    overflowY: 'visible',
    overflowX: 'auto',
    paddingBottom: theme.spacing(1),
  },
}));

const ThumbnailStrip = ({
  designIds,
  designs,
  activeIndex,
  onActiveIndexChange,
  isLoading = false,
}: ThumbnailStripProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Local tag state — persistence is out of scope for D1/D2 (wires up in later phase)
  const [tags, setTags] = useState<string[]>([]);

  // Round-5: tag presets from localStorage. Load menu lists every saved
  // preset; "Save current" appends the current tags[] (no duplicate +
  // bounded at MAX_PRESETS).
  const [presets, setPresets] = useState<string[][]>(() => readPresets());
  const [loadAnchor, setLoadAnchor] = useState<null | HTMLElement>(null);

  const total = designIds.length;

  // Map ids to DesignAsset objects (may be undefined while loading / partial)
  const designById = useMemo(() => {
    const map = new Map<string, DesignAsset>();
    for (const d of designs) map.set(d.id, d);
    return map;
  }, [designs]);

  const goPrevious = () => {
    if (total === 0) return;
    onActiveIndexChange((activeIndex - 1 + total) % total);
  };

  const goNext = () => {
    if (total === 0) return;
    onActiveIndexChange((activeIndex + 1) % total);
  };

  const handleLoadOpen = (e: React.MouseEvent<HTMLElement>) => {
    setLoadAnchor(e.currentTarget);
  };

  const handleLoadClose = () => setLoadAnchor(null);

  const handleLoadPreset = (preset: string[]) => {
    setTags(preset);
    handleLoadClose();
    enqueueSnackbar(
      t('publish.edit.thumbnails.presetLoaded', {
        defaultValue: 'Preset loaded',
      }),
      { variant: 'success' },
    );
  };

  const handleSaveCurrentPreset = () => {
    handleLoadClose();
    if (tags.length === 0) {
      enqueueSnackbar(
        t('publish.edit.thumbnails.presetEmpty', {
          defaultValue: 'Add tags before saving a preset',
        }),
        { variant: 'warning' },
      );
      return;
    }
    const key = tags.join('|');
    if (presets.some((p) => p.join('|') === key)) {
      enqueueSnackbar(
        t('publish.edit.thumbnails.presetDuplicate', {
          defaultValue: 'Preset already saved',
        }),
        { variant: 'info' },
      );
      return;
    }
    const next = [tags.slice(), ...presets].slice(0, MAX_PRESETS);
    setPresets(next);
    writePresets(next);
    enqueueSnackbar(
      t('publish.edit.thumbnails.presetSaved', {
        defaultValue: 'Preset saved',
      }),
      { variant: 'success' },
    );
  };

  const handleDeletePreset = (idx: number) => {
    const next = presets.filter((_, i) => i !== idx);
    setPresets(next);
    writePresets(next);
  };

  const handleClearClick = () => {
    setTags([]);
  };

  return (
    <StripRoot>
      <DesignTagsInput tags={tags} onChange={setTags} max={3} />

      <ActionRow>
        <Button
          size="small"
          variant="contained"
          onClick={handleLoadOpen}
          aria-haspopup="menu"
          aria-label={t('publish.edit.thumbnails.load', { defaultValue: 'Load' })}
          sx={{
            backgroundColor: COLORS.cyan,
            color: COLORS.ink,
            '&:hover': { backgroundColor: COLORS.cyanDk },
          }}
        >
          {t('publish.edit.thumbnails.load')}
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={tags.length === 0}
          onClick={handleClearClick}
          sx={{
            color: COLORS.errorDk,
            borderColor: COLORS.errorDk,
            '&:hover': { borderColor: COLORS.errorDkShade, color: COLORS.errorDkShade },
          }}
        >
          {t('publish.edit.thumbnails.clear')}
        </Button>
        <Menu
          anchorEl={loadAnchor}
          open={Boolean(loadAnchor)}
          onClose={handleLoadClose}
          slotProps={{ paper: { sx: { minWidth: 220 } } }}
        >
          <MenuItem onClick={handleSaveCurrentPreset}>
            {t('publish.edit.thumbnails.saveCurrent', {
              defaultValue: 'Save current as preset',
            })}
          </MenuItem>
          {presets.length === 0 && (
            <MenuItem disabled>
              {t('publish.edit.thumbnails.noPresets', {
                defaultValue: 'No saved presets yet',
              })}
            </MenuItem>
          )}
          {presets.map((preset, idx) => (
            <MenuItem
              key={`${preset.join('|')}:${idx}`}
              onClick={() => handleLoadPreset(preset)}
              sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
            >
              <span>{preset.join(', ')}</span>
              <IconButton
                size="small"
                edge="end"
                aria-label={t('publish.edit.thumbnails.deletePreset', {
                  defaultValue: 'Delete preset',
                })}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePreset(idx);
                }}
                sx={{ color: COLORS.errorDk, opacity: 0.7 }}
              >
                <ChevronLeftIcon sx={{ transform: 'rotate(45deg)', fontSize: 16 }} />
              </IconButton>
            </MenuItem>
          ))}
        </Menu>
      </ActionRow>

      <CounterRow>
        <IconButton
          size="small"
          onClick={goPrevious}
          disabled={total <= 1}
          aria-label={t('publish.edit.thumbnails.previous')}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Typography variant="caption" color="text.secondary">
          {t('publish.edit.thumbnails.counter', {
            current: total === 0 ? 0 : activeIndex + 1,
            total,
          })}
        </Typography>
        <IconButton
          size="small"
          onClick={goNext}
          disabled={total <= 1}
          aria-label={t('publish.edit.thumbnails.next')}
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </CounterRow>

      <ThumbList>
        {designIds.map((id, idx) => (
          <ThumbnailItem
            key={id}
            design={designById.get(id)}
            index={idx}
            isActive={idx === activeIndex}
            onClick={() => onActiveIndexChange(idx)}
          />
        ))}
        {isLoading && designIds.length === 0 ? (
          <Typography variant="caption" color="text.disabled">
            ...
          </Typography>
        ) : null}
      </ThumbList>
    </StripRoot>
  );
};

export default ThumbnailStrip;
