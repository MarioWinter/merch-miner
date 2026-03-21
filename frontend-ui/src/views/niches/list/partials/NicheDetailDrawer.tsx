import { useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
  TextField,
} from '@mui/material';
import { alpha, styled, keyframes } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ResearchProgressStepper } from '../../research/partials/ResearchProgressStepper';
import {
  MARKETPLACES,
  PRODUCT_TYPES,
} from '../../research/types';
import type {
  Marketplace,
  ProductType,
  ResearchRunStatus,
} from '../../research/types';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../../store';
import type { NicheStatus, PotentialRating } from '../types';
import type { DrawerMode } from '../hooks/useNicheDrawer';
import { useNicheDetailDrawer } from '../hooks/useNicheDetailDrawer';

interface NicheDetailDrawerProps {
  open: boolean;
  mode: DrawerMode;
  selectedId: string | null;
  onClose: () => void;
}

const DRAWER_WIDTH = 480;

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
}));

const DrawerBody = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

const DrawerFooter = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(2)} ${theme.spacing(3)}`,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
  gap: theme.spacing(1),
}));

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const ResearchSection = styled(Box)({
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: 16,
  background: 'rgba(11,39,49,0.40)',
});

const ResearchHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 12,
});

const StartButton = styled(Button)({
  background: 'linear-gradient(135deg, #FF5A4F 0%, #E84B42 100%)',
  backgroundSize: '200% 100%',
  color: '#FFFFFF',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: '0.875rem',
  textTransform: 'none',
  '&:hover': {
    background: 'linear-gradient(135deg, #FF5A4F 0%, #E84B42 50%, #FF5A4F 100%)',
    backgroundSize: '200% 100%',
    animation: `${shimmer} 2s infinite linear`,
  },
  '&.Mui-disabled': {
    color: 'rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.08)',
  },
});

const NICHE_STATUSES: NicheStatus[] = [
  'data_entry', 'deep_research', 'niche_with_potential',
  'to_designer', 'upload', 'start_ads',
  'pending', 'winner', 'loser',
];

const POTENTIAL_RATINGS: (PotentialRating | '')[] = ['', 'good', 'very_good', 'rejected'];

export const NicheDetailDrawer = ({
  open,
  mode,
  selectedId,
  onClose,
}: NicheDetailDrawerProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const activeWorkspaceId = useSelector((s: RootState) => s.workspace.activeWorkspaceId);
  const workspaces = useSelector((s: RootState) => s.workspace.workspaces);
  const members = workspaces.find((w) => w.id === activeWorkspaceId)?.members ?? [];

  const {
    niche,
    isFetching,
    createForm,
    editForm,
    handleCreate,
    handleUpdate,
    creating,
    updating,
    deleting,
    serverError,
    archiveDialogOpen,
    setArchiveDialogOpen,
    unsavedDialogOpen,
    setUnsavedDialogOpen,
    handleArchiveConfirm,
    requestClose,
    discardAndClose,
  } = useNicheDetailDrawer({ mode, selectedId, onClose });

  const isCreate = mode === 'create';
  const isBusy = creating || updating || deleting || isFetching;

  // Research filter state
  const [marketplace, setMarketplace] = useState<Marketplace>('amazon_com');
  const [productType, setProductType] = useState<ProductType>('t_shirt');
  const [forceRefresh, setForceRefresh] = useState(false);

  const researchProgress = niche?.research_progress ?? null;
  const researchStatus = (researchProgress?.status ?? null) as ResearchRunStatus | null;
  const isResearchBusy = researchStatus === 'pending' || researchStatus === 'running';
  const isResearchDone = researchStatus === 'completed';
  const isResearchFailed = researchStatus === 'failed';
  const retryCount = researchProgress?.retry_count ?? 0;
  const retriesExhausted = retryCount >= 3;

  const handleStartResearch = () => {
    if (!niche) return;
    const params = new URLSearchParams({
      nicheId: niche.id,
      nicheName: niche.name,
      marketplace,
      product_type: productType,
      ...(forceRefresh ? { force_refresh: 'true' } : {}),
    });
    navigate(`/niches/research?${params.toString()}`);
  };

  const handleStopResearch = () => {
    if (!niche) return;
    navigate(
      `/niches/research?nicheId=${niche.id}&nicheName=${encodeURIComponent(niche.name)}&action=cancel`,
    );
  };

  const handleViewResults = () => {
    if (!niche) return;
    navigate(
      `/niches/research?nicheId=${niche.id}&nicheName=${encodeURIComponent(niche.name)}`,
    );
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={requestClose}
        PaperProps={{ sx: { width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column' } }}
      >
        <DrawerHeader>
          <Typography variant="h6" fontWeight={600}>
            {isCreate ? t('niches.drawer.createTitle') : (niche?.name ?? t('niches.drawer.editTitle'))}
          </Typography>
          <IconButton size="small" onClick={requestClose} aria-label={t('niches.drawer.cancel')} sx={{ borderRadius: '8px' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DrawerHeader>

        <DrawerBody>
          {serverError && (
            <Alert severity="error" sx={{ mb: 0 }}>
              {serverError}
            </Alert>
          )}

          {isCreate ? (
            <Stack component="form" id="niche-create-form" onSubmit={createForm.handleSubmit(handleCreate)} gap={2.5}>
              <Controller
                name="name"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label={t('niches.drawer.name')}
                    placeholder={t('niches.drawer.namePlaceholder')}
                    error={!!fieldState.error}
                    helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                    required
                    fullWidth
                    size="small"
                    autoFocus
                  />
                )}
              />
              <Controller
                name="notes"
                control={createForm.control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label={t('niches.drawer.notes')}
                    placeholder={t('niches.drawer.notesPlaceholder')}
                    error={!!fieldState.error}
                    helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                    multiline
                    rows={4}
                    fullWidth
                    size="small"
                  />
                )}
              />
            </Stack>
          ) : (
            <Stack component="form" id="niche-edit-form" onSubmit={editForm.handleSubmit(handleUpdate)} gap={2.5}>
              {isFetching && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={32} />
                </Box>
              )}
              {!isFetching && niche && (
                <>
                  <Controller
                    name="name"
                    control={editForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label={t('niches.drawer.name')}
                        error={!!fieldState.error}
                        helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                        required
                        fullWidth
                        size="small"
                      />
                    )}
                  />
                  <Controller
                    name="notes"
                    control={editForm.control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label={t('niches.drawer.notes')}
                        error={!!fieldState.error}
                        helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
                        multiline
                        rows={3}
                        fullWidth
                        size="small"
                      />
                    )}
                  />
                  <Controller
                    name="status"
                    control={editForm.control}
                    render={({ field }) => (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.75, color: 'text.secondary' }}>
                          {t('niches.drawer.status')}
                        </Typography>
                        <Select
                          {...field}
                          onChange={(e) => {
                            const newStatus = e.target.value as NicheStatus;
                            field.onChange(newStatus);
                            if (
                              newStatus === 'niche_with_potential' &&
                              editForm.getValues('potential_rating') !== 'good' &&
                              editForm.getValues('potential_rating') !== 'very_good'
                            ) {
                              editForm.setValue('potential_rating', 'good', { shouldDirty: true });
                            }
                          }}
                          fullWidth
                          size="small"
                          displayEmpty
                        >
                          {NICHE_STATUSES.map((s) => (
                            <MenuItem key={s} value={s}>
                              {t(`niches.status.${s}`)}
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>
                    )}
                  />
                  <Controller
                    name="potential_rating"
                    control={editForm.control}
                    render={({ field }) => (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 0.75, color: 'text.secondary' }}>
                          {t('niches.drawer.potentialRating')}
                        </Typography>
                        <Select
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          fullWidth
                          size="small"
                          displayEmpty
                        >
                          {POTENTIAL_RATINGS.map((r) => (
                            <MenuItem key={r} value={r}>
                              {r ? t(`niches.potentialRating.${r}`) : t('niches.potentialRating.none')}
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>
                    )}
                  />
                  <Controller
                    name="assigned_to"
                    control={editForm.control}
                    render={({ field }) => {
                      const selectedMember = members.find((m) => m.id === field.value) ?? null;
                      return (
                        <Autocomplete
                          options={members}
                          getOptionLabel={(m) =>
                            m.first_name || m.last_name
                              ? `${m.first_name} ${m.last_name}`.trim()
                              : m.username
                          }
                          value={selectedMember}
                          onChange={(_, val) => field.onChange(val?.id ?? null)}
                          clearOnEscape
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={t('niches.drawer.assignee')}
                              size="small"
                            />
                          )}
                        />
                      );
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('niches.drawer.ideasBadge', {
                        total: niche.idea_count,
                        approved: niche.approved_idea_count,
                      })}
                    </Typography>
                  </Box>

                  {/* --- Unified AI Research Section --- */}
                  <ResearchSection>
                    <ResearchHeader>
                      <AutoAwesomeIcon sx={{ fontSize: 16, color: COLORS.cyan }} />
                      <Typography variant="subtitle2" fontWeight={600} sx={{ color: COLORS.snow }}>
                        {t('research.drawer.sectionTitle')}
                      </Typography>
                      {isResearchDone && (
                        <CheckCircleOutlineIcon
                          sx={{ fontSize: 16, color: COLORS.successDk, ml: 'auto' }}
                        />
                      )}
                      {isResearchFailed && (
                        <ErrorOutlineIcon
                          sx={{ fontSize: 16, color: COLORS.errorDk, ml: 'auto' }}
                        />
                      )}
                    </ResearchHeader>

                    {/* STATE: Running — show stepper + stop */}
                    {isResearchBusy && researchProgress && (
                      <Stack spacing={1.5}>
                        <ResearchProgressStepper
                          completedNodes={researchProgress.completed_nodes}
                          currentNode={researchProgress.current_node}
                          status={researchStatus!}
                          compact
                        />
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          fullWidth
                          startIcon={<StopCircleIcon sx={{ fontSize: 16 }} />}
                          onClick={handleStopResearch}
                          sx={{
                            borderColor: alpha(COLORS.errorDk, 0.3),
                            '&:hover': { backgroundColor: alpha(COLORS.errorDk, 0.08) },
                          }}
                        >
                          {t('research.stopButton')}
                        </Button>
                      </Stack>
                    )}

                    {/* STATE: Completed — summary + view + re-analyze */}
                    {isResearchDone && researchProgress && (
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap">
                          {researchProgress.marketplace && (
                            <Chip
                              size="small"
                              label={t(`research.marketplace.${researchProgress.marketplace}`, {
                                defaultValue: researchProgress.marketplace,
                              })}
                              variant="outlined"
                              sx={{ borderColor: 'rgba(255,255,255,0.12)', height: 24, fontSize: '0.7rem' }}
                            />
                          )}
                          {researchProgress.product_type && (
                            <Chip
                              size="small"
                              label={t(`research.productType.${researchProgress.product_type}`, {
                                defaultValue: researchProgress.product_type,
                              })}
                              variant="outlined"
                              sx={{ borderColor: 'rgba(255,255,255,0.12)', height: 24, fontSize: '0.7rem' }}
                            />
                          )}
                          <Chip
                            size="small"
                            label={`${researchProgress.completed_nodes.length}/${researchProgress.total_nodes}`}
                            sx={{
                              height: 24,
                              fontSize: '0.7rem',
                              bgcolor: alpha(COLORS.successDk, 0.12),
                              color: COLORS.successDk,
                            }}
                          />
                        </Stack>

                        <Button
                          variant="outlined"
                          size="small"
                          fullWidth
                          endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                          onClick={handleViewResults}
                          sx={{
                            borderColor: alpha(COLORS.cyan, 0.3),
                            color: COLORS.cyan,
                            '&:hover': { backgroundColor: alpha(COLORS.cyan, 0.08) },
                          }}
                        >
                          {t('research.drawer.viewResults')}
                        </Button>

                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Switch
                            size="small"
                            checked={forceRefresh}
                            onChange={(e) => setForceRefresh(e.target.checked)}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: forceRefresh ? COLORS.snow : COLORS.snowMuted,
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                            onClick={() => setForceRefresh(!forceRefresh)}
                          >
                            {t('research.drawer.reAnalyze')}
                          </Typography>
                        </Stack>

                        {forceRefresh && (
                          <StartButton
                            size="small"
                            fullWidth
                            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                            onClick={handleStartResearch}
                          >
                            {t('research.drawer.reAnalyze')}
                          </StartButton>
                        )}
                      </Stack>
                    )}

                    {/* STATE: Failed — error + retry */}
                    {isResearchFailed && researchProgress && (
                      <Stack spacing={1.5}>
                        <Typography variant="caption" sx={{ color: COLORS.errorDk }}>
                          {researchProgress.current_node
                            ? t('research.drawer.failedMessage', {
                                message: `Failed at ${researchProgress.current_node}`,
                              })
                            : t('research.drawer.failedMessage', { message: 'Unknown error' })}
                        </Typography>

                        {retriesExhausted ? (
                          <Typography variant="caption" sx={{ color: COLORS.snowMuted }}>
                            {t('research.drawer.retriesExhausted', { max: 3 })}
                          </Typography>
                        ) : (
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            fullWidth
                            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                            onClick={handleStartResearch}
                            sx={{
                              borderColor: alpha(COLORS.errorDk, 0.3),
                              '&:hover': { backgroundColor: alpha(COLORS.errorDk, 0.08) },
                            }}
                          >
                            {t('research.retryCount', { current: retryCount, max: 3 })}
                          </Button>
                        )}
                      </Stack>
                    )}

                    {/* STATE: No research yet — dropdowns + start */}
                    {!isResearchBusy && !isResearchDone && !isResearchFailed && (
                      <Stack spacing={1.5}>
                        <Stack direction="row" spacing={1}>
                          <TextField
                            select
                            size="small"
                            value={marketplace}
                            onChange={(e) => setMarketplace(e.target.value as Marketplace)}
                            label={t('research.marketplace.label')}
                            fullWidth
                          >
                            {MARKETPLACES.map((m) => (
                              <MenuItem key={m} value={m}>
                                {t(`research.marketplace.${m}`)}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            select
                            size="small"
                            value={productType}
                            onChange={(e) => setProductType(e.target.value as ProductType)}
                            label={t('research.productType.label')}
                            fullWidth
                          >
                            {PRODUCT_TYPES.map((pt) => (
                              <MenuItem key={pt} value={pt}>
                                {t(`research.productType.${pt}`)}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Stack>
                        <StartButton
                          size="small"
                          fullWidth
                          startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                          onClick={handleStartResearch}
                          disabled={isBusy}
                        >
                          {t('research.drawer.startResearch')}
                        </StartButton>
                      </Stack>
                    )}
                  </ResearchSection>
                </>
              )}
            </Stack>
          )}
        </DrawerBody>

        <DrawerFooter>
          {isCreate ? (
            <>
              <Button variant="text" onClick={requestClose} disabled={isBusy}>
                {t('niches.drawer.cancel')}
              </Button>
              <Button
                type="submit"
                form="niche-create-form"
                variant="contained"
                color="primary"
                disabled={isBusy}
              >
                {creating ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {t('niches.drawer.create')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setArchiveDialogOpen(true)}
                disabled={isBusy}
                sx={{ borderColor: alpha(COLORS.errorDk, 0.30), '&:hover': { backgroundColor: alpha(COLORS.errorDk, 0.08) } }}
              >
                {t('niches.drawer.archive')}
              </Button>
              <Button
                type="submit"
                form="niche-edit-form"
                variant="contained"
                color="primary"
                disabled={isBusy}
              >
                {updating ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                {t('niches.drawer.save')}
              </Button>
            </>
          )}
        </DrawerFooter>
      </Drawer>

      {/* Archive confirmation */}
      <Dialog open={archiveDialogOpen} onClose={() => setArchiveDialogOpen(false)} aria-labelledby="archive-drawer-dialog-title">
        <DialogTitle id="archive-drawer-dialog-title">
          {t('niches.drawer.archiveConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('niches.drawer.archiveConfirmBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setArchiveDialogOpen(false)} disabled={deleting}>
            {t('niches.drawer.archiveCancel')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleArchiveConfirm}
            disabled={deleting}
          >
            {t('niches.drawer.archiveConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unsaved changes confirmation */}
      <Dialog open={unsavedDialogOpen} onClose={() => setUnsavedDialogOpen(false)} aria-labelledby="unsaved-dialog-title">
        <DialogTitle id="unsaved-dialog-title">
          {t('niches.drawer.unsavedChangesTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('niches.drawer.unsavedChangesBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setUnsavedDialogOpen(false)}>
            {t('niches.drawer.keepEditing')}
          </Button>
          <Button variant="outlined" color="error" onClick={discardAndClose}>
            {t('niches.drawer.discardChanges')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
