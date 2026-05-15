/**
 * PROJ-30 Phase 3B — shared empty / loading / error states for mobile
 * CardList partials. Matches design Section 6 (cardList).
 */
import type { ReactNode } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';

const StateWrapper = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(6, 2),
  gap: theme.spacing(1),
  textAlign: 'center',
}));

export interface CardListSkeletonProps {
  count?: number;
}

export const CardListSkeleton = ({ count = 5 }: CardListSkeletonProps) => (
  <Stack spacing={1}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton
        key={`cardlist-skel-${i}`}
        variant="rounded"
        animation="wave"
        height={96}
        sx={{ borderRadius: '12px' }}
      />
    ))}
  </Stack>
);

export interface CardListEmptyProps {
  title: string;
  hint?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export const CardListEmpty = ({ title, hint, ctaLabel, onCta }: CardListEmptyProps) => (
  <StateWrapper>
    <InboxOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
    <Typography variant="h6" color="text.secondary">
      {title}
    </Typography>
    {hint && (
      <Typography variant="body2" color="text.disabled">
        {hint}
      </Typography>
    )}
    {ctaLabel && onCta && (
      <Box sx={{ pt: 1 }}>
        <Button variant="contained" color="primary" size="small" onClick={onCta}>
          {ctaLabel}
        </Button>
      </Box>
    )}
  </StateWrapper>
);

export interface CardListErrorProps {
  entity: string;
  detail?: ReactNode;
  onRetry?: () => void;
}

export const CardListError = ({ entity, detail, onRetry }: CardListErrorProps) => {
  const { t } = useTranslation();
  return (
    <StateWrapper role="alert">
      <ErrorOutlineIcon sx={{ fontSize: 40, color: 'error.main' }} />
      <Typography variant="h6" color="text.primary">
        {t('responsive.cardList.errorTitle', { entity })}
      </Typography>
      {detail && (
        <Typography variant="body2" color="text.secondary">
          {detail}
        </Typography>
      )}
      {onRetry && (
        <Button variant="text" color="primary" size="small" onClick={onRetry}>
          {t('responsive.cardList.tryAgain')}
        </Button>
      )}
    </StateWrapper>
  );
};
