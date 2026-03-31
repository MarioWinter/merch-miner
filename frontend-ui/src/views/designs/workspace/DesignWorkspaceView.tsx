import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import { useTranslation } from 'react-i18next';
import { useGetProjectQuery } from '@/store/designSlice';
import { COLORS, DURATION, EASING } from '@/style/constants';
import NicheBindingSelector from '../board/partials/NicheBindingSelector';
import DesignEditorView from '../editor/DesignEditorView';
import useWorkspaceTab from './hooks/useWorkspaceTab';
import type { WorkspaceTab } from './hooks/useWorkspaceTab';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const WorkspaceRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100vh - 56px)',
  margin: '-24px',
  overflow: 'hidden',
});

const HeaderBar = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  height: 56,
  flexShrink: 0,
  paddingLeft: theme.spacing(2),
  paddingRight: theme.spacing(2),
  borderBottom: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.inkPaper,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

const TabButton = styled('button', {
  shouldForwardProp: (p) => p !== '$active',
})<{ $active: boolean }>(({ theme, $active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 16px',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  backgroundColor: $active ? alpha(COLORS.red, 0.12) : 'transparent',
  color: $active
    ? theme.vars.palette.primary.main
    : theme.vars.palette.text.secondary,
  boxShadow: $active ? `0 0 12px ${alpha(COLORS.red, 0.18)}` : 'none',
  ...theme.applyStyles('light', {
    backgroundColor: $active ? alpha(COLORS.red, 0.08) : 'transparent',
  }),
  '&:hover': {
    backgroundColor: $active
      ? alpha(COLORS.red, 0.16)
      : theme.vars.palette.action.hover,
    color: $active
      ? theme.vars.palette.primary.main
      : theme.vars.palette.text.primary,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.vars.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

const TabGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: 4,
  borderRadius: 10,
  backgroundColor: COLORS.ink,
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.ash,
  }),
}));

const ContentArea = styled(Box)({
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
});

const PlaceholderPane = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  gap: theme.spacing(2),
  color: theme.vars.palette.text.secondary,
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const DesignWorkspaceView = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useWorkspaceTab();

  const {
    data: project,
    isLoading,
    isError,
  } = useGetProjectQuery(projectId ?? '', { skip: !projectId });

  // -- Loading --
  if (isLoading) {
    return (
      <WorkspaceRoot>
        <HeaderBar>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width={200} height={28} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="rounded" width={260} height={32} />
        </HeaderBar>
        <ContentArea>
          <Skeleton
            variant="rectangular"
            sx={{ width: '100%', height: '100%' }}
          />
        </ContentArea>
      </WorkspaceRoot>
    );
  }

  // -- Error --
  if (isError || !projectId) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{t('design.workspace.loadError')}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/designs')}
          sx={{ mt: 2 }}
        >
          {t('design.workspace.backToGallery')}
        </Button>
      </Box>
    );
  }

  return (
    <WorkspaceRoot>
      {/* ---- Header ---- */}
      <HeaderBar>
        <Tooltip title={t('design.workspace.backToGallery')}>
          <IconButton
            onClick={() => navigate('/designs')}
            size="small"
            aria-label={t('design.workspace.backToGallery')}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>

        <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
          {project?.name ?? t('design.workspace.untitled')}
        </Typography>

        {project && (
          <NicheBindingSelector
            projectId={projectId}
            currentNicheId={project.niche}
            currentNicheName={project.niche_summary?.name ?? null}
          />
        )}

        <Box sx={{ flex: 1 }} />

        {/* Tab toggle group */}
        <TabGroup>
          <TabToggle
            tab="canvas"
            icon={<AutoFixHighIcon sx={{ fontSize: 16 }} />}
            label={t('design.workspace.tabCanvas')}
            active={activeTab === 'canvas'}
            onClick={setActiveTab}
          />
          <TabToggle
            tab="editor"
            icon={<BuildOutlinedIcon sx={{ fontSize: 16 }} />}
            label={t('design.workspace.tabEditor')}
            active={activeTab === 'editor'}
            onClick={setActiveTab}
          />
        </TabGroup>

        <Tooltip title={t('design.workspace.settings')}>
          <IconButton size="small" aria-label={t('design.workspace.settings')}>
            <SettingsOutlinedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </HeaderBar>

      {/* ---- Content ---- */}
      <ContentArea>
        {activeTab === 'canvas' ? (
          <CanvasPlaceholder />
        ) : (
          <DesignEditorView />
        )}
      </ContentArea>
    </WorkspaceRoot>
  );
};

// -----------------------------------------------------------------
// TabToggle (extracted for readability)
// -----------------------------------------------------------------

interface TabToggleProps {
  tab: WorkspaceTab;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: (tab: WorkspaceTab) => void;
}

const TabToggle = ({ tab, icon, label, active, onClick }: TabToggleProps) => (
  <TabButton
    $active={active}
    onClick={() => onClick(tab)}
    aria-pressed={active}
    role="tab"
  >
    {icon}
    {label}
  </TabButton>
);

// -----------------------------------------------------------------
// Canvas Placeholder (Phase E will replace)
// -----------------------------------------------------------------

const CanvasPlaceholder = () => {
  const { t } = useTranslation();

  return (
    <PlaceholderPane>
      <AutoFixHighIcon sx={{ fontSize: 64, opacity: 0.3 }} />
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        {t('design.workspace.canvasComingSoon')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('design.workspace.canvasDescription')}
      </Typography>
    </PlaceholderPane>
  );
};

export default DesignWorkspaceView;
