import {
  Box,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { UpscaleBatchJobRow } from '@/store/upscaleApi';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const DrawerInner = styled(Box)(({ theme }) => ({
  width: 320,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: theme.vars.palette.background.paper,
}));

const DrawerHeader = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingInline: theme.spacing(2),
  paddingBlock: theme.spacing(1.5),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const EmptyState = styled(Box)(({ theme }) => ({
  paddingInline: theme.spacing(2),
  paddingBlock: theme.spacing(3),
  color: theme.vars.palette.text.secondary,
  fontSize: 13,
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

interface UpscaleJobsDrawerProps {
  open: boolean;
  onClose: () => void;
  batchJobs: UpscaleBatchJobRow[];
  singleDesignIds: string[];
}

const shortenId = (id: string): string => (id.length > 8 ? id.slice(0, 8) : id);

const UpscaleJobsDrawer = ({
  open,
  onClose,
  batchJobs,
  singleDesignIds,
}: UpscaleJobsDrawerProps) => {
  const { t } = useTranslation();

  const hasAnyJobs = singleDesignIds.length > 0 || batchJobs.length > 0;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        backdrop: { 'aria-label': t('upscale.pill.drawerHeading', 'Running upscales') },
      }}
    >
      <DrawerInner role="dialog" aria-label={t('upscale.pill.drawerHeading', 'Running upscales')}>
        <DrawerHeader>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('upscale.pill.drawerHeading', 'Running upscales')}
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label={t('upscale.pill.drawerCloseAria', 'Close')}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DrawerHeader>

        {!hasAnyJobs ? (
          <EmptyState>
            {t('upscale.pill.drawerEmpty', 'No upscales running')}
          </EmptyState>
        ) : (
          <List dense disablePadding>
            {singleDesignIds.map((id) => (
              <ListItem
                key={`single-${id}`}
                data-testid="upscale-job-row-single"
                secondaryAction={
                  <CircularProgress size={14} thickness={5} color="secondary" />
                }
              >
                <ListItemText
                  primary={t('upscale.pill.drawerJobLabel', {
                    defaultValue: 'Design {{designId}} · {{source}}',
                    designId: shortenId(id),
                    source: t('upscale.pill.sourceEditor', 'Editor'),
                  })}
                />
              </ListItem>
            ))}
            {singleDesignIds.length > 0 && batchJobs.length > 0 && <Divider />}
            {batchJobs.map((job) => (
              <ListItem
                key={`batch-${job.job_id}`}
                data-testid="upscale-job-row-batch"
              >
                <ListItemText
                  primary={t('upscale.pill.drawerJobLabel', {
                    defaultValue: 'Design {{designId}} · {{source}}',
                    designId: shortenId(job.design_id),
                    source: t('upscale.pill.sourceBatch', 'Batch'),
                  })}
                  secondary={job.status}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DrawerInner>
    </Drawer>
  );
};

export default UpscaleJobsDrawer;
