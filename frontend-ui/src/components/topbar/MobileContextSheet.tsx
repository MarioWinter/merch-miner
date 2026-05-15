/**
 * PROJ-30 T2.5 — Mobile Context Sheet (bottom drawer) + Mobile Context Chip.
 *
 * On `<600px` (`useResponsiveLayout().isMobile`) the Topbar collapses the
 * Workspace + Niche chip pair into a single "Context" chip. Tapping it opens
 * a bottom SwipeableDrawer containing the existing WorkspaceSelector and
 * NicheSelector pickers — design Section 2.
 *
 * The chip label resolves with this priority:
 *   - active niche set → niche name (truncated 14ch)
 *   - else active workspace set → workspace name (truncated 14ch)
 *   - else i18n `responsive.context.empty`
 */
import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Stack,
  SwipeableDrawer,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LabelImportantOutlinedIcon from '@mui/icons-material/LabelImportantOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { useListNichesQuery } from '@/store/nicheSlice';
import WorkspaceSelector from './WorkspaceSelector';
import NicheSelector from './NicheSelector';

const TRUNCATE_LEN = 14;
const SHEET_TITLE_ID = 'mobile-context-sheet-title';

const truncate = (value: string, max = TRUNCATE_LEN): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const ChipButton = styled(Button)(({ theme }) => ({
  borderRadius: '999px',
  color: theme.vars.palette.text.secondary,
  textTransform: 'none',
  borderColor: theme.vars.palette.text.secondary,
  fontWeight: 500,
  paddingLeft: 12,
  paddingRight: 12,
  height: 32,
  whiteSpace: 'nowrap',
  maxWidth: 220,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
    color: theme.vars.palette.text.primary,
  },
}));

const DragHandle = styled(Box)(({ theme }) => ({
  width: 40,
  height: 4,
  borderRadius: 2,
  margin: '8px auto 0',
  backgroundColor: `rgba(${theme.vars.palette.text.primaryChannel} / 0.18)`,
}));

const SheetHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 2, 0, 2),
}));

const SheetSection = styled(Stack)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  gap: theme.spacing(0.5),
}));

const OverlineLabel = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.secondary,
  fontWeight: 600,
}));

interface MobileContextChipProps {
  onOpen: () => void;
  open: boolean;
}

/** Compact pill chip rendered in the Topbar on `<600px`. */
export const MobileContextChip = ({ onOpen, open }: MobileContextChipProps) => {
  const { t } = useTranslation();
  const { workspaces, activeWorkspaceId } = useAppSelector((s) => s.workspace);
  const activeNicheId = useAppSelector((s) => s.chatBar.activeNicheId);
  const { data: nichesData } = useListNichesQuery(
    { page: 1, page_size: 100 },
    { skip: !activeWorkspaceId },
  );

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeNiche = (nichesData?.results ?? []).find(
    (n) => n.id === activeNicheId,
  );

  const hasNiche = Boolean(activeNiche);
  const hasWorkspace = Boolean(activeWorkspace);
  const label = hasNiche
    ? truncate(activeNiche!.name)
    : hasWorkspace
      ? truncate(activeWorkspace!.name)
      : t('responsive.context.empty');

  const Icon = hasNiche ? LabelImportantOutlinedIcon : FolderOpenOutlinedIcon;

  return (
    <ChipButton
      variant="outlined"
      size="small"
      startIcon={<Icon sx={{ fontSize: 16 }} />}
      endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={open ? 'true' : 'false'}
      aria-label={t('responsive.context.openLabel')}
      data-testid="topbar-mobile-context-chip"
    >
      {label}
    </ChipButton>
  );
};

interface MobileContextSheetProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}

/** Bottom sheet showing both selectors stacked vertically. */
const MobileContextSheet = ({ open, onClose, onOpen }: MobileContextSheetProps) => {
  const { t } = useTranslation();

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={onOpen}
      variant="temporary"
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': SHEET_TITLE_ID,
          sx: (theme) => ({
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            backgroundColor: theme.vars.palette.background.paper,
            maxHeight: '80vh',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }),
        },
        backdrop: {
          sx: (theme) => ({
            backgroundColor: `rgba(${theme.vars.palette.background.defaultChannel} / 0.75)`,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }),
        },
      }}
      data-testid="topbar-mobile-context-sheet"
    >
      <DragHandle aria-hidden="true" />
      <SheetHeader>
        <Typography
          id={SHEET_TITLE_ID}
          variant="h6"
          sx={{ fontWeight: 600 }}
        >
          {t('responsive.context.sheetTitle')}
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label={t('responsive.context.close')}
        >
          <CloseIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </SheetHeader>

      <SheetSection>
        <OverlineLabel variant="overline">
          {t('responsive.context.workspaceLabel')}
        </OverlineLabel>
        <WorkspaceSelector />
      </SheetSection>

      <SheetSection>
        <OverlineLabel variant="overline">
          {t('responsive.context.nicheLabel')}
        </OverlineLabel>
        <NicheSelector />
      </SheetSection>

      <Box sx={{ p: 2, pt: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="text"
          color="primary"
          onClick={onClose}
        >
          {t('responsive.context.close')}
        </Button>
      </Box>
    </SwipeableDrawer>
  );
};

interface MobileContextControlProps {
  /** Optional override for tests or storybook — defaults to `useState`. */
  initialOpen?: boolean;
}

/**
 * Combined Chip + Sheet — convenient wrapper for Topbar. The chip controls
 * the sheet's open/closed state internally.
 */
export const MobileContextControl = ({
  initialOpen = false,
}: MobileContextControlProps) => {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      <MobileContextChip onOpen={() => setOpen(true)} open={open} />
      <MobileContextSheet
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
      />
    </>
  );
};

export default MobileContextSheet;
