import { useCallback, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Stack,
  Tooltip,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import tinycolor from 'tinycolor2';
import { COLORS, DURATION, EASING } from '@/style/constants';
import { useGetMbaColorsQuery } from '@/store/publishSlice';
import type { MbaColor } from '../../types';
import SectionHeader from './SectionHeader';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const GridWrap = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.25),
  paddingBlock: theme.spacing(0.5),
}));

const Swatch = styled('button', {
  shouldForwardProp: (prop) => prop !== 'selected' && prop !== 'hex',
})<{ selected: boolean; hex: string }>(({ selected, hex }) => ({
  position: 'relative',
  width: 36,
  height: 36,
  borderRadius: '9999px',
  backgroundColor: hex,
  border: selected
    ? `2px solid ${COLORS.cyan}`
    : `1px solid ${alpha(COLORS.white, 0.18)}`,
  padding: 0,
  cursor: 'pointer',
  transform: selected ? 'scale(1.1)' : 'scale(1)',
  boxShadow: selected ? `0 0 0 4px ${alpha(COLORS.cyan, 0.3)}` : 'none',
  transition: `transform ${DURATION.fast}ms ${EASING.standard}, box-shadow ${DURATION.fast}ms ${EASING.standard}, border-color ${DURATION.fast}ms ${EASING.standard}`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': {
    transform: selected ? 'scale(1.12)' : 'scale(1.05)',
  },
  '&:focus-visible': {
    outline: `2px solid ${alpha(COLORS.cyan, 0.8)}`,
    outlineOffset: 3,
  },
}));

const SkeletonGrid = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.25),
  paddingBlock: theme.spacing(0.5),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isDarkColor = (hex: string): boolean => {
  const color = tinycolor(hex);
  if (!color.isValid()) return true;
  return color.getBrightness() < 128;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ColorGridProps {
  selected: string[];
  onChange: (keys: string[]) => void;
  onOptionsClick: (context: string) => void;
}

const ColorGrid = ({ selected, onChange, onOptionsClick }: ColorGridProps) => {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useGetMbaColorsQuery();

  const colors: MbaColor[] = useMemo(() => data ?? [], [data]);

  const toggle = useCallback(
    (key: string) => {
      if (selected.includes(key)) {
        onChange(selected.filter((k) => k !== key));
      } else {
        onChange([...selected, key]);
      }
    },
    [selected, onChange],
  );

  return (
    <Stack component="section" gap={0.5}>
      <SectionHeader
        title={t('publish.edit.colors.title')}
        count={selected.length}
        context="colors"
        onOptionsClick={onOptionsClick}
      />

      {isLoading && (
        <SkeletonGrid aria-busy="true" aria-live="polite">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="circular"
              width={36}
              height={36}
              animation="wave"
            />
          ))}
        </SkeletonGrid>
      )}

      {isError && !isLoading && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                void refetch();
              }}
            >
              {t('publish.edit.colors.retry')}
            </Button>
          }
        >
          {t('publish.edit.colors.loadError')}
        </Alert>
      )}

      {!isLoading && !isError && colors.length > 0 && (
        <GridWrap role="group" aria-label={t('publish.edit.colors.title')}>
          {colors.map((c) => {
            const isSelected = selected.includes(c.key);
            const checkColor = isDarkColor(c.hex) ? COLORS.white : COLORS.ink;
            return (
              <Tooltip key={c.key} title={c.name} arrow placement="top">
                <Swatch
                  type="button"
                  selected={isSelected}
                  hex={c.hex}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={t('publish.edit.colors.swatch', { name: c.name })}
                  onClick={() => toggle(c.key)}
                >
                  {isSelected && (
                    <CheckIcon sx={{ fontSize: 20, color: checkColor }} />
                  )}
                </Swatch>
              </Tooltip>
            );
          })}
        </GridWrap>
      )}
    </Stack>
  );
};

export default ColorGrid;
