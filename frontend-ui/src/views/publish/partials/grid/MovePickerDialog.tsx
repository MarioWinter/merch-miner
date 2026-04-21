import { useCallback, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  IconButton,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useGetCollectionTreeQuery,
  useMoveAssetsMutation,
  publishApi,
} from '@/store/publishSlice';
import { useAppDispatch } from '@/store/hooks';
import { COLORS } from '@/style/constants';
import FolderTree from '../collections/FolderTree';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MovePickerDialogProps {
  open: boolean;
  assetId: string | null;
  currentCollectionId: string | null;
  onClose: () => void;
  onMoved?: () => void;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const DialogBody = styled(Box)(({ theme }) => ({
  display: 'flex',
  height: 420,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const EmptyPane = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(3),
  backgroundColor: alpha(COLORS.ink, 0.2),
}));

const MoveButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.vars.palette.secondary.main,
  color: theme.vars.palette.common.white,
  '&:hover': {
    backgroundColor: COLORS.cyanDk,
  },
  '&.Mui-disabled': {
    backgroundColor: alpha(COLORS.cyan, 0.18),
    color: alpha(COLORS.white, 0.4),
  },
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// The inner component owns picker state. Wrapping the mount/unmount in the
// outer `MovePickerDialog` below means every "open" cycle gets a fresh state
// tree — avoids the setState-in-effect lint rule and keeps the picker reset
// per-open deterministic.
interface InnerProps extends MovePickerDialogProps {
  open: true;
}

const MovePickerDialogInner = ({
  assetId,
  currentCollectionId,
  onClose,
  onMoved,
}: InnerProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();

  // Local picker state — `undefined` = nothing picked yet; `null` = root chosen.
  const [selectedTarget, setSelectedTarget] = useState<string | null | undefined>(undefined);

  // Fetch tree only while open — reuse the same cache key as CollectionsDialog.
  const { data: tree, isLoading: treeLoading } = useGetCollectionTreeQuery();

  const [moveAssets, { isLoading: isMoving }] = useMoveAssetsMutation();

  // Disable the asset's current collection in the picker (AC-68).
  const disabledIds = useMemo(
    () => (currentCollectionId ? new Set([currentCollectionId]) : new Set<string>()),
    [currentCollectionId],
  );
  const rootDisabled = currentCollectionId === null;

  const handleMoveClick = useCallback(async () => {
    if (!assetId || selectedTarget === undefined) return;
    try {
      await moveAssets({
        asset_ids: [assetId],
        collection_id: selectedTarget,
      }).unwrap();
      enqueueSnackbar(
        t('publish.movePicker.success', { defaultValue: 'Design moved' }),
        { variant: 'success' },
      );
      onMoved?.();
      onClose();
    } catch (err) {
      // EC-28: target folder may have been deleted between open + submit.
      // Surface the error and refresh the tree so the stale entry disappears.
      const status = (err as { status?: number } | undefined)?.status;
      const message =
        status === 404
          ? t('publish.movePicker.error404', {
              defaultValue: 'Destination no longer exists',
            })
          : t('publish.movePicker.error', {
              defaultValue: 'Failed to move design',
            });
      enqueueSnackbar(message, { variant: 'error' });
      dispatch(
        publishApi.util.invalidateTags([{ type: 'CollectionTree', id: 'TREE' }]),
      );
    }
  }, [
    assetId,
    selectedTarget,
    moveAssets,
    enqueueSnackbar,
    t,
    onMoved,
    onClose,
    dispatch,
  ]);

  const hasPicked = selectedTarget !== undefined;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="move-picker-title"
    >
      <DialogTitle
        id="move-picker-title"
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DriveFileMoveOutlinedIcon fontSize="small" sx={{ color: COLORS.cyan }} />
          <Typography variant="h6" component="span">
            {t('publish.movePicker.title', { defaultValue: 'Move to Collection' })}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t('common.close', { defaultValue: 'Close' })}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers={false} sx={{ p: 0 }}>
        <DialogBody>
          <FolderTree
            tree={tree ?? []}
            selectedId={selectedTarget === undefined ? null : selectedTarget}
            onSelect={(id) => setSelectedTarget(id)}
            isLoading={treeLoading}
            disabledIds={disabledIds}
            rootDisabled={rootDisabled}
            hideRecentlyUsed
          />
          <EmptyPane>
            <DriveFileMoveOutlinedIcon
              sx={{ fontSize: 48, color: alpha(COLORS.cyan, 0.3) }}
            />
            <Typography variant="body2" color="text.secondary">
              {hasPicked
                ? t('publish.movePicker.readyHint', {
                    defaultValue: 'Press Move Here to confirm',
                  })
                : t('publish.movePicker.pickHint', {
                    defaultValue: 'Select a folder from the tree',
                  })}
            </Typography>
          </EmptyPane>
        </DialogBody>
      </DialogContent>

      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={isMoving}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <MoveButton
          variant="contained"
          onClick={handleMoveClick}
          disabled={!hasPicked || isMoving || !assetId}
          startIcon={<DriveFileMoveOutlinedIcon />}
        >
          {t('publish.movePicker.moveHere', { defaultValue: 'Move Here' })}
        </MoveButton>
      </DialogActions>
    </Dialog>
  );
};

// Outer wrapper: mounts the inner dialog only while `open` is true. Using a
// key tied to `assetId` forces a fresh state tree every time the dialog opens
// against a new asset — no manual reset effect required (avoids the
// set-state-in-effect lint rule).
const MovePickerDialog = ({
  open,
  assetId,
  currentCollectionId,
  onClose,
  onMoved,
}: MovePickerDialogProps) => {
  if (!open) return null;
  return (
    <MovePickerDialogInner
      key={assetId ?? 'none'}
      open
      assetId={assetId}
      currentCollectionId={currentCollectionId}
      onClose={onClose}
      onMoved={onMoved}
    />
  );
};

export default MovePickerDialog;
