import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useExport } from '../../hooks/useExport';
import { mapExportError } from '../../utils/mapExportError';
import type {
  FlyingUploadExportBody,
  FlyingUploadFormat,
  FlyingUploadPreviewResponse,
  FlyingUploadPreviewSkipped,
  FlyingUploadTemplate,
} from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportPreflightDialogProps {
  open: boolean;
  template: FlyingUploadTemplate;
  format: FlyingUploadFormat;
  designIds: string[];
  /** When the single skipped design equals this id, hide its "Edit 1" button
   *  (EC-81 — avoids navigating to the view you're already on). */
  currentDesignId?: string | null;
  onClose: () => void;
}

// Reasons whose skipped row gets an "Edit N" quick-fix button. For any other
// reason (image_unavailable, catalog_unknown_product, etc.) the user can't
// fix the row from the listing editor so we just show the reason text.
const EDIT_ELIGIBLE_REASONS = new Set(['no_listing', 'no_global_listing']);

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const SkippedList = styled(List)(({ theme }) => ({
  maxHeight: theme.spacing(32),
  overflowY: 'auto',
  padding: 0,
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: theme.vars.palette.background.default,
}));

const SkippedRow = styled(ListItem)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.75, 1.5),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  '&:last-of-type': {
    borderBottom: 'none',
  },
}));

const ProgressRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5, 0),
}));

// ---------------------------------------------------------------------------
// Component (mount-on-open pattern)
// ---------------------------------------------------------------------------

const ExportPreflightDialog = ({
  open,
  template,
  format,
  designIds,
  currentDesignId,
  onClose,
}: ExportPreflightDialogProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { preflight, download, isPreflighting, isDownloading } = useExport();
  const [summary, setSummary] = useState<FlyingUploadPreviewResponse | null>(null);

  const body: FlyingUploadExportBody = useMemo(
    () => ({ template, format, design_ids: designIds }),
    [template, format, designIds],
  );

  // Run preflight once on open.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const result = await preflight(body);
      if (!cancelled) setSummary(result);
    };
    void run();
    return () => {
      cancelled = true;
    };
    // We intentionally skip `preflight` — it's a new identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body.template, body.format, body.design_ids?.join(',')]);

  const readyRows = summary?.ready_rows ?? 0;
  const skipped = summary?.skipped ?? [];
  const warnings = summary?.warnings ?? [];
  const downloadDisabled = readyRows === 0 || isPreflighting || isDownloading;

  const groupedSkipped = useMemo(() => {
    const byReason = new Map<string, FlyingUploadPreviewSkipped[]>();
    for (const row of skipped) {
      const list = byReason.get(row.reason) ?? [];
      list.push(row);
      byReason.set(row.reason, list);
    }
    return Array.from(byReason.entries());
  }, [skipped]);

  const handleDownload = useCallback(async () => {
    const ok = await download(body);
    if (ok) onClose();
  }, [body, download, onClose]);

  const handleEditReason = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      navigate(`/publish/edit?designs=${ids.join(',')}`);
      onClose();
    },
    [navigate, onClose],
  );

  const templateChipLabel = `${template.toUpperCase()} · ${format.toUpperCase()}`;

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="export-preflight-title"
    >
      <DialogTitle id="export-preflight-title">
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="h6" component="span">
            {t('publish.export.preflight.title', {
              defaultValue: 'Ready to export',
            })}
          </Typography>
          <Chip label={templateChipLabel} size="small" />
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {isPreflighting ? (
          <ProgressRow>
            <LinearProgress />
            <Typography variant="body2" color="text.secondary">
              {t('publish.export.preflight.loading', {
                defaultValue: 'Running preflight…',
              })}
            </Typography>
          </ProgressRow>
        ) : (
          <Stack gap={2}>
            <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
              <Typography variant="body2">
                {t('publish.export.preflight.readyRows', {
                  defaultValue: '{{count}} ready',
                  count: readyRows,
                })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('publish.export.preflight.totalDesigns', {
                  defaultValue: '{{count}} total',
                  count: summary?.total_designs ?? designIds.length,
                })}
              </Typography>
              {skipped.length > 0 && (
                <Typography variant="body2" color="warning.main">
                  {t('publish.export.preflight.skippedCount', {
                    defaultValue: '{{count}} skipped',
                    count: skipped.length,
                  })}
                </Typography>
              )}
            </Stack>

            {warnings.length > 0 && (
              <Alert severity="warning" variant="outlined">
                <Typography variant="subtitle2">
                  {t('publish.export.preflight.warningsLabel', {
                    defaultValue: 'Warnings',
                  })}
                </Typography>
                <List sx={{ p: 0, m: 0 }}>
                  {warnings.map((w, idx) => (
                    <ListItem key={`${w.code}-${idx}`} sx={{ p: 0 }}>
                      <Typography variant="caption">
                        {t(mapExportError(w.code), {
                          defaultValue: w.code,
                        })}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}

            {groupedSkipped.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('publish.export.preflight.skippedLabel', {
                    defaultValue: 'Skipped designs',
                  })}
                </Typography>
                <SkippedList data-testid="ExportPreflight-skipped">
                  {groupedSkipped.map(([reason, rows]) => {
                    const ids = rows.map((r) => r.design_id);
                    const showEdit =
                      EDIT_ELIGIBLE_REASONS.has(reason) &&
                      !(
                        ids.length === 1 &&
                        currentDesignId &&
                        ids[0] === currentDesignId
                      );
                    return (
                      <SkippedRow key={reason}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {t(mapExportError(reason), { defaultValue: reason })}
                          {' '}
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                          >
                            ({ids.length})
                          </Typography>
                        </Typography>
                        {showEdit && (
                          <Button
                            size="small"
                            variant="text"
                            data-testid={`ExportPreflight-edit-${reason}`}
                            onClick={() => handleEditReason(ids)}
                          >
                            {t('publish.export.preflight.editN', {
                              defaultValue: 'Edit {{count}}',
                              count: ids.length,
                            })}
                          </Button>
                        )}
                      </SkippedRow>
                    );
                  })}
                </SkippedList>
              </Box>
            )}

            {isDownloading && (
              <ProgressRow data-testid="ExportPreflight-downloading">
                <LinearProgress />
                <Typography variant="body2" color="text.secondary">
                  {t('publish.export.preflight.preparing', {
                    defaultValue: 'Preparing archive — {{count}} design(s)',
                    count: readyRows,
                  })}
                </Typography>
              </ProgressRow>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isDownloading}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Tooltip
          title={
            readyRows === 0
              ? t('publish.export.preflight.downloadDisabledTooltip', {
                  defaultValue:
                    'No exportable rows — every selected design is missing a listing or has no enabled products',
                })
              : ''
          }
        >
          <span>
            <Button
              variant="contained"
              color="primary"
              onClick={handleDownload}
              disabled={downloadDisabled}
              data-testid="ExportPreflight-download"
            >
              {t('publish.export.preflight.download', {
                defaultValue: 'Download',
              })}
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};

export default ExportPreflightDialog;
