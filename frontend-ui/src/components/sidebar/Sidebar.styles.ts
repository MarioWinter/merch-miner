import React from 'react';
import { styled } from '@mui/material/styles';
import { alpha } from '@mui/material';
import Box from '@mui/material/Box';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { COLORS, DURATION, EASING } from '@/style/constants';

// ------------------------------------------------------------------
// Sidebar root nav box
// ------------------------------------------------------------------

interface SidebarRootProps {
  $collapsed: boolean;
  component?: React.ElementType;
}

export const SidebarRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$collapsed',
})<SidebarRootProps>(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  backgroundColor: alpha(COLORS.white, 0.85),
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderRight: '1px solid',
  borderColor: theme.palette.divider,
  paddingTop: 'calc(56px + 16px)',
  paddingBottom: theme.spacing(1.5),
  display: 'flex',
  flexDirection: 'column',
  overflow: 'visible',
  zIndex: theme.zIndex.drawer,
  transition: `width ${DURATION.default}ms ${EASING.standard}`,
  '&:hover .sidebar-toggle': { opacity: 1 },
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(COLORS.inkPaper, 0.75),
  }),
}));

// ------------------------------------------------------------------
// Scrollable nav content area
// ------------------------------------------------------------------

export const NavScrollBox = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
});

// ------------------------------------------------------------------
// Nav item button
// ------------------------------------------------------------------

interface NavItemButtonProps {
  $active: boolean;
  $collapsed: boolean;
}

export const NavItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== '$active' && prop !== '$collapsed',
})<NavItemButtonProps>(({ theme, $active, $collapsed }) => ({
  height: 40,
  paddingLeft: $collapsed ? 12 : 16,
  paddingRight: $collapsed ? 12 : 16,
  marginLeft: 8,
  marginRight: 8,
  borderRadius: 8,
  marginBottom: 2,
  gap: $collapsed ? 0 : 12,
  backgroundColor: $active ? alpha(COLORS.red, 0.12) : 'transparent',
  color: $active ? theme.palette.primary.main : theme.palette.text.secondary,
  borderLeft: '2px solid',
  borderColor: $active ? theme.palette.primary.main : 'transparent',
  overflow: 'hidden',
  minWidth: 0,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}, color ${DURATION.fast}ms ${EASING.standard}, padding ${DURATION.default}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: $active ? alpha(COLORS.red, 0.12) : theme.palette.action.hover,
    color: $active ? theme.palette.primary.main : theme.palette.text.primary,
  },
}));

// ------------------------------------------------------------------
// Nav item label text
// ------------------------------------------------------------------

interface NavItemTextProps {
  $collapsed: boolean;
}

export const NavItemText = styled(ListItemText, {
  shouldForwardProp: (prop) => prop !== '$collapsed',
})<NavItemTextProps>(({ $collapsed }) => ({
  opacity: $collapsed ? 0 : 1,
  width: $collapsed ? 0 : 'auto',
  overflow: 'hidden',
  margin: 0,
  transition: `opacity ${DURATION.default}ms ${EASING.standard}, width ${DURATION.default}ms ${EASING.standard}`,
}));

// ------------------------------------------------------------------
// Section label typography
// ------------------------------------------------------------------

interface SectionLabelProps {
  $collapsed: boolean;
}

export const SectionLabel = styled(Typography, {
  shouldForwardProp: (prop) => prop !== '$collapsed',
})<SectionLabelProps>(({ $collapsed }) => ({
  display: 'block',
  paddingLeft: 24,
  paddingRight: 24,
  paddingTop: 8,
  paddingBottom: 4,
  opacity: $collapsed ? 0 : 1,
  color: alpha(COLORS.red, 0.60),
  userSelect: 'none',
  transition: `opacity ${DURATION.default}ms ${EASING.standard}`,
}));

// ------------------------------------------------------------------
// Toggle button outer ring container
// ------------------------------------------------------------------

interface ToggleWrapProps {
  $visible: boolean;
}

export const ToggleWrap = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$visible',
})<ToggleWrapProps>(({ theme, $visible }) => ({
  position: 'absolute',
  bottom: 40,
  right: -24,
  width: 48,
  height: 48,
  zIndex: 1,
  borderRadius: '50%',
  backgroundColor: theme.palette.background.default,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: $visible ? 1 : 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '1px solid',
    borderColor: theme.palette.divider,
    clipPath: 'inset(-1px 50% -1px -1px)',
    pointerEvents: 'none',
  },
}));

// ------------------------------------------------------------------
// Toggle icon button
// ------------------------------------------------------------------

export const ToggleButton = styled(IconButton)({
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
