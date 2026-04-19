import { useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Stack,
  Typography,
  Box,
  Avatar,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { DesignAsset } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CopyScope = 'listing' | 'colors' | 'fit_types' | 'prices';

interface CopyFromDesignDialogProps {
  open: boolean;
  scope: CopyScope | null;
  designs: DesignAsset[];
  activeDesignId: string | null;
  isApplying: boolean;
  onClose: () => void;
  onConfirm: (sourceDesignId: string, scope: CopyScope) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const Row = styled(FormControlLabel)(({ theme }) => ({
  margin: 0,
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.vars.palette.divider}`,
  '& .MuiFormControlLabel-label': {
    width: '100%',
  },
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
  },
}));

const Thumb = styled(Avatar)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.vars.palette.background.default,
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CopyFromDesignDialog = ({
  open,
  scope,
  designs,
  activeDesignId,
  isApplying,
  onClose,
  onConfirm,
}: CopyFromDesignDialogProps) => {
  const { t } = useTranslation();

  const selectableDesigns = useMemo(
    () => designs.filter((d) => d.id !== activeDesignId),
    [designs, activeDesignId],
  );

  // Reset selection whenever the dialog transitions to open. Uses React's
  // "prev-props in state" pattern (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // so we avoid an effect + cascading renders.
  const [selectedId, setSelectedId] = useState<string>('');
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedId(selectableDesigns[0]?.id ?? '');
    }
  }

  const handleConfirm = useCallback(() => {
    if (!selectedId || !scope) return;
    onConfirm(selectedId, scope);
  }, [selectedId, scope, onConfirm]);

  const titleKey: Record<CopyScope, string> = {
    listing: 'publish.copyFrom.titleListing',
    colors: 'publish.copyFrom.titleColors',
    fit_types: 'publish.copyFrom.titleFitTypes',
    prices: 'publish.copyFrom.titlePrices',
  };

  const titleDefault: Record<CopyScope, string> = {
    listing: 'Copy Listing From',
    colors: 'Copy Colors From',
    fit_types: 'Copy Fit Types From',
    prices: 'Copy Prices From',
  };

  const dialogTitle = scope
    ? t(titleKey[scope], { defaultValue: titleDefault[scope] })
    : '';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent dividers>
        {selectableDesigns.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('publish.copyFrom.noSources', {
              defaultValue: 'No other designs in this tab to copy from.',
            })}
          </Typography>
        ) : (
          <RadioGroup
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <Stack gap={1}>
              {selectableDesigns.map((d) => (
                <Row
                  key={d.id}
                  value={d.id}
                  control={<Radio />}
                  label={
                    <Stack direction="row" alignItems="center" gap={1.5}>
                      <Thumb
                        src={d.thumbnail_url || d.file_url}
                        alt={d.file_name}
                        variant="rounded"
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" noWrap>
                          {d.file_name}
                        </Typography>
                        {d.idea && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            component="div"
                          >
                            {t('publish.copyFrom.hasListing', {
                              defaultValue: 'Has listing',
                            })}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                  }
                />
              ))}
            </Stack>
          </RadioGroup>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isApplying}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={!selectedId || isApplying}
        >
          {isApplying
            ? t('publish.copyFrom.applying', { defaultValue: 'Applying…' })
            : t('publish.copyFrom.apply', { defaultValue: 'Apply' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CopyFromDesignDialog;
