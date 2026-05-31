import { useNavigate } from 'react-router-dom';
import { Stack, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import { useTranslation } from 'react-i18next';
import type { SvgIconComponent } from '@mui/icons-material';
import { COLORS } from '@/style/constants';

interface AnchorNavItem {
  id: string;
  labelKey: string;
  Icon: SvgIconComponent;
}

interface SettingsAnchorNavProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

const NAV_ITEMS: AnchorNavItem[] = [
  { id: 'profile', labelKey: 'settings.nav.profile', Icon: PersonOutlinedIcon },
  { id: 'billing', labelKey: 'settings.nav.billing', Icon: CreditCardOutlinedIcon },
  { id: 'workspace', labelKey: 'settings.nav.workspace', Icon: GroupsOutlinedIcon },
  { id: 'usage', labelKey: 'settings.nav.usage', Icon: BarChartOutlinedIcon },
];

// Sticky outer wrapper — stays in view as the right column scrolls.
const StickyNav = styled('nav')(({ theme }) => ({
  position: 'sticky',
  // 56px topbar + 24px breathing room
  top: 80,
  width: 220,
  flexShrink: 0,
  padding: theme.spacing(1.5, 0),
}));

interface AnchorLinkProps {
  $active: boolean;
}

const AnchorLink = styled('a', {
  shouldForwardProp: (prop) => prop !== '$active',
})<AnchorLinkProps>(({ theme, $active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  padding: theme.spacing(1, 1.5),
  borderRadius: 8,
  textDecoration: 'none',
  // alpha() can't operate on CSS-var color strings, so we use the static
  // brand red from design-system constants for the subtle accent tint.
  color: $active
    ? theme.vars.palette.primary.main
    : theme.vars.palette.text.secondary,
  backgroundColor: $active ? alpha(COLORS.red, 0.12) : 'transparent',
  borderLeft: $active
    ? `2px solid ${theme.vars.palette.primary.main}`
    : '2px solid transparent',
  fontWeight: $active ? 600 : 500,
  fontSize: '0.875rem',
  transition: 'background-color 150ms ease, color 150ms ease',
  cursor: 'pointer',
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

const SettingsAnchorNav = ({ activeId, onSelect }: SettingsAnchorNavProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    navigate({ hash: `#${id}` }, { replace: false });
    onSelect(id);
  };

  return (
    <StickyNav aria-label={t('settings.nav.label')}>
      <Typography
        variant="overline"
        sx={{ display: 'block', px: 1.5, mb: 1, color: 'text.secondary' }}
      >
        {t('settings.nav.aria_jumpto')}
      </Typography>
      <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {NAV_ITEMS.map(({ id, labelKey, Icon }) => {
          const isActive = activeId === id;
          return (
            <li key={id}>
              <AnchorLink
                href={`#${id}`}
                onClick={(e) => handleClick(e, id)}
                $active={isActive}
                aria-current={isActive ? 'true' : undefined}
              >
                <Icon sx={{ fontSize: 18 }} />
                <span>{t(labelKey)}</span>
              </AnchorLink>
            </li>
          );
        })}
      </Stack>
    </StickyNav>
  );
};

export default SettingsAnchorNav;
