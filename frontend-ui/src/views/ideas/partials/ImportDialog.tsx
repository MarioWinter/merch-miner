import { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import Papa from 'papaparse';
import { useImportIdeasMutation } from '@/store/ideaSlice';
import { COLORS } from '@/style/constants';
import type { ImportIdeaItem } from '../types';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const MAX_ITEMS = 500;
const PREVIEW_ROWS = 10;

const DropZone = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isDragOver',
})<{ isDragOver?: boolean }>(({ theme, isDragOver }) => ({
  border: `2px dashed ${isDragOver ? theme.vars.palette.primary.main : theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(4),
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 200ms ease, background-color 200ms ease',
  backgroundColor: isDragOver
    ? alpha(COLORS.red, 0.04)
    : 'transparent',
  '&:hover': {
    borderColor: theme.vars.palette.primary.main,
    backgroundColor: alpha(COLORS.red, 0.02),
  },
}));

const parseCSV = (file: File): Promise<ImportIdeaItem[]> =>
  new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const items: ImportIdeaItem[] = [];
        for (const row of results.data as Record<string, string>[]) {
          const sloganText = row.slogan_text || row.slogan || row.text || '';
          if (sloganText.trim()) {
            items.push({
              slogan_text: sloganText.trim(),
              ...(row.niche_name || row.niche
                ? { niche_name: (row.niche_name || row.niche || '').trim() }
                : {}),
            });
          }
        }
        resolve(items);
      },
      error: (err) => reject(err),
    });
  });

const parseXLSX = async (file: File): Promise<ImportIdeaItem[]> => {
  // read-excel-file (no known CVEs) — replaced sheetjs/xlsx@0.18.5 which has
  // unfixable HIGH-severity prototype-pollution + ReDoS advisories.
  // `readSheet` returns the raw 2D row array of the first sheet, which is what
  // we want here (the default `readXlsxFile` returns Sheet[] with metadata).
  const { readSheet } = await import('read-excel-file/browser');
  const rows = await readSheet(file);
  if (rows.length === 0) return [];

  // First row is header. Map to lowercase keys for case-insensitive lookup.
  const header = rows[0].map((cell) => String(cell ?? '').trim().toLowerCase());
  const items: ImportIdeaItem[] = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const get = (...keys: string[]): string => {
      for (const k of keys) {
        const idx = header.indexOf(k);
        if (idx !== -1) {
          const v = row[idx];
          if (v != null) return String(v);
        }
      }
      return '';
    };
    const sloganText = get('slogan_text', 'slogan', 'text');
    if (sloganText.trim()) {
      const nicheName = get('niche_name', 'niche');
      items.push({
        slogan_text: sloganText.trim(),
        ...(nicheName ? { niche_name: nicheName.trim() } : {}),
      });
    }
  }
  return items;
};

export const ImportDialog = ({ open, onClose }: ImportDialogProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<ImportIdeaItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importIdeas, { isLoading }] = useImportIdeasMutation();

  const handleFile = useCallback(async (file: File) => {
    setParseError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let parsed: ImportIdeaItem[];
      if (ext === 'xlsx' || ext === 'xls') {
        parsed = await parseXLSX(file);
      } else {
        parsed = await parseCSV(file);
      }

      if (parsed.length === 0) {
        setParseError(t('ideas.import.noData'));
        return;
      }
      if (parsed.length > MAX_ITEMS) {
        setParseError(t('ideas.import.tooMany', { max: MAX_ITEMS }));
        parsed = parsed.slice(0, MAX_ITEMS);
      }
      setItems(parsed);
    } catch {
      setParseError(t('ideas.import.parseError'));
    }
  }, [t]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleConfirm = async () => {
    try {
      const result = await importIdeas({ ideas: items }).unwrap();
      enqueueSnackbar(
        t('ideas.import.success', { count: result.created }),
        { variant: 'success' },
      );
      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          enqueueSnackbar(warning, { variant: 'warning' });
        }
      }
      handleReset();
      onClose();
    } catch {
      enqueueSnackbar(t('ideas.notifications.createError'), { variant: 'error' });
    }
  };

  const handleReset = () => {
    setItems([]);
    setParseError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const previewItems = items.slice(0, PREVIEW_ROWS);
  const remaining = items.length - PREVIEW_ROWS;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('ideas.import.title')}</DialogTitle>
      <DialogContent>
        {items.length === 0 ? (
          <Stack spacing={2}>
            <DropZone
              isDragOver={isDragOver}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('import-file-input')?.click()}
            >
              <CloudUploadIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                {t('ideas.import.dropHint')}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                .csv, .xlsx
              </Typography>
              <input
                id="import-file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </DropZone>
            {parseError && (
              <Alert severity="error">{parseError}</Alert>
            )}
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t('ideas.import.preview')} ({items.length})
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>slogan_text</TableCell>
                    <TableCell>niche</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewItems.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                          {item.slogan_text}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {item.niche_name || '-'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {remaining > 0 && (
              <Typography variant="caption" color="text.secondary" textAlign="center">
                ...{t('ideas.import.andMore', { count: remaining })}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          {t('ideas.adapt.cancel')}
        </Button>
        {items.length > 0 && (
          <>
            <Button onClick={handleReset} disabled={isLoading}>
              {t('ideas.import.reset')}
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleConfirm()}
              disabled={isLoading}
              startIcon={
                isLoading ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <UploadFileIcon sx={{ fontSize: 18 }} />
                )
              }
            >
              {t('ideas.import.confirm')} ({items.length})
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
