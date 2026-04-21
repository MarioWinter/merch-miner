import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Skeleton,
  Alert,
  Stack,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import { useTranslation } from 'react-i18next';
import { useTmCheckMutation } from '@/store/publishSlice';
import { COLORS } from '@/style/constants';
import type { TMCheckResult } from '../../types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const GlassTitle = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: alpha(COLORS.warningDk, 0.06),
}));

const TitleGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const CleanState = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(4, 2),
  textAlign: 'center',
  color: theme.vars.palette.text.primary,
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TMCheckDialogProps {
  open: boolean;
  onClose: () => void;
  listingId?: string;
  onProceed?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TMCheckDialog = ({
  open,
  onClose,
  listingId,
  onProceed,
}: TMCheckDialogProps) => {
  const { t } = useTranslation();
  const [tmCheck, { isLoading }] = useTmCheckMutation();
  const [result, setResult] = useState<TMCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trigger TM check on mount
  useEffect(() => {
    if (!open || !listingId) return;
    let cancelled = false;
    (async () => {
      setResult(null);
      setError(null);
      try {
        const res = await tmCheck(listingId).unwrap();
        if (!cancelled) setResult(res);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t('publish.edit.trademarks.error', {
                  defaultValue: 'Failed to run trademark check',
                }),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, listingId, tmCheck, t]);

  const hasFlags = Boolean(result && !result.is_clean);
  const titleText = hasFlags
    ? t('publish.edit.trademarks.flaggedTitle', {
        defaultValue: 'Trademark issues found',
      })
    : result?.is_clean
      ? t('publish.edit.trademarks.cleanTitle', {
          defaultValue: 'Trademark check passed',
        })
      : t('publish.edit.trademarks.checkingTitle', {
          defaultValue: 'Running trademark check',
        });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 2}px`,
          },
        },
      }}
    >
      <GlassTitle>
        <TitleGroup>
          <GppMaybeOutlinedIcon
            sx={{ color: COLORS.warningDk, fontSize: 22 }}
            aria-hidden
          />
          <Typography variant="h5" component="span">
            {titleText}
          </Typography>
        </TitleGroup>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label={t('publish.edit.trademarks.close', { defaultValue: 'Close' })}
        >
          <CloseIcon />
        </IconButton>
      </GlassTitle>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!listingId && !error && (
          <Alert severity="info" sx={{ mb: 1 }}>
            {t('publish.edit.trademarks.noListing', {
              defaultValue: 'Save the listing first to run a trademark check.',
            })}
          </Alert>
        )}

        {isLoading && !result && !error && (
          <List dense>
            {[0, 1, 2, 3].map((i) => (
              <ListItem key={i} disablePadding sx={{ py: 1 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Skeleton variant="circular" width={20} height={20} />
                </ListItemIcon>
                <ListItemText
                  primary={<Skeleton variant="text" width="60%" />}
                  secondary={<Skeleton variant="text" width="30%" />}
                />
              </ListItem>
            ))}
          </List>
        )}

        {result?.is_clean && (
          <CleanState>
            <CheckCircleOutlineIcon
              sx={{ fontSize: 48, color: COLORS.successDk }}
              aria-hidden
            />
            <Typography variant="subtitle1">
              {t('publish.edit.trademarks.cleanTitle', {
                defaultValue: 'Trademark check passed',
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('publish.edit.trademarks.cleanBody', {
                defaultValue: 'All clear — no trademark issues detected.',
              })}
            </Typography>
          </CleanState>
        )}

        {hasFlags && result && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('publish.edit.trademarks.flaggedBody', {
                defaultValue:
                  'The following terms may be trademarked. Review before publishing.',
              })}
            </Typography>
            <List dense>
              {result.flagged_terms.map((flagged, i) => (
                <ListItem
                  key={`${flagged.field}-${flagged.position}-${i}`}
                  sx={{ py: 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <WarningAmberIcon
                      sx={{ color: COLORS.errorDk, fontSize: 20 }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={flagged.term}
                    secondary={
                      <Chip
                        label={flagged.field.replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.5 }}
                      />
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          {hasFlags
            ? t('publish.edit.trademarks.edit', { defaultValue: 'Edit fields' })
            : t('publish.edit.trademarks.close', { defaultValue: 'Close' })}
        </Button>
        {hasFlags && onProceed && (
          <Button
            onClick={onProceed}
            variant="contained"
            color="warning"
            sx={{ backgroundColor: COLORS.warningDk }}
          >
            {t('publish.edit.trademarks.proceed', {
              defaultValue: 'Proceed Anyway',
            })}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TMCheckDialog;
