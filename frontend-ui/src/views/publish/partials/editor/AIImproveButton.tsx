import { Box, CircularProgress, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { AIImproveListingResponse } from '../../types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ButtonWrapper = styled(Box)({
  // Tooltip on a disabled IconButton needs an intermediate wrapper so
  // hover events propagate — MUI `<Tooltip><IconButton disabled>`
  // otherwise swallows the events.
  display: 'inline-flex',
});

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  color: COLORS.cyan,
  padding: theme.spacing(0.75),
  '&.Mui-disabled': {
    color: theme.vars.palette.text.disabled,
  },
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AIImproveButtonProps {
  /** Trigger from `useEditFormState` — rejects on mutation failure. */
  aiImprove: () => Promise<AIImproveListingResponse | null>;
  /** In-flight loading signal — swaps icon for spinner + disables click. */
  isImproving: boolean;
  /** `true` when a Listing exists for the active (idea, marketplace)
   *  tab. When `false`, the button disables and the tooltip switches to
   *  the AC-71 "Create or convert listing first" guidance. */
  hasListing: boolean;
  /** Called with the list of server-truncated field names after a
   *  successful improve (e.g. `['title', 'bullet_1']`). Parent wires
   *  this to per-field `truncated` chips in `ListingField`. */
  onTruncated?: (fields: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component — Phase P7
// ---------------------------------------------------------------------------

const AIImproveButton = ({
  aiImprove,
  isImproving,
  hasListing,
  onTruncated,
}: AIImproveButtonProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const disabled = !hasListing || isImproving;

  const tooltip = !hasListing
    ? t('publish.ai_improve.tooltipDisabled', {
        defaultValue: 'Create or convert listing first',
      })
    : t('publish.ai_improve.tooltip', {
        defaultValue: 'Improve with AI',
      });

  const handleClick = async () => {
    try {
      const result = await aiImprove();
      if (result) {
        onTruncated?.(result.truncated_fields ?? []);
        enqueueSnackbar(
          t('publish.ai_improve.successSnackbar', {
            defaultValue: 'Listing improved with AI',
          }),
          { variant: 'success' },
        );
      }
    } catch {
      enqueueSnackbar(
        t('publish.ai_improve.errorSnackbar', {
          defaultValue: 'AI Improve failed — please try again',
        }),
        { variant: 'error' },
      );
    }
  };

  return (
    <Tooltip title={tooltip} arrow placement="top">
      <ButtonWrapper>
        <StyledIconButton
          size="small"
          disabled={disabled}
          onClick={() => {
            void handleClick();
          }}
          aria-label={t('publish.ai_improve.buttonLabel', {
            defaultValue: 'AI Improve listing',
          })}
          data-testid="AIImproveButton"
        >
          {isImproving ? (
            <CircularProgress
              size={18}
              thickness={5}
              sx={{ color: 'inherit' }}
            />
          ) : (
            <AutoFixHighOutlinedIcon sx={{ fontSize: 20 }} />
          )}
        </StyledIconButton>
      </ButtonWrapper>
    </Tooltip>
  );
};

export default AIImproveButton;
