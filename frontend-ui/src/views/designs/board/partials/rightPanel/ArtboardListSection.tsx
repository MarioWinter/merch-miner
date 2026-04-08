import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { ArtboardData } from '../../types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SectionRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
}));

const ArtboardCardRoot = styled(Box, {
  shouldForwardProp: (p) => p !== '$isActive',
})<{ $isActive?: boolean }>(({ theme, $isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.75),
  borderRadius: 6,
  cursor: 'pointer',
  border: `1px solid ${$isActive ? theme.vars.palette.primary.main : 'transparent'}`,
  backgroundColor: $isActive ? alpha(COLORS.red, 0.06) : 'transparent',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(COLORS.red, 0.04),
  },
}));

const ThumbBox = styled(Box)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: 4,
  overflow: 'hidden',
  flexShrink: 0,
  backgroundColor: theme.vars.palette.action.hover,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ArtboardListSectionProps {
  artboards: ArtboardData[];
  selectedIds: Set<string>;
  onSelectArtboard: (id: string) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ArtboardListSection = ({
  artboards,
  selectedIds,
  onSelectArtboard,
}: ArtboardListSectionProps) => {
  const { t } = useTranslation();

  if (artboards.length === 0) {
    return (
      <SectionRoot>
        <Typography variant="caption" color="text.disabled">
          {t('design.artboards.empty', 'No artboards')}
        </Typography>
      </SectionRoot>
    );
  }

  return (
    <SectionRoot>
      <Stack spacing={0.5}>
        {artboards.map((ab) => (
          <ArtboardCardRoot
            key={ab.id}
            $isActive={selectedIds.has(ab.id)}
            onClick={() => onSelectArtboard(ab.id)}
            role="button"
            tabIndex={0}
            aria-label={ab.label}
          >
            <ThumbBox>
              {ab.imageUrl ? (
                <img src={ab.imageUrl} alt={ab.label} />
              ) : (
                <Typography variant="caption" color="text.disabled">
                  --
                </Typography>
              )}
            </ThumbBox>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" noWrap sx={{ fontWeight: 500, display: 'block' }}>
                {ab.label}
              </Typography>
              {ab.promptUsed && (
                <Tooltip title={ab.promptUsed} placement="left">
                  <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block', fontSize: '0.6rem' }}>
                    {t('design.artboards.prompt', 'Prompt')}: {ab.promptUsed}
                  </Typography>
                </Tooltip>
              )}
            </Box>
          </ArtboardCardRoot>
        ))}
      </Stack>
    </SectionRoot>
  );
};

export default ArtboardListSection;
