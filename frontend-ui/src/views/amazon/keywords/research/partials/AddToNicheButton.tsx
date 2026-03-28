import { useState, useCallback } from 'react';
import {
  Button,
  CircularProgress,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListNichesQuery } from '@/store/nicheSlice';
import { useBulkAddKeywordsMutation } from '@/store/keywordSlice';

interface AddToNicheButtonProps {
  selectedKeywords: string[];
  activeNicheId: string | null;
  activeNicheName: string | null;
  onClearSelection: () => void;
}

export const AddToNicheButton = ({
  selectedKeywords,
  activeNicheId,
  activeNicheName,
  onClearSelection,
}: AddToNicheButtonProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [targetNicheId, setTargetNicheId] = useState<string | null>(activeNicheId);

  const { data: nichesData } = useListNichesQuery({ page_size: 100 });
  const [bulkAdd, { isLoading: isAdding }] = useBulkAddKeywordsMutation();

  const niches = nichesData?.results ?? [];
  const count = selectedKeywords.length;

  const effectiveNicheId = targetNicheId ?? activeNicheId;
  const effectiveNicheName =
    targetNicheId && targetNicheId !== activeNicheId
      ? niches.find((n) => n.id === targetNicheId)?.name
      : activeNicheName;

  const handleAdd = useCallback(async () => {
    if (!effectiveNicheId || count === 0) return;
    try {
      await bulkAdd({
        nicheId: effectiveNicheId,
        body: { keywords: selectedKeywords.map((k) => ({ keyword: k })) },
      }).unwrap();
      enqueueSnackbar(
        t('keywords.addToNiche.addedCount', { count }),
        { variant: 'success' },
      );
      onClearSelection();
    } catch {
      enqueueSnackbar(t('keywords.errors.addFailed'), { variant: 'error' });
    }
  }, [effectiveNicheId, count, selectedKeywords, bulkAdd, enqueueSnackbar, t, onClearSelection]);

  const handleSelectNiche = (nicheId: string) => {
    setTargetNicheId(nicheId);
    setAnchorEl(null);
  };

  if (count === 0) return null;

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={isAdding ? <CircularProgress size={16} /> : <AddIcon />}
        onClick={effectiveNicheId ? handleAdd : (e) => setAnchorEl(e.currentTarget)}
        disabled={isAdding}
        size="small"
      >
        {effectiveNicheId
          ? t('keywords.addToNiche.buttonLabel', { count, niche: effectiveNicheName })
          : t('keywords.addToNiche.selectNiche', { count })}
      </Button>

      {effectiveNicheId && (
        <Button
          size="small"
          variant="text"
          startIcon={<SwapHorizIcon sx={{ fontSize: 16 }} />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ ml: 1 }}
        >
          {t('keywords.addToNiche.changeNiche')}
        </Button>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {niches.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {t('keywords.addToNiche.noNiches')}
            </Typography>
          </MenuItem>
        )}
        {niches.map((niche) => (
          <MenuItem
            key={niche.id}
            onClick={() => handleSelectNiche(niche.id)}
            selected={niche.id === effectiveNicheId}
          >
            <ListItemText primary={niche.name} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
