import { useState } from 'react';
import { Box, Checkbox, Chip, IconButton, Typography } from '@mui/material';
import { alpha, styled, keyframes } from '@mui/material/styles';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { DesignAsset } from '../../types';
import DesignCardTagEditor from './DesignCardTagEditor';
import DesignCardMenu from './DesignCardMenu';

interface DesignCardProps {
  design: DesignAsset;
  isSelected: boolean;
  anySelected: boolean;
  onSelect: (id: string, shiftKey: boolean) => void;
  onDuplicate?: (id: string) => void;
  onMove?: (id: string) => void;
  index?: number;
  onEditSingle?: (id: string) => void;
  onAddTags?: (id: string) => void;
  onDeleteSingle?: (id: string) => void;
  isEditingTags?: boolean;
  onTagsCommit?: (id: string, tags: string[]) => void;
  onTagsCancel?: (id: string) => void;
}

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const CardRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isSelected' && prop !== 'staggerDelay',
})<{ isSelected: boolean; staggerDelay: number }>(({ theme, isSelected, staggerDelay }) => ({
  position: 'relative',
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${isSelected ? COLORS.cyan : theme.vars.palette.divider}`,
  borderWidth: isSelected ? 2 : 1,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  animation: `${fadeInUp} ${DURATION.default}ms ${EASING.enter} ${staggerDelay}ms both`,
  ...(isSelected && {
    boxShadow: `0 0 12px ${alpha(COLORS.cyan, 0.2)}`,
  }),
  '&:hover': {
    borderColor: isSelected ? COLORS.cyan : alpha(COLORS.white, 0.16),
    transform: 'translateY(-2px)',
    boxShadow: `0 8px 24px ${alpha(COLORS.ink, 0.4)}`,
    '& .hover-actions': { opacity: 1 },
    '& .selection-checkbox': { opacity: 1 },
    '& .thumbnail-img': { transform: 'scale(1.03)' },
  },
}));

const ThumbnailContainer = styled(Box)(({ theme }) => ({
  aspectRatio: '1 / 1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(1.5),
  backgroundColor: alpha(COLORS.ink, 0.3),
  overflow: 'hidden',
  position: 'relative',
}));

const ThumbnailImg = styled('img')({
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
  transition: `transform ${DURATION.default}ms ${EASING.standard}`,
});

const SelectionCheckbox = styled(Checkbox, {
  shouldForwardProp: (prop) => prop !== 'isVisible',
})<{ isVisible: boolean }>(({ isVisible }) => ({
  position: 'absolute',
  top: 8,
  left: 8,
  zIndex: 2,
  opacity: isVisible ? 1 : 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  padding: 2,
  backgroundColor: alpha(COLORS.ink, 0.5),
  backdropFilter: 'blur(4px)',
  borderRadius: 4,
  width: 20,
  height: 20,
  '&.Mui-checked': {
    opacity: 1,
    backgroundColor: COLORS.cyan,
    color: COLORS.white,
    boxShadow: `0 0 8px ${alpha(COLORS.cyan, 0.4)}`,
  },
}));

const HoverActions = styled(Box)({
  position: 'absolute',
  top: 8,
  right: 8,
  display: 'flex',
  gap: 4,
  opacity: 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  zIndex: 2,
});

const ActionIconButton = styled(IconButton)({
  width: 28,
  height: 28,
  backgroundColor: alpha(COLORS.ink, 0.5),
  backdropFilter: 'blur(4px)',
  '&:hover': {
    backgroundColor: alpha(COLORS.ink, 0.7),
  },
});

const GlassInfoStrip = styled(Box)(({ theme }) => ({
  backgroundColor: alpha(COLORS.inkPaper, 0.85),
  backdropFilter: 'blur(12px)',
  borderTop: `1px solid ${alpha(COLORS.white, 0.06)}`,
  padding: theme.spacing(1.25, 1.5),
}));

const TagChip = styled(Chip)({
  height: 20,
  fontSize: '0.6875rem',
  backgroundColor: alpha(COLORS.cyan, 0.1),
  color: COLORS.cyan,
  borderRadius: 4,
});

const DesignCard = ({
  design,
  isSelected,
  anySelected,
  onSelect,
  onDuplicate,
  onMove,
  index = 0,
  onEditSingle,
  onAddTags,
  onDeleteSingle,
  isEditingTags = false,
  onTagsCommit,
  onTagsCancel,
}: DesignCardProps) => {
  const { t } = useTranslation();
  const staggerDelay = Math.min(index * 30, 300);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const menuOpen = Boolean(menuAnchor);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(design.id, e.shiftKey);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    onSelect(design.id, e.shiftKey);
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => setMenuAnchor(null);

  const handleAddTagsLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddTags?.(design.id);
  };

  const formattedDate = new Date(design.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <CardRoot
      data-design-id={design.id}
      isSelected={isSelected}
      staggerDelay={staggerDelay}
      onClick={handleCardClick}
    >
      <ThumbnailContainer>
        <SelectionCheckbox
          className="selection-checkbox"
          checked={isSelected}
          isVisible={isSelected || anySelected}
          onClick={handleCheckboxClick}
          size="small"
          color="secondary"
          data-no-lasso
          aria-label={t('publish.card.select', { defaultValue: 'Select design' })}
        />
        <HoverActions className="hover-actions">
          {onDuplicate && (
            <ActionIconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(design.id);
              }}
              aria-label={t('publish.card.duplicate', { defaultValue: 'Duplicate' })}
            >
              <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
            </ActionIconButton>
          )}
          {onMove && (
            <ActionIconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onMove(design.id);
              }}
              aria-label={t('publish.card.move', { defaultValue: 'Move' })}
            >
              <DriveFileMoveOutlinedIcon sx={{ fontSize: 16 }} />
            </ActionIconButton>
          )}
        </HoverActions>
        {design.thumbnail_url || design.file_url ? (
          <ThumbnailImg
            className="thumbnail-img"
            src={design.thumbnail_url || design.file_url}
            alt={design.file_name}
            loading="lazy"
          />
        ) : (
          <Box sx={{ color: 'text.disabled', fontSize: 48 }}>?</Box>
        )}
      </ThumbnailContainer>

      <GlassInfoStrip onClick={(e) => isEditingTags && e.stopPropagation()}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ color: isSelected ? COLORS.cyan : 'text.primary', flex: 1 }}
          >
            {design.file_name}
          </Typography>
          <IconButton
            size="small"
            sx={{ p: 0.25 }}
            data-no-lasso
            onClick={handleMenuOpen}
            aria-label={t('publish.card.menu.open', { defaultValue: 'Open card menu' })}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreVertIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Box sx={{ mt: 0.5, minHeight: 20 }}>
          {isEditingTags ? (
            <DesignCardTagEditor
              initialTags={design.tags}
              onCommit={(tags) => onTagsCommit?.(design.id, tags)}
              onCancel={() => onTagsCancel?.(design.id)}
            />
          ) : (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {design.tags.length > 0 ? (
                design.tags.slice(0, 3).map((tag) => (
                  <TagChip key={tag} label={tag} size="small" />
                ))
              ) : (
                <Typography
                  variant="caption"
                  role="button"
                  tabIndex={0}
                  onClick={handleAddTagsLinkClick}
                  sx={{ color: COLORS.cyan, cursor: 'pointer' }}
                >
                  {t('publish.card.addTags', { defaultValue: 'Add Tags' })}
                </Typography>
              )}
            </Box>
          )}
        </Box>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block' }}>
          {formattedDate}
        </Typography>
      </GlassInfoStrip>

      <DesignCardMenu
        anchorEl={menuAnchor}
        open={menuOpen}
        onClose={handleMenuClose}
        onEdit={() => {
          handleMenuClose();
          onEditSingle?.(design.id);
        }}
        onDuplicate={() => {
          handleMenuClose();
          onDuplicate?.(design.id);
        }}
        onMove={() => {
          handleMenuClose();
          onMove?.(design.id);
        }}
        onAddTags={() => {
          handleMenuClose();
          onAddTags?.(design.id);
        }}
        onDelete={() => {
          handleMenuClose();
          onDeleteSingle?.(design.id);
        }}
      />
    </CardRoot>
  );
};

export default DesignCard;
