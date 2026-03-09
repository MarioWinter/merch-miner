import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  List,
  ListItemIcon,
  Tooltip,
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
import {
  SidebarRoot,
  NavScrollBox,
  NavItemButton,
  NavItemText,
  SectionLabel,
  ToggleWrap,
  ToggleButton,
} from './sidebar/Sidebar.styles';

export const EXPANDED_WIDTH = 220;
export const COLLAPSED_WIDTH = 60;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface NavSection {
  sectionKey: string;
  items: NavItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onHoverChange?: (hovered: boolean) => void;
}

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
        <NavItemText
          primary={item.label}
          primaryTypographyProps={{ variant: 'body2', fontWeight: 500, noWrap: true }}
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
      {/* Nav sections */}
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
            <Box sx={{
              display: 'grid',
              gridTemplateRows: effectiveCollapsed ? '0fr' : '1fr',
              transition: `grid-template-rows 200ms cubic-bezier(0.4, 0.0, 0.2, 1)`,
            }}>
              <Box sx={{ overflow: 'hidden' }}>
                <SectionLabel variant="overline" $collapsed={effectiveCollapsed}>
                  {sectionLabels[section.sectionKey]}
                </SectionLabel>
              </Box>
            </Box>
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
