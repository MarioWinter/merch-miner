/**
 * PROJ-30 T3.7 — vertical card list mirroring NicheTable rows for
 * `<744px` viewports. Mirrors the props of NicheTable so NicheListView can
 * swap them with `useResponsiveLayout`.
 */
import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  Stack,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { MobileCard } from '@/components/MobileCard';
import { NicheStatusChip } from './NicheStatusChip';
import { PotentialRatingChip } from './PotentialRatingChip';
import type { Niche } from '../types';
import type { UseNicheSelectionReturn } from '../hooks/useNicheSelection';

interface NicheCardListProps {
  niches: Niche[];
  selection: UseNicheSelectionReturn;
  onRowClick: (id: string) => void;
  onArchive: (id: string) => Promise<void>;
}

const DestructiveMenuItem = styled('li')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.75, 2),
  color: theme.vars.palette.error.main,
  cursor: 'pointer',
  fontSize: '0.875rem',
  listStyle: 'none',
  '&:hover': {
    backgroundColor: `rgba(${theme.vars.palette.error.mainChannel} / 0.08)`,
  },
}));

export const NicheCardList = ({
  niches,
  selection,
  onRowClick,
  onArchive,
}: NicheCardListProps) => {
  const { t } = useTranslation();
  const { toggleOne, isSelected } = selection;

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuNicheId, setMenuNicheId] = useState<string | null>(null);
  const [archiveDialogId, setArchiveDialogId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const handleMenuOpen = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    setMenuAnchor(e.currentTarget);
    setMenuNicheId(id);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuNicheId(null);
  };

  const handleArchiveClick = () => {
    setArchiveDialogId(menuNicheId);
    handleMenuClose();
  };

  const handleArchiveConfirm = async () => {
    if (!archiveDialogId) return;
    setArchiving(true);
    try {
      await onArchive(archiveDialogId);
    } finally {
      setArchiving(false);
      setArchiveDialogId(null);
    }
  };

  return (
    <>
      <Stack
        spacing={1}
        role="list"
        aria-label={t('niches.pageTitle')}
      >
        {niches.map((niche) => {
          const productCount = niche.idea_count;
          const ideasCount = niche.approved_idea_count;
          return (
            <MobileCard
              key={niche.id}
              title={niche.name}
              primaryMeta={t('responsive.cardList.niche.metaCounts', {
                products: productCount,
                ideas: ideasCount,
              })}
              secondaryMeta={t('responsive.cardList.niche.createdOn', {
                date: dayjs(niche.created_at).format('MMM D, YYYY'),
              })}
              chips={
                <>
                  <NicheStatusChip status={niche.status} />
                  {niche.potential_rating && (
                    <PotentialRatingChip potentialRating={niche.potential_rating} />
                  )}
                </>
              }
              selectable
              selected={isSelected(niche.id)}
              onToggleSelect={() => toggleOne(niche.id)}
              selectAriaLabel={t('responsive.cardList.selectAria', { title: niche.name })}
              onActivate={() => onRowClick(niche.id)}
              onMenuOpen={(e) => handleMenuOpen(e, niche.id)}
              menuAriaLabel={t('responsive.cardList.actionsAria', { title: niche.name })}
            />
          );
        })}
      </Stack>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <DestructiveMenuItem role="menuitem" onClick={handleArchiveClick}>
          <DeleteOutlineIcon fontSize="small" />
          {t('niches.drawer.archive')}
        </DestructiveMenuItem>
      </Menu>

      <Dialog
        open={Boolean(archiveDialogId)}
        onClose={() => setArchiveDialogId(null)}
        aria-labelledby="archive-dialog-title-mobile"
      >
        <DialogTitle id="archive-dialog-title-mobile">
          {t('niches.drawer.archiveConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('niches.drawer.archiveConfirmBody')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="text"
            onClick={() => setArchiveDialogId(null)}
            disabled={archiving}
          >
            {t('niches.drawer.archiveCancel')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleArchiveConfirm}
            disabled={archiving}
            startIcon={<DeleteOutlineIcon />}
          >
            {t('niches.drawer.archiveConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
