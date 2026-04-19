import { useState } from 'react';
import {
  Box,
  Button,
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
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CollectionsDialog from '../collections/CollectionsDialog';
import { useAddDesignsFromCollection } from '../../hooks/useAddDesignsFromCollection';

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
}

const EditPageHeader = ({ designIds, onDesignIdsChange }: EditPageHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { addDesignsFromCollection } = useAddDesignsFromCollection();

  const handleBack = () => navigate('/publish');

  const handleCollectionSelected = async (collectionId: string | null) => {
    setCollectionsOpen(false);
    const nextIds = await addDesignsFromCollection(collectionId, designIds);
    if (nextIds !== designIds) onDesignIdsChange(nextIds);
  };

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
      </ActionGroup>

      <CollectionsDialog
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        onOpenFolder={handleCollectionSelected}
      />

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
