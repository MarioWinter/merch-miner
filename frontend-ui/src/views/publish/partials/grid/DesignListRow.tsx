import { Box, Checkbox, Chip, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { DesignAsset } from '../../types';

interface DesignListRowProps {
  design: DesignAsset;
  isSelected: boolean;
  onSelect: (id: string, shiftKey: boolean) => void;
}

const RowRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  display: 'flex',
  alignItems: 'center',
  height: 56,
  padding: theme.spacing(0, 2),
  gap: theme.spacing(1.5),
  cursor: 'pointer',
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  ...(isSelected && {
    backgroundColor: alpha(COLORS.cyan, 0.06),
    borderLeft: `2px solid ${COLORS.cyan}`,
  }),
  '&:hover': {
    backgroundColor: isSelected
      ? alpha(COLORS.cyan, 0.08)
      : alpha('#fff', 0.03),
  },
}));

const Thumbnail = styled('img')({
  width: 40,
  height: 40,
  objectFit: 'contain',
  borderRadius: 4,
  flexShrink: 0,
});

const TagChip = styled(Chip)({
  height: 20,
  fontSize: '0.6875rem',
  backgroundColor: alpha(COLORS.cyan, 0.1),
  color: COLORS.cyan,
  borderRadius: 4,
});

const DesignListRow = ({ design, isSelected, onSelect }: DesignListRowProps) => {
  const { t } = useTranslation();

  const formattedDate = new Date(design.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <RowRoot
      data-design-id={design.id}
      isSelected={isSelected}
      onClick={(e) => onSelect(design.id, e.shiftKey)}
    >
      <Checkbox
        checked={isSelected}
        size="small"
        color="secondary"
        onClick={(e) => e.stopPropagation()}
        onChange={() => onSelect(design.id, false)}
        data-no-lasso
        aria-label={t('publish.card.select', { defaultValue: 'Select design' })}
      />
      {(design.thumbnail_url || design.file_url) ? (
        <Thumbnail
          src={design.thumbnail_url || design.file_url}
          alt={design.file_name}
          loading="lazy"
        />
      ) : (
        <Box sx={{ width: 40, height: 40, bgcolor: 'action.hover', borderRadius: 1 }} />
      )}
      <Typography variant="subtitle2" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {design.file_name}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {design.tags.slice(0, 2).map((tag) => (
          <TagChip key={tag} label={tag} size="small" />
        ))}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, width: 60 }}>
        {formattedDate}
      </Typography>
    </RowRoot>
  );
};

export default DesignListRow;
