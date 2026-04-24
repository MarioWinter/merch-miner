import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { LISTING_CHAR_LIMITS, type ListingLanguage } from '../../types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const PreviewBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1.5),
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: Number(theme.shape.borderRadius),
  minHeight: theme.spacing(6),
  maxHeight: theme.spacing(20),
  overflowY: 'auto',
  backgroundColor: theme.vars.palette.background.default,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_CHARS = LISTING_CHAR_LIMITS.keywords_per_language;

interface ParseResult {
  accepted: string[];
  rejectedDuplicate: number;
  rejectedLimit: number;
  totalParsed: number;
}

const parseInput = (raw: string, existing: string[]): ParseResult => {
  const entries = raw
    .split(/[,;\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const totalParsed = entries.length;
  const accepted: string[] = [];
  const lowerSeen = new Set(existing.map((k) => k.toLowerCase()));
  let rejectedDuplicate = 0;
  let rejectedLimit = 0;
  let projected = [...existing];
  for (const entry of entries) {
    const lower = entry.toLowerCase();
    if (lowerSeen.has(lower)) {
      rejectedDuplicate += 1;
      continue;
    }
    const wouldBe = [...projected, entry];
    if (wouldBe.join(', ').length > MAX_CHARS) {
      rejectedLimit += 1;
      continue;
    }
    projected = wouldBe;
    lowerSeen.add(lower);
    accepted.push(entry);
  }
  return { accepted, rejectedDuplicate, rejectedLimit, totalParsed };
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImportKeywordsCsvDialogProps {
  open: boolean;
  activeLang: ListingLanguage;
  existingKeywords: string[];
  isSaving?: boolean;
  onClose: () => void;
  /** Called with the merged keyword list for the active language. */
  onCommit: (merged: string[]) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Component — AC-134 "Import keywords from CSV" + EC-78
// ---------------------------------------------------------------------------

const ImportKeywordsCsvDialog = ({
  open,
  activeLang,
  existingKeywords,
  isSaving = false,
  onClose,
  onCommit,
}: ImportKeywordsCsvDialogProps) => {
  const { t } = useTranslation();
  const [raw, setRaw] = useState('');

  useEffect(() => {
    if (open) setRaw('');
  }, [open]);

  // Mount-on-open.
  if (!open) return null;

  const result = useMemo(
    () => parseInput(raw, existingKeywords),
    [raw, existingKeywords],
  );

  const handleImport = async () => {
    if (result.accepted.length === 0) return;
    await onCommit([...existingKeywords, ...result.accepted]);
  };

  const summary =
    result.totalParsed > 0
      ? t('publish.edit.global.import.summary', {
          defaultValue:
            '{{accepted}} of {{total}} keywords will be imported — {{skipped}} skipped',
          accepted: result.accepted.length,
          total: result.totalParsed,
          skipped:
            result.rejectedDuplicate + result.rejectedLimit,
        })
      : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="import-keywords-title"
    >
      <DialogTitle id="import-keywords-title">
        {t('publish.edit.global.import.title', {
          defaultValue: 'Import keywords from CSV ({{lang}})',
          lang: activeLang.toUpperCase(),
        })}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t('publish.edit.global.import.hint', {
              defaultValue:
                'Paste keywords separated by commas, semicolons, or newlines. Duplicates and entries that overflow the 50-character limit are skipped.',
            })}
          </Typography>
          <TextField
            multiline
            minRows={4}
            fullWidth
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            inputProps={{ 'data-testid': 'ImportKeywords-textarea' }}
            placeholder={t('publish.edit.global.import.placeholder', {
              defaultValue: 'dog, cat, bird\nfunny, cute',
            })}
            disabled={isSaving}
          />
          {summary ? (
            <Alert
              severity={result.accepted.length === 0 ? 'warning' : 'info'}
              data-testid="ImportKeywords-summary"
            >
              {summary}
            </Alert>
          ) : null}
          {result.accepted.length > 0 ? (
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('publish.edit.global.import.preview', {
                  defaultValue: 'Preview',
                })}
              </Typography>
              <PreviewBox data-testid="ImportKeywords-preview">
                {result.accepted.map((kw, i) => (
                  <Chip key={`${kw}-${i}`} label={kw} size="small" />
                ))}
              </PreviewBox>
            </Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={isSaving}>
          {t('publish.edit.global.import.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleImport}
          disabled={isSaving || result.accepted.length === 0}
          startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
          data-testid="ImportKeywords-import"
        >
          {t('publish.edit.global.import.import', {
            defaultValue: 'Import',
          })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportKeywordsCsvDialog;
