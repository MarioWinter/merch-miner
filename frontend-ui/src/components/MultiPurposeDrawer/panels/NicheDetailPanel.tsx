import { Box, Typography, Stack } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';

/**
 * NicheDetailPanel wraps the existing Niche detail content.
 * When the MultiPurposeDrawer is opened with the "niche" panel active,
 * it delegates rendering to the existing NichePipeline internals.
 *
 * For MVP, this panel shows a placeholder directing users to open a niche.
 * The actual niche content is managed by NicheListView's drawer state.
 */
const NicheDetailPanel = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8, px: 3 }} gap={1.5}>
        <InfoOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        <Typography variant="h6" color="text.secondary" textAlign="center">
          {t('search.drawer.noNicheSelected')}
        </Typography>
        <Typography variant="body2" color="text.disabled" textAlign="center">
          {t('search.drawer.selectNicheHint')}
        </Typography>
      </Stack>
    </Box>
  );
};

export default NicheDetailPanel;
