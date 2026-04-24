import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import { useListExportHistoryQuery } from '@/store/publishSlice';
import type { ExportLog } from '../../types';
import { formatRelativeTime } from '../../utils/formatRelativeTime';
import ExportPreflightDialog from './ExportPreflightDialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Styled — 480px right-side drawer (design-system width for secondary panels)
// ---------------------------------------------------------------------------

const DRAWER_WIDTH = 480;

const DrawerPaper = styled(Box)(({ theme }) => ({
  width: DRAWER_WIDTH,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.vars.palette.background.default,
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const Body = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(1, 0),
}));

const Row = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.25, 3),
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
    '& .ExportHistoryDrawer-actions': {
      opacity: 1,
    },
  },
}));

const RowActions = styled(Box)({
  opacity: 0,
  transition: 'opacity 120ms ease',
});

const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8, 3),
  color: theme.vars.palette.text.secondary,
  textAlign: 'center',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const templateChipLabel = (log: ExportLog): string => {
  return `${log.template.toUpperCase()} · ${log.format.toUpperCase()}`;
};

const authorInitials = (log: ExportLog): string => {
  const { first_name, last_name } = log.created_by;
  const f = first_name?.charAt(0) ?? '';
  const l = last_name?.charAt(0) ?? '';
  const combined = `${f}${l}`.trim();
  return combined || '?';
};

// ---------------------------------------------------------------------------
// Component (mount-on-open via `open` prop — Drawer itself manages transition)
// ---------------------------------------------------------------------------

const ExportHistoryDrawer = ({ open, onClose }: ExportHistoryDrawerProps) => {
  const { t } = useTranslation();
  const { data, isLoading } = useListExportHistoryQuery(undefined, {
    refetchOnMountOrArgChange: true,
    skip: !open,
  });

  const [rerunLog, setRerunLog] = useState<ExportLog | null>(null);

  const rows = useMemo(() => data?.results ?? [], [data]);

  const handleRerun = useCallback((log: ExportLog) => {
    setRerunLog(log);
  }, []);

  const closeRerun = useCallback(() => setRerunLog(null), []);

  const lang = i18n.language ?? 'en';

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        slotProps={{ paper: { sx: { width: DRAWER_WIDTH } } }}
      >
        <DrawerPaper>
          <Header>
            <Typography variant="h6">
              {t('publish.export.history.title', {
                defaultValue: 'Export History',
              })}
            </Typography>
            <IconButton
              size="small"
              onClick={onClose}
              aria-label={t('common.close', { defaultValue: 'Close' })}
            >
              <CloseOutlinedIcon />
            </IconButton>
          </Header>
          <Body>
            {isLoading ? (
              <EmptyState>
                <Typography variant="body2">
                  {t('common.loading', { defaultValue: 'Loading…' })}
                </Typography>
              </EmptyState>
            ) : rows.length === 0 ? (
              <EmptyState data-testid="ExportHistory-empty">
                <Typography variant="body2">
                  {t('publish.export.history.empty', {
                    defaultValue: 'No exports yet in this workspace',
                  })}
                </Typography>
              </EmptyState>
            ) : (
              rows.map((log, idx) => {
                const timeAgo = formatRelativeTime(log.created_at, lang);
                const rerunLabel = t('publish.export.history.rerunTooltip', {
                  defaultValue: 'Re-run export ({{timeAgo}})',
                  timeAgo,
                });
                const rowTooltip = log.design_ids.slice(0, 20).join(', ');
                return (
                  <Box key={log.id}>
                    {idx > 0 && <Divider />}
                    <Tooltip title={rowTooltip} placement="left">
                      <Row data-testid="ExportHistory-row">
                        <Chip
                          label={templateChipLabel(log)}
                          size="small"
                          variant="outlined"
                        />
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            noWrap
                            title={log.filename}
                          >
                            {log.filename}
                          </Typography>
                          <Stack direction="row" gap={1} alignItems="center">
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {t('publish.export.history.rowBadge', {
                                defaultValue:
                                  '{{designs}} designs · {{rows}} rows',
                                designs: log.design_count,
                                rows: log.row_count,
                              })}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              · {timeAgo}
                            </Typography>
                          </Stack>
                        </Stack>
                        <Avatar
                          src={log.created_by.avatar_url || undefined}
                          sx={{ width: 28, height: 28, fontSize: 12 }}
                        >
                          {authorInitials(log)}
                        </Avatar>
                        <RowActions className="ExportHistoryDrawer-actions">
                          <Tooltip title={rerunLabel}>
                            <IconButton
                              size="small"
                              onClick={() => handleRerun(log)}
                              data-testid="ExportHistory-rerun"
                              aria-label={rerunLabel}
                            >
                              <ReplayOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </RowActions>
                      </Row>
                    </Tooltip>
                  </Box>
                );
              })
            )}
          </Body>
        </DrawerPaper>
      </Drawer>
      {rerunLog && (
        <ExportPreflightDialog
          open
          template={rerunLog.template}
          format={rerunLog.format}
          designIds={rerunLog.design_ids}
          onClose={closeRerun}
        />
      )}
    </>
  );
};

export default ExportHistoryDrawer;
