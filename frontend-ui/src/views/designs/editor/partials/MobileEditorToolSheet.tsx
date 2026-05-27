/**
 * PROJ-30 T3.23 — Mobile editor tool sheet.
 *
 * Replaces the 280px desktop tool panel on `<md` viewports with a
 * floating action button that opens a swipeable bottom sheet
 * (Layers / Tools / Properties tabs). The three tab contents are
 * passed in by `DesignEditorView` so this component stays render-only.
 */
import { useState, type ReactNode, type SyntheticEvent } from 'react';
import {
  Box,
  Fab,
  IconButton,
  SwipeableDrawer,
  Tab,
  Tabs,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MobileEditorToolSheetProps {
  layersContent: ReactNode;
  toolsContent: ReactNode;
  propertiesContent: ReactNode;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const SheetFab = styled(Fab)({
  position: 'fixed',
  right: 16,
  bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
  zIndex: 1300,
});

const DragHandle = styled(Box)(({ theme }) => ({
  width: 40,
  height: 4,
  borderRadius: 2,
  backgroundColor: theme.vars.palette.action.disabled,
  margin: '8px auto 0',
}));

const HeaderStrip = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const HeaderTabs = styled(Tabs)({
  flex: 1,
  minHeight: 44,
});

const CloseButton = styled(IconButton)({
  width: 44,
  height: 44,
  marginRight: 4,
});

const SheetBody = styled(Box)({
  overflowY: 'auto',
  flex: 1,
  padding: 12,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TAB_KEYS = [
  'responsive.editor.tools.tabLayers',
  'responsive.editor.tools.tabTools',
  'responsive.editor.tools.tabProperties',
] as const;

export const MobileEditorToolSheet = ({
  layersContent,
  toolsContent,
  propertiesContent,
}: MobileEditorToolSheetProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const handleTabChange = (_event: SyntheticEvent, value: number) => {
    setTabIndex(value);
  };

  const tabPanels = [layersContent, toolsContent, propertiesContent];

  return (
    <>
      <SheetFab
        color="primary"
        size="medium"
        onClick={open ? handleClose : handleOpen}
        aria-label={
          open
            ? t('responsive.editor.toolFab.closeLabel')
            : t('responsive.editor.toolFab.openLabel')
        }
      >
        <TuneIcon />
      </SheetFab>

      <SwipeableDrawer
        anchor="bottom"
        open={open}
        onOpen={handleOpen}
        onClose={handleClose}
        disableSwipeToOpen
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              backgroundColor: 'background.paper',
              maxHeight: 'calc(100dvh - 56px)',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <DragHandle aria-hidden />
        <HeaderStrip>
          <HeaderTabs
            value={tabIndex}
            onChange={handleTabChange}
            variant="fullWidth"
            aria-label={t('responsive.editor.toolFab.openLabel')}
          >
            {TAB_KEYS.map((key) => (
              <Tab key={key} label={t(key)} />
            ))}
          </HeaderTabs>
          <CloseButton
            onClick={handleClose}
            aria-label={t('responsive.dialog.closeLabel')}
          >
            <CloseIcon />
          </CloseButton>
        </HeaderStrip>
        <SheetBody role="tabpanel">{tabPanels[tabIndex]}</SheetBody>
      </SwipeableDrawer>
    </>
  );
};

export default MobileEditorToolSheet;
