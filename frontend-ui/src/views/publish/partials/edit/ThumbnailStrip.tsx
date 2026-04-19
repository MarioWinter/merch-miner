import { useMemo, useState } from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { DesignAsset } from '../../types';
import DesignTagsInput from './DesignTagsInput';
import ThumbnailItem from './ThumbnailItem';

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

  // Local tag state — persistence is out of scope for D1/D2 (wires up in later phase)
  const [tags, setTags] = useState<string[]>([]);

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

  const handleLoadClick = () => {
    // TODO: wire to preset/template load in D3+
    console.log('[ThumbnailStrip] Load clicked — not yet implemented');
  };

  const handleClearClick = () => {
    // TODO: wire to reset form in D3+
    console.log('[ThumbnailStrip] Clear clicked — not yet implemented');
  };

  return (
    <StripRoot>
      <DesignTagsInput tags={tags} onChange={setTags} max={3} />

      <ActionRow>
        <Button
          size="small"
          variant="contained"
          onClick={handleLoadClick}
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
          onClick={handleClearClick}
          sx={{
            color: COLORS.errorDk,
            borderColor: COLORS.errorDk,
            '&:hover': { borderColor: COLORS.errorDkShade, color: COLORS.errorDkShade },
          }}
        >
          {t('publish.edit.thumbnails.clear')}
        </Button>
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
