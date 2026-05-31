import { useState, useMemo } from 'react';
import { Box, Chip, Popover, Stack, Typography, Link as MuiLink } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import ChangelogDrawer from './ChangelogDrawer';
import { useIsSuperuser } from '@/hooks/useIsSuperuser';

const APP_VERSION = import.meta.env.APP_VERSION || '0.0.0';
const BUILD_DATE = import.meta.env.BUILD_DATE || '';

const Trigger = styled('button')(({ theme }) => ({
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: theme.spacing(0.5, 1),
  margin: theme.spacing(0, 1),
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: theme.vars.palette.text.disabled,
  fontSize: '0.7rem',
  fontFamily: 'inherit',
  transition: 'background-color 120ms ease, color 120ms ease',
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
    color: theme.vars.palette.text.secondary,
  },
}));

const StaticPill = styled('div')(({ theme }) => ({
  padding: theme.spacing(0.5, 1),
  margin: theme.spacing(0, 1),
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: theme.vars.palette.text.disabled,
  fontSize: '0.7rem',
  fontFamily: 'inherit',
  cursor: 'default',
}));

const isBeta = (version: string) => {
  const major = Number.parseInt(version.split('.')[0] ?? '0', 10);
  return Number.isFinite(major) && major < 1;
};

const formatBuildDate = (iso: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
};

interface VersionBadgeProps {
  collapsed: boolean;
}

const VersionBadge = ({ collapsed }: VersionBadgeProps) => {
  const { t } = useTranslation();
  const isSuperuser = useIsSuperuser();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const beta = useMemo(() => isBeta(APP_VERSION), []);
  const buildLabel = useMemo(() => formatBuildDate(BUILD_DATE), []);

  const handleOpenChangelog = () => {
    setAnchor(null);
    setDrawerOpen(true);
  };

  // Non-superuser: render a non-interactive pill — no onClick, no hover,
  // no Popover, no Changelog Dialog mounted. Aria-label describes the
  // app version only (no "open changelog" affordance).
  if (!isSuperuser) {
    const ariaLabel = t('versionBadge.appVersionAria', 'App version v{{version}}{{beta}}', {
      version: APP_VERSION,
      beta: beta ? ' Beta' : '',
    });
    return (
      <StaticPill role="status" aria-label={ariaLabel}>
        <span>v{APP_VERSION}</span>
        {beta && !collapsed && (
          <Chip
            label="Beta"
            size="small"
            sx={{
              height: 16,
              fontSize: '0.6rem',
              fontWeight: 600,
              '& .MuiChip-label': { px: 0.75 },
            }}
            color="primary"
            variant="outlined"
          />
        )}
      </StaticPill>
    );
  }

  // Collapsed sidebar: render only the version number, no Beta pill (no room).
  return (
    <>
      <Trigger
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={t('versionBadge.openInfo', 'Open version info')}
      >
        <span>v{APP_VERSION}</span>
        {beta && !collapsed && (
          <Chip
            label="Beta"
            size="small"
            sx={{
              height: 16,
              fontSize: '0.6rem',
              fontWeight: 600,
              '& .MuiChip-label': { px: 0.75 },
            }}
            color="primary"
            variant="outlined"
          />
        )}
      </Trigger>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ px: 2, py: 1.5, minWidth: 180 }}>
          <Stack spacing={0.5}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                v{APP_VERSION}
              </Typography>
              {beta && (
                <Chip
                  label="Beta"
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                />
              )}
            </Stack>
            {buildLabel && (
              <Typography variant="caption" color="text.secondary">
                {buildLabel}
              </Typography>
            )}
            <MuiLink
              component="button"
              onClick={handleOpenChangelog}
              underline="hover"
              variant="caption"
              sx={{ alignSelf: 'flex-start', mt: 0.5 }}
            >
              {t('versionBadge.changelog', 'Changelog')} →
            </MuiLink>
          </Stack>
        </Box>
      </Popover>

      <ChangelogDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
};

export default VersionBadge;
