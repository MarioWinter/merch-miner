/**
 * PROJ-29 Phase 1H-2 — three suggested follow-up question chips.
 *
 * Renders the `chatBar.followUps` array (max 3, capped server-side at 80 chars).
 * Hidden when < 3 chips (graceful EC-20). Click clears the chip set and fires
 * `onSelect(label)` so the parent can auto-fill + submit via its existing
 * handleSubmit pipeline.
 */
import { Chip, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearFollowUps } from '@/store/chatBarSlice';

interface FollowUpChipsProps {
  /** Fired with the chip label when the user clicks one. Parent should fill
   *  the chat input and trigger submission. */
  onSelect: (text: string) => void;
}

const SuggestedChip = styled(Chip)(({ theme }) => ({
  justifyContent: 'flex-start',
  height: 'auto',
  minHeight: 32,
  maxWidth: '100%',
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(0.5),
  borderColor: theme.vars.palette.divider,
  backgroundColor: theme.vars.palette.background.paper,
  '& .MuiChip-label': {
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'unset',
    lineHeight: 1.4,
    paddingLeft: theme.spacing(0.5),
  },
  '&:hover': {
    borderColor: theme.vars.palette.primary.main,
    backgroundColor: theme.vars.palette.background.default,
  },
}));

const FollowUpChips = ({ onSelect }: FollowUpChipsProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const followUps = useAppSelector((s) => s.chatBar?.followUps ?? []);

  // Graceful EC-20: only show when backend produced the full set.
  if (followUps.length < 3) return null;

  const handleClick = (label: string) => {
    dispatch(clearFollowUps());
    onSelect(label);
  };

  return (
    <Stack gap={0.75} sx={{ mt: 1 }} aria-label={t('chatNicheRag.followUps.label')}>
      <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
        {t('chatNicheRag.followUps.label')}
      </Typography>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {followUps.map((chip, idx) => (
          <SuggestedChip
            key={`${idx}-${chip}`}
            label={chip}
            icon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
            variant="outlined"
            clickable
            onClick={() => handleClick(chip)}
          />
        ))}
      </Stack>
    </Stack>
  );
};

export default FollowUpChips;
