import { Drawer, IconButton, Stack, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';

// CHANGELOG.md is read by vite.config.ts at build time and injected via
// `define`. Source-of-truth lives at repo root; vite tries both repo-root
// and `frontend-ui/CHANGELOG.md` to support host-fs dev + Docker contexts.
// release-please updates the file on every Release PR merge → next deploy
// ships the latest history. No runtime fetch, no CORS.
const changelogMd = import.meta.env.CHANGELOG || '# Changelog\n\nNo entries yet.\n';

const DRAWER_WIDTH = 480;

const MarkdownRoot = styled(Box)(({ theme }) => ({
  '& h1': { fontSize: '1.5rem', fontWeight: 700, marginTop: theme.spacing(2) },
  '& h2': {
    fontSize: '1.15rem',
    fontWeight: 700,
    marginTop: theme.spacing(2.5),
    marginBottom: theme.spacing(0.75),
    paddingBottom: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.vars.palette.divider}`,
  },
  '& h3': { fontSize: '1rem', fontWeight: 600, marginTop: theme.spacing(1.5) },
  '& p': { fontSize: '0.875rem', lineHeight: 1.55, color: theme.vars.palette.text.secondary },
  '& ul': { paddingLeft: theme.spacing(2.5), marginTop: 4, marginBottom: 8 },
  '& li': { fontSize: '0.875rem', lineHeight: 1.55, color: theme.vars.palette.text.secondary },
  '& code': {
    fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
    fontSize: '0.8em',
    padding: '1px 5px',
    borderRadius: 3,
    backgroundColor: theme.vars.palette.action.hover,
  },
  '& a': {
    color: theme.vars.palette.primary.main,
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  },
}));

interface ChangelogDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ChangelogDrawer = ({ open, onClose }: ChangelogDrawerProps) => {
  const { t } = useTranslation();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: DRAWER_WIDTH, maxWidth: '100vw' } } }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="h6">
          {t('versionBadge.changelogTitle', 'Changelog')}
        </Typography>
        <IconButton onClick={onClose} aria-label={t('common.close', 'Close')} size="small">
          <CloseIcon />
        </IconButton>
      </Stack>

      <MarkdownRoot sx={{ px: 2, py: 1.5, overflowY: 'auto', flex: 1 }}>
        <ReactMarkdown>{changelogMd}</ReactMarkdown>
      </MarkdownRoot>
    </Drawer>
  );
};

export default ChangelogDrawer;
