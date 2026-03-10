import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { alpha } from '@mui/material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

export const EXPANDED_WIDTH = 220;
export const COLLAPSED_WIDTH = 60;

// ------------------------------------------------------------------
// Styled components (inlined — no separate Sidebar.styles.ts)
// ------------------------------------------------------------------

const SidebarRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$collapsed',
})<{ $collapsed: boolean; component?: React.ElementType }>(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  backgroundColor: COLORS.white,
  borderRight: '1px solid',
  borderColor: theme.vars!.palette.divider,
  ...theme.applyStyles('dark', {
    backgroundColor: COLORS.inkPaper,
  }),
  paddingTop: 'calc(56px + 16px)',
  paddingBottom: theme.spacing(1.5),
  display: 'flex',
  flexDirection: 'column',
  overflow: 'visible',
  zIndex: theme.zIndex.drawer,
  transition: `width ${DURATION.default}ms ${EASING.standard}`,
  '&:hover .sidebar-toggle': { opacity: 1 },
}));

const NavScrollBox = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
});

const NavItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== '$active' && prop !== '$collapsed',
})<{ $active: boolean; $collapsed: boolean }>(({ theme, $active, $collapsed }) => ({
  height: 40,
  paddingLeft: $collapsed ? 12 : 16,
  paddingRight: $collapsed ? 12 : 16,
  marginLeft: 8,
  marginRight: 8,
  borderRadius: 8,
  marginBottom: 2,
  gap: $collapsed ? 0 : 12,
  backgroundColor: $active ? alpha(COLORS.red, 0.12) : 'transparent',
  color: $active ? theme.vars!.palette.primary.main : theme.vars!.palette.text.secondary,
  borderLeft: '2px solid',
  borderColor: $active ? theme.vars!.palette.primary.main : 'transparent',
  overflow: 'hidden',
  minWidth: 0,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}, color ${DURATION.fast}ms ${EASING.standard}, padding ${DURATION.default}ms ${EASING.standard}, gap ${DURATION.default}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: $active ? alpha(COLORS.red, 0.12) : theme.vars!.palette.action.hover,
    color: $active ? theme.vars!.palette.primary.main : theme.vars!.palette.text.primary,
  },
}));

// maxWidth animation avoids the layout-shift that width:0 can cause
const NavText = styled(ListItemText, {
  shouldForwardProp: (prop) => prop !== '$collapsed',
})<{ $collapsed: boolean }>(({ $collapsed }) => ({
  opacity: $collapsed ? 0 : 1,
  maxWidth: $collapsed ? 0 : 200,
  overflow: 'hidden',
  margin: 0,
  whiteSpace: 'nowrap',
  transition: `opacity ${DURATION.default}ms ${EASING.standard}, max-width ${DURATION.default}ms ${EASING.standard}`,
}));

// Always occupies the same vertical space — no display:none or height:0
const SectionHeaderSlot = styled(Box)({
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 8,
  paddingBottom: 4,
  display: 'block',
});

// Visually hidden when collapsed but stays in the layout flow
const SectionHeaderText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$collapsed',
})<{ $collapsed: boolean }>(({ $collapsed }) => ({
  display: 'block',
  opacity: $collapsed ? 0 : 1,
  transform: $collapsed ? 'translateX(-8px)' : 'translateX(0px)',
  pointerEvents: $collapsed ? 'none' : 'auto',
  color: alpha(COLORS.red, 0.60),
  userSelect: 'none',
  transition: `opacity ${DURATION.default}ms ${EASING.standard}, transform ${DURATION.default}ms ${EASING.standard}`,
}));

const ToggleWrap = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$visible',
})<{ $visible: boolean }>(({ theme, $visible }) => ({
  position: 'absolute',
  bottom: 40,
  right: -24,
  width: 48,
  height: 48,
  zIndex: 1,
  borderRadius: '50%',
  backgroundColor: COLORS.ashDefault,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: $visible ? 1 : 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  ...theme.applyStyles('dark', {
    backgroundColor: COLORS.ink,
  }),
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '1px solid',
    borderColor: theme.vars?.palette.divider ?? theme.palette.divider,
    clipPath: 'inset(-1px 50% -1px -1px)',
    pointerEvents: 'none',
  },
}));

const ToggleButton = styled(IconButton)({
  width: 28,
  height: 28,
  borderRadius: '50%',
  backgroundColor: COLORS.red,
  color: '#fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  '&:hover': {
    backgroundColor: COLORS.redDk,
  },
});

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavSection {
  sectionKey: string;
  items: NavItem[];
}

export interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

const Sidebar = ({ collapsed, onToggle, onHoverChange }: SidebarProps) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  // effectiveCollapsed drives all visual logic:
  // locked open (!collapsed) → always expanded; unlocked → expand on hover only
  const effectiveCollapsed = collapsed && !hovered;

  const sections: NavSection[] = [
    {
      sectionKey: 'controlRoom',
      items: [
        { label: t('nav.dashboard'), path: '/dashboard', icon: <DashboardOutlinedIcon sx={{ fontSize: 20 }} /> },
        { label: t('nav.reports'), path: '/reports', icon: <BarChartOutlinedIcon sx={{ fontSize: 20 }} /> },
      ],
    },
    {
      sectionKey: 'pipeline',
      items: [
        { label: t('nav.niches'), path: '/niches', icon: <ListAltOutlinedIcon sx={{ fontSize: 20 }} /> },
        { label: t('nav.research'), path: '/research', icon: <SearchOutlinedIcon sx={{ fontSize: 20 }} /> },
        { label: t('nav.slogans'), path: '/slogans', icon: <LightbulbOutlinedIcon sx={{ fontSize: 20 }} /> },
        { label: t('nav.designs'), path: '/designs', icon: <BrushOutlinedIcon sx={{ fontSize: 20 }} /> },
        { label: t('nav.listings'), path: '/listings', icon: <ArticleOutlinedIcon sx={{ fontSize: 20 }} /> },
      ],
    },
    {
      sectionKey: 'drillingZone',
      items: [
        { label: t('nav.amazonResearch'), path: '/amazon/research', icon: <QueryStatsOutlinedIcon sx={{ fontSize: 20 }} /> },
        { label: t('nav.keywords'), path: '/amazon/keywords', icon: <VpnKeyOutlinedIcon sx={{ fontSize: 20 }} /> },
      ],
    },
    {
      sectionKey: 'surfaceOps',
      items: [
        { label: t('nav.uploads'), path: '/uploads', icon: <CloudUploadOutlinedIcon sx={{ fontSize: 20 }} /> },
        { label: t('nav.kanban'), path: '/kanban', icon: <ViewKanbanOutlinedIcon sx={{ fontSize: 20 }} /> },
      ],
    },
  ];

  const sectionLabels: Record<string, string> = {
    controlRoom: t('nav.sections.controlRoom'),
    pipeline: t('nav.sections.pipeline'),
    drillingZone: t('nav.sections.drillingZone'),
    surfaceOps: t('nav.sections.surfaceOps'),
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);

    const button = (
      <NavItemButton
        key={item.path}
        onClick={() => navigate(item.path)}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        $active={active}
        $collapsed={effectiveCollapsed}
      >
        <ListItemIcon sx={{ minWidth: 0, color: 'inherit', flexShrink: 0 }}>
          {item.icon}
        </ListItemIcon>
        <NavText
          primary={item.label}
          slotProps={{ primary: { variant: 'body2', fontWeight: 500, noWrap: true } }}
          $collapsed={effectiveCollapsed}
        />
      </NavItemButton>
    );

    if (effectiveCollapsed) {
      return (
        <Tooltip key={item.path} title={item.label} placement="right">
          {button}
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <SidebarRoot
      component="nav"
      aria-label={t('nav.sidebarLabel')}
      $collapsed={effectiveCollapsed}
      sx={{ width: effectiveCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      onMouseEnter={() => { setHovered(true); onHoverChange?.(true); }}
      onMouseLeave={() => { setHovered(false); onHoverChange?.(false); }}
    >
      <NavScrollBox>
        {sections.map((section, index) => (
          <Box key={section.sectionKey} sx={{ mb: 1 }}>
            {index > 0 && (
              <Box
                sx={{
                  mx: 3,
                  mb: 1,
                  height: '1px',
                  opacity: 0.4,
                  background: (theme) => {
                    const disabledTextColor = theme.vars?.palette.text.disabled ?? theme.palette.text.disabled;
                    return `linear-gradient(to right, transparent, ${disabledTextColor} 25%, ${disabledTextColor} 75%, transparent)`;
                  },
                }}
              />
            )}
            {/* SectionHeaderSlot always occupies the same height — no jump when collapsing */}
            <SectionHeaderSlot>
              <SectionHeaderText variant="overline" $collapsed={effectiveCollapsed}>
                {sectionLabels[section.sectionKey]}
              </SectionHeaderText>
            </SectionHeaderSlot>
            <List disablePadding>
              {section.items.map(renderNavItem)}
            </List>
          </Box>
        ))}
      </NavScrollBox>

      {/* Sidebar toggle — round button with cutout ring */}
      <ToggleWrap className="sidebar-toggle" $visible={!collapsed}>
        <ToggleButton
          onClick={onToggle}
          size="small"
          aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
        >
          {effectiveCollapsed
            ? <ChevronRightIcon sx={{ fontSize: 18 }} />
            : <ChevronLeftIcon sx={{ fontSize: 18 }} />}
        </ToggleButton>
      </ToggleWrap>
    </SidebarRoot>
  );
};

export default Sidebar;
