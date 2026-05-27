import { useCallback } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useCollectProductMutation,
  useRemoveCollectedProductMutation,
} from '@/store/collectedProductsSlice';
import { useIsProductLiked } from './hooks/useIsProductLiked';

interface NicheCollectionHeartButtonProps {
  nicheId: string | null;
  asin: string;
  marketplace: string;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
}

// Visual states (filled vs outline) drive their own color from theme tokens —
// no hardcoded hex per `feedback_no_hardcoded_colors.md`.
const StyledIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'isLiked',
})<{ isLiked: boolean }>(({ theme, isLiked }) => ({
  color: isLiked
    ? theme.vars.palette.error.main
    : theme.vars.palette.action.active,
  transition: 'color 150ms ease, background-color 150ms ease',
  '&:hover': {
    backgroundColor: isLiked
      ? alpha(theme.palette.error.main, 0.12)
      : alpha(theme.palette.action.active, 0.08),
  },
  '&.Mui-disabled': {
    color: theme.vars.palette.action.disabled,
  },
}));

/**
 * Heart-toggle for adding/removing an Amazon product to the active niche's
 * CollectedProduct set. Reads "liked" state from the existing
 * `getCollectedProducts` cache and mutates via the existing collect/remove
 * mutations — no parallel state slice.
 *
 * - `nicheId === null` → button is rendered but disabled with a tooltip.
 * - `asin` or `marketplace` missing → button is hidden (the API call would
 *   fail validation anyway).
 */
const NicheCollectionHeartButton = ({
  nicheId,
  asin,
  marketplace,
  size = 'small',
  sx,
}: NicheCollectionHeartButtonProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const { isLiked, collectedProductId } = useIsProductLiked(
    nicheId,
    asin,
    marketplace,
  );

  const [collectProduct, { isLoading: isAdding }] = useCollectProductMutation();
  const [removeCollectedProduct, { isLoading: isRemoving }] =
    useRemoveCollectedProductMutation();

  const isPending = isAdding || isRemoving;
  const noNiche = nicheId === null;
  const iconSize = size === 'small' ? 18 : 22;

  const handleClick = useCallback(async () => {
    if (!nicheId || !asin || !marketplace || isPending) return;
    if (isLiked) {
      if (!collectedProductId) return;
      try {
        await removeCollectedProduct({
          nicheId,
          collectedProductId,
        }).unwrap();
      } catch {
        enqueueSnackbar(t('nicheCollection.heart.removeError'), {
          variant: 'error',
        });
      }
    } else {
      try {
        await collectProduct({ nicheId, asin, marketplace }).unwrap();
      } catch {
        enqueueSnackbar(t('nicheCollection.heart.addError'), {
          variant: 'error',
        });
      }
    }
  }, [
    nicheId,
    asin,
    marketplace,
    isPending,
    isLiked,
    collectedProductId,
    removeCollectedProduct,
    collectProduct,
    enqueueSnackbar,
    t,
  ]);

  // EC-A6 — hidden when ASIN or marketplace are missing (malformed result).
  if (!asin || !marketplace) {
    return null;
  }

  const ariaLabel = isLiked
    ? t('nicheCollection.heart.removeAriaLabel')
    : t('nicheCollection.heart.addAriaLabel');

  const tooltipTitle = noNiche
    ? t('nicheCollection.heart.noNicheTooltip')
    : ariaLabel;

  const disabled = noNiche || isPending;

  const button = (
    <StyledIconButton
      size={size}
      onClick={handleClick}
      disabled={disabled}
      isLiked={isLiked}
      aria-label={ariaLabel}
      sx={sx}
    >
      {isLiked ? (
        <FavoriteIcon sx={{ fontSize: iconSize }} />
      ) : (
        <FavoriteBorderIcon sx={{ fontSize: iconSize }} />
      )}
    </StyledIconButton>
  );

  // Disabled IconButton swallows pointer events — wrap in a span so the
  // Tooltip still receives them. MUI documents this pattern.
  if (disabled) {
    return (
      <Tooltip title={tooltipTitle}>
        <span>{button}</span>
      </Tooltip>
    );
  }

  return <Tooltip title={tooltipTitle}>{button}</Tooltip>;
};

export default NicheCollectionHeartButton;
