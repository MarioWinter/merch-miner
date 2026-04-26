import { Box, Chip, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setNicheContext } from '@/store/chatBarSlice';

interface ContextToggleProps {
  /** Niche currently shown in the NicheDetail tab (candidate for context). Null when no niche is open. */
  candidateNiche: { id: string; name: string } | null;
}

/**
 * AC-46/47/48: Toggle "Use current Niche as context" — default OFF.
 * Only rendered when there is a candidate niche (NicheDetail tab is showing one).
 * When ON, the active niche becomes the chat context (passed to Vane as system_instructions).
 */
const ContextToggle = ({ candidateNiche }: ContextToggleProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const nicheContext = useAppSelector((s) => s.chatBar.nicheContext);
  const enabled = !!nicheContext && candidateNiche?.id === nicheContext.id;

  if (!candidateNiche) return null;

  const handleToggle = (_: unknown, checked: boolean) => {
    if (checked) {
      dispatch(setNicheContext(candidateNiche));
    } else {
      dispatch(setNicheContext(null));
    }
  };

  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ flexWrap: 'wrap' }}>
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={enabled}
            onChange={handleToggle}
            inputProps={{ 'aria-label': t('search.context.toggleLabel') }}
          />
        }
        label={
          <Typography variant="caption" color="text.secondary">
            {t('search.context.useAsContext')}
          </Typography>
        }
        sx={{ m: 0 }}
      />
      {enabled && (
        <Chip
          icon={<SellOutlinedIcon sx={{ fontSize: 14 }} />}
          label={candidateNiche.name}
          onDelete={() => dispatch(setNicheContext(null))}
          size="small"
          color="secondary"
          variant="outlined"
        />
      )}
      {!enabled && (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', color: 'text.disabled' }}>
          <Typography variant="caption">
            {candidateNiche.name}
          </Typography>
        </Box>
      )}
    </Stack>
  );
};

export default ContextToggle;
