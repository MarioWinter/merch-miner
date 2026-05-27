import { useCallback } from 'react';
import { Box, Button, Chip, IconButton, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSnackbar, type SnackbarKey } from 'notistack';
import { useTranslation } from 'react-i18next';
import type { Design } from '../types';
import type { VersionSlot } from '../hooks/useArtboardVersionSync';
import { usePendingDeletions } from '../hooks/usePendingDeletions';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const PickerRoot = styled(Box)({
  position: 'absolute',
  zIndex: 30,
  pointerEvents: 'auto',
});

// Wrap each chip so the trash icon can absolutely-position relative to it
// and stays hidden until hover. Keeps chip visuals identical to defaults.
const ChipWrap = styled(Box)({
  position: 'relative',
  display: 'inline-flex',
  '& .picker-trash': {
    opacity: 0,
    pointerEvents: 'none',
    transition: 'opacity 150ms ease',
  },
  '&:hover .picker-trash': {
    opacity: 1,
    pointerEvents: 'auto',
  },
});

const TrashButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: -8,
  right: -8,
  width: 18,
  height: 18,
  padding: 0,
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  '&:hover': {
    backgroundColor: theme.vars.palette.error.main,
    color: theme.vars.palette.common.white,
    borderColor: theme.vars.palette.error.main,
  },
}));

// -----------------------------------------------------------------
// Props + helpers
// -----------------------------------------------------------------

const SLOT_ORDER: readonly VersionSlot[] = [
  'original',
  'processed',
  'bg_removed',
  'upscaled',
] as const;

const SLOT_LABEL_KEY: Record<VersionSlot, string> = {
  original: 'design.versions.original',
  processed: 'design.versions.edited',
  bg_removed: 'design.versions.bgRemoved',
  upscaled: 'design.versions.upscaled',
};

const slotUrl = (design: Design, slot: VersionSlot): string => {
  switch (slot) {
    case 'upscaled':
      return design.upscaled_file;
    case 'bg_removed':
      return design.bg_removed_file;
    case 'processed':
      return design.processed_file;
    case 'original':
      return design.image_file;
  }
};

const autoPriority = (design: Design): VersionSlot | null => {
  if (design.upscaled_file) return 'upscaled';
  if (design.bg_removed_file) return 'bg_removed';
  if (design.processed_file) return 'processed';
  if (design.image_file) return 'original';
  return null;
};

export interface ArtboardVersionPickerProps {
  designId: string;
  design: Design;
  projectId?: string;
  /** When null, the picker shows the auto-priority slot as active. */
  currentPickedSlot: VersionSlot | null;
  /** Pass `null` to revert to auto-priority. */
  onPick: (slot: VersionSlot | null) => void;
  /** Screen-space top-left coordinate for the picker overlay (px). */
  positionAt: { x: number; y: number };
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ArtboardVersionPicker = ({
  designId,
  design,
  projectId,
  currentPickedSlot,
  onPick,
  positionAt,
}: ArtboardVersionPickerProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { isPending, requestDelete, undoDelete } = usePendingDeletions();

  const autoSlot = autoPriority(design);
  const activeSlot = currentPickedSlot ?? autoSlot;

  const visibleSlots = SLOT_ORDER.filter(
    (slot) => slotUrl(design, slot).length > 0 && !isPending(designId, slot),
  );

  const renderUndoAction = useCallback(
    (slot: VersionSlot) => (snackKey: SnackbarKey) => (
      <Button
        size="small"
        color="inherit"
        onClick={() => {
          undoDelete(designId, slot);
          closeSnackbar(snackKey);
        }}
      >
        {t('design.versions.undo')}
      </Button>
    ),
    [closeSnackbar, designId, t, undoDelete],
  );

  const handleChipClick = useCallback(
    (slot: VersionSlot) => {
      if (slot === activeSlot) return;
      // Clicking the auto-priority slot clears the explicit pick.
      if (currentPickedSlot === null && slot === autoSlot) return;
      if (slot === autoSlot) {
        onPick(null);
      } else {
        onPick(slot);
      }
    },
    [activeSlot, autoSlot, currentPickedSlot, onPick],
  );

  const handleTrashClick = useCallback(
    (slot: VersionSlot) => {
      requestDelete(designId, slot, projectId);
      enqueueSnackbar(t('design.versions.deleted'), {
        variant: 'info',
        autoHideDuration: 5000,
        action: renderUndoAction(slot),
      });
    },
    [designId, enqueueSnackbar, projectId, renderUndoAction, requestDelete, t],
  );

  if (visibleSlots.length === 0) return null;

  return (
    <PickerRoot sx={{ left: positionAt.x, top: positionAt.y }}>
      <Stack direction="row" spacing={0.5}>
        {visibleSlots.map((slot) => {
          const isActive = slot === activeSlot;
          const label = t(SLOT_LABEL_KEY[slot]);
          return (
            <ChipWrap key={slot}>
              <Chip
                label={label}
                size="small"
                color={isActive ? 'primary' : 'default'}
                variant={isActive ? 'filled' : 'outlined'}
                onClick={() => handleChipClick(slot)}
                aria-pressed={isActive}
              />
              <TrashButton
                className="picker-trash"
                size="small"
                aria-label={`${t('design.versions.deleted')} ${label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTrashClick(slot);
                }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 12 }} />
              </TrashButton>
            </ChipWrap>
          );
        })}
      </Stack>
    </PickerRoot>
  );
};

export default ArtboardVersionPicker;
