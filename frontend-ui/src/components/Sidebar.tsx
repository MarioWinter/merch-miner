import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from '@mui/material';
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
import { alpha } from '@mui/material/styles';
import { COLORS, DURATION, EASING } from '../style/constants';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavSection {
  sectionKey: string;
  items: NavItem[];
}

const EXPANDED_WIDTH = 220;
const COLLAPSED_WIDTH = 60;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
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

  function isActive(path: string) {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item.path);

    const button = (
      <ListItemButton
        key={item.path}
        onClick={() => navigate(item.path)}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        sx={{
          height: 40,
          px: effectiveCollapsed ? 0 : 2,
          mx: 1,
          borderRadius: '8px',
          mb: '2px',
          gap: 1.5,
          justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
          bgcolor: active ? alpha(COLORS.red, 0.12) : 'transparent',
          color: active ? 'primary.main' : 'text.secondary',
          borderLeft: active ? '2px solid' : '2px solid transparent',
          borderColor: active ? 'primary.main' : 'transparent',
          '&:hover': {
            bgcolor: active ? 'rgba(255,90,79,0.12)' : 'action.hover',
            color: active ? 'primary.main' : 'text.primary',
          },
          transition: `background-color ${DURATION.fast}ms ${EASING.standard}, color ${DURATION.fast}ms ${EASING.standard}, padding ${DURATION.default}ms ${EASING.standard}`,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            color: 'inherit',
            flexShrink: 0,
          }}
        >
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            variant: 'body2',
            fontWeight: 500,
            noWrap: true,
          }}
          sx={{
            opacity: effectiveCollapsed ? 0 : 1,
            width: effectiveCollapsed ? 0 : 'auto',
            overflow: 'hidden',
            transition: `opacity ${DURATION.default}ms ${EASING.standard}, width ${DURATION.default}ms ${EASING.standard}`,
            m: 0,
          }}
        />
      </ListItemButton>
    );

    if (effectiveCollapsed) {
      return (
        <Tooltip key={item.path} title={item.label} placement="right">
          {button}
        </Tooltip>
      );
    }

    return button;
  }

  return (
    <Box
      component="nav"
      aria-label={t('nav.sidebarLabel')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={(theme) => ({
        position: 'fixed',
        top: 56,
        left: 0,
        bottom: 0,
        width: effectiveCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        bgcolor: alpha(COLORS.white, 0.85),
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid',
        borderColor: 'divider',
        pt: 2,
        pb: 1.5,
        display: 'flex',
        flexDirection: 'column',
        transition: `width ${DURATION.default}ms ${EASING.standard}`,
        overflow: 'visible',
        zIndex: theme.zIndex.drawer,
        '&:hover .sidebar-toggle': { opacity: 1 },
        ...theme.applyStyles('dark', {
          bgcolor: alpha(COLORS.inkPaper, 0.75),
        }),
      })}
    >
      {/* Nav sections */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
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
            {/* Section label — animates via grid-template-rows (no layout jump) */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateRows: effectiveCollapsed ? '0fr' : '1fr',
                transition: `grid-template-rows ${DURATION.default}ms ${EASING.standard}`,
              }}
            >
              <Box sx={{ overflow: 'hidden' }}>
                <Typography
                  variant="overline"
                  sx={{
                    display: 'block',
                    px: 3,
                    pt: 1,
                    pb: 0.5,
                    opacity: effectiveCollapsed ? 0 : 1,
                    color: alpha(COLORS.red, 0.60),
                    userSelect: 'none',
                    transition: `opacity ${DURATION.default}ms ${EASING.standard}`,
                  }}
                >
                  {sectionLabels[section.sectionKey]}
                </Typography>
              </Box>
            </Box>
            <List disablePadding>
              {section.items.map(renderNavItem)}
            </List>
          </Box>
        ))}
      </Box>

      {/* Sidebar toggle tab */}
      <Box
        className="sidebar-toggle"
        sx={{
          position: 'absolute',
          bottom: 40,
          right: -16,
          width: 32,
          height: 52,
          zIndex: 1,
          opacity: collapsed ? 0 : 1,
          transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
        }}
      >
        {/* Tab body */}
        <IconButton
          onClick={onToggle}
          size="small"
          aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '8px 0 0 8px',
            bgcolor: 'background.default',
            color: 'text.secondary',
            borderTop: 'none',
            borderLeft: '1px solid',
            borderBottom: 'none',
            borderRight: 'none',
            borderColor: 'divider',
            position: 'relative',
            overflow: 'visible',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: -1,
              left: 8,
              width: 'calc(50% - 8px)',
              height: '1px',
              backgroundColor: 'divider',
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: -1,
              left: 8,
              width: 'calc(50% - 8px)',
              height: '1px',
              backgroundColor: 'divider',
            },
            boxShadow: 'none',
            outline: 'none',
            '&:hover': {
              bgcolor: 'background.default',
            },
            '& .MuiTouchRipple-root': {
              display: 'none',
            },
          }}
        >
          {effectiveCollapsed
            ? <ChevronRightIcon sx={{ fontSize: 30 }} />
            : <ChevronLeftIcon sx={{ fontSize: 30 }} />}
        </IconButton>
      </Box>
    </Box>
  );
}

export { EXPANDED_WIDTH, COLLAPSED_WIDTH };
