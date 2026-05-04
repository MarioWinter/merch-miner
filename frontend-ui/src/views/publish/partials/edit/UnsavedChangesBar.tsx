import { Box, Button, Slide, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION } from '@/style/constants';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const BarRoot = styled(Box)(({ theme }) => ({
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingInline: theme.spacing(3),
  paddingBlock: theme.spacing(1),
  backgroundColor: alpha(COLORS.warningDk, 0.15),
  borderBottom: `1px solid ${alpha(COLORS.warningDk, 0.30)}`,
  color: COLORS.warningDk,
  position: 'sticky',
  top: 0,
  zIndex: 5,
}));

const LeftGroup = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const DiscardButton = styled(Button)(({ theme }) => ({
  color: COLORS.warningDk,
  '&:hover': {
    backgroundColor: alpha(COLORS.warningDk, 0.08),
  },
  paddingInline: theme.spacing(1.5),
}));

const SaveButton = styled(Button)(({ theme }) => ({
  backgroundColor: COLORS.warningDk,
  color: theme.vars.palette.common.white,
  '&:hover': {
    backgroundColor: COLORS.warningDkShade,
  },
  paddingInline: theme.spacing(2),
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UnsavedChangesBarProps {
  isDirty: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const UnsavedChangesBar = ({
  isDirty,
  onDiscard,
  onSave,
}: UnsavedChangesBarProps) => {
  const { t } = useTranslation();

  return (
    <Slide
      in={isDirty}
      direction="down"
      mountOnEnter
      unmountOnExit
      timeout={DURATION.default}
    >
      <BarRoot role="status" aria-live="polite">
        <LeftGroup>
          <WarningAmberOutlinedIcon sx={{ fontSize: 20 }} aria-hidden />
          <Typography variant="subtitle2" component="span">
            {t('publish.edit.unsaved.message', {
              defaultValue: 'Unsaved changes',
            })}
          </Typography>
        </LeftGroup>
        <LeftGroup>
          <DiscardButton variant="text" size="small" onClick={onDiscard}>
            {t('publish.edit.unsaved.discard', { defaultValue: 'Discard' })}
          </DiscardButton>
          <SaveButton variant="contained" size="small" onClick={onSave}>
            {t('publish.edit.unsaved.save', { defaultValue: 'Save' })}
          </SaveButton>
        </LeftGroup>
      </BarRoot>
    </Slide>
  );
};

export default UnsavedChangesBar;
