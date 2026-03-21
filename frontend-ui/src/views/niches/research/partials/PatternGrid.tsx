import { useState, useMemo } from 'react';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import type { PatternItem } from '../types';
import { PatternCard } from './PatternCard';

interface PatternGridProps {
  patterns: PatternItem[];
}

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(2),
}));

const ActiveCount = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: theme.vars.palette.success.main,
}));

export const PatternGrid = ({ patterns }: PatternGridProps) => {
  const { t } = useTranslation();
  const [showInactive, setShowInactive] = useState(false);

  const { active, inactive } = useMemo(() => {
    const a: PatternItem[] = [];
    const i: PatternItem[] = [];
    patterns.forEach((p) => (p.present ? a : i).push(p));
    return { active: a, inactive: i };
  }, [patterns]);

  return (
    <Box>
      <SectionHeader>
        <Typography variant="h5" fontWeight={600}>
          {t('research.patterns.title')}
        </Typography>
        <ActiveCount>
          {t('research.patterns.activeCount', { count: active.length })}
        </ActiveCount>
      </SectionHeader>

      <Grid container spacing={1.5}>
        {active.map((p) => (
          <Grid key={p.name} size={{ xs: 12, sm: 6, lg: 4 }}>
            <PatternCard pattern={p} />
          </Grid>
        ))}
      </Grid>

      {inactive.length > 0 && (
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Button
            variant="text"
            size="small"
            onClick={() => setShowInactive((prev) => !prev)}
            endIcon={showInactive ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}
          >
            {showInactive
              ? t('research.patterns.collapseInactive')
              : t('research.patterns.expandInactive')}
          </Button>

          {showInactive && (
            <Grid container spacing={1.5}>
              {inactive.map((p) => (
                <Grid key={p.name} size={{ xs: 12, sm: 6, lg: 4 }}>
                  <PatternCard pattern={p} />
                </Grid>
              ))}
            </Grid>
          )}
        </Stack>
      )}
    </Box>
  );
};
