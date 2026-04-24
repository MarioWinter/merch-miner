import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CollectionsDialog from '../collections/CollectionsDialog';
import { useAddDesignsFromCollection } from '../../hooks/useAddDesignsFromCollection';
import AIImproveButton from '../editor/AIImproveButton';
import SaveAsTemplateDialog from './SaveAsTemplateDialog';
import type { AIImproveListingResponse, MarketplaceType } from '../../types';

const HeaderRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 3),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const ActionGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

interface EditPageHeaderProps {
  designIds: string[];
  onDesignIdsChange: (ids: string[]) => void;
  // AC-70: central AI Improve IconButton lives in the header top-right.
  aiImprove: () => Promise<AIImproveListingResponse | null>;
  isImproving: boolean;
  hasListing: boolean;
  onTruncated?: (fields: string[]) => void;
  // AC-74: manual Save button — flushes pending PATCHes and shows Saved ✓.
  isDirty: boolean;
  isSaving: boolean;
  saveError: Error | null;
  onSave: () => void | Promise<unknown>;
  // Round-5 hotfix: entry point for creating an UploadTemplate from the
  // active design's DesignProductConfig. Without this the PublishBatchDialog
  // had no template to pick and the whole upload flow dead-ended.
  activeDesignId: string | null;
  activeMarketplace: MarketplaceType;
  defaultBrandName?: string;
}

const EditPageHeader = ({
  designIds,
  onDesignIdsChange,
  aiImprove,
  isImproving,
  hasListing,
  onTruncated,
  isDirty,
  isSaving,
  saveError,
  onSave,
  activeDesignId,
  activeMarketplace,
  defaultBrandName,
}: EditPageHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const { addDesignsFromCollection } = useAddDesignsFromCollection();

  // AC-74: 2-second "Saved ✓" indicator after a successful manual save.
  // Toggles on the isSaving true→false transition with no error.
  const [showSaved, setShowSaved] = useState(false);
  const [prevIsSaving, setPrevIsSaving] = useState(isSaving);
  if (prevIsSaving !== isSaving) {
    setPrevIsSaving(isSaving);
    if (prevIsSaving && !isSaving && !saveError) {
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    }
  }

  const handleBack = () => navigate('/publish');

  const handleCollectionSelected = async (collectionId: string | null) => {
    setCollectionsOpen(false);
    const nextIds = await addDesignsFromCollection(collectionId, designIds);
    if (nextIds !== designIds) onDesignIdsChange(nextIds);
  };

  const saveDisabled = isSaving || (!isDirty && !saveError);
  const saveIcon = isSaving ? (
    <CircularProgress size={16} thickness={5} color="inherit" />
  ) : showSaved ? (
    <CheckIcon fontSize="small" />
  ) : (
    <SaveOutlinedIcon fontSize="small" />
  );
  const saveLabel = showSaved
    ? t('publish.edit.savedLabel', { defaultValue: 'Saved' })
    : t('publish.edit.saveLabel', { defaultValue: 'Save' });

  return (
    <HeaderRoot>
      <Button
        variant="text"
        color="inherit"
        startIcon={<ArrowBackIcon />}
        onClick={handleBack}
      >
        {t('publish.edit.backToCollection')}
      </Button>

      <ActionGroup>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setCollectionsOpen(true)}
        >
          {t('publish.edit.addDesigns')}
        </Button>
        <Button
          variant="text"
          color="inherit"
          startIcon={<KeyboardOutlinedIcon />}
          onClick={() => setShortcutsOpen(true)}
        >
          {t('publish.edit.shortcutGuide')}
        </Button>
        <AIImproveButton
          aiImprove={aiImprove}
          isImproving={isImproving}
          hasListing={hasListing}
          onTruncated={onTruncated}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<BookmarkAddOutlinedIcon />}
          onClick={() => setSaveTemplateOpen(true)}
          disabled={!activeDesignId}
          data-testid="EditPageHeader-saveAsTemplate"
        >
          {t('publish.edit.saveTemplate.button', {
            defaultValue: 'Save as Template',
          })}
        </Button>
        <Button
          variant="contained"
          size="small"
          color={showSaved ? 'success' : 'primary'}
          startIcon={saveIcon}
          disabled={saveDisabled}
          onClick={() => void onSave()}
          data-testid="EditPageHeader-saveButton"
        >
          {saveLabel}
        </Button>
      </ActionGroup>

      <CollectionsDialog
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        onOpenFolder={handleCollectionSelected}
      />

      {saveTemplateOpen && (
        <SaveAsTemplateDialog
          open
          onClose={() => setSaveTemplateOpen(false)}
          designId={activeDesignId}
          marketplaceType={activeMarketplace}
          defaultBrandName={defaultBrandName}
        />
      )}

      <Dialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5">{t('publish.edit.shortcutsTitle')}</Typography>
          <IconButton
            size="small"
            onClick={() => setShortcutsOpen(false)}
            aria-label={t('publish.edit.close')}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {t('publish.edit.shortcutsSoon')}
          </Typography>
        </DialogContent>
      </Dialog>
    </HeaderRoot>
  );
};

export default EditPageHeader;
