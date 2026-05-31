import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Stack,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import { useTranslation } from 'react-i18next';
import type { SvgIconComponent } from '@mui/icons-material';

interface AnchorNavItem {
  id: string;
  labelKey: string;
  Icon: SvgIconComponent;
}

interface SettingsAnchorAccordionProps {
  activeId: string | null;
  onSelect: (id: string) => void;
}

const NAV_ITEMS: AnchorNavItem[] = [
  { id: 'profile', labelKey: 'settings.nav.profile', Icon: PersonOutlinedIcon },
  { id: 'billing', labelKey: 'settings.nav.billing', Icon: CreditCardOutlinedIcon },
  { id: 'workspace', labelKey: 'settings.nav.workspace', Icon: GroupsOutlinedIcon },
  { id: 'usage', labelKey: 'settings.nav.usage', Icon: BarChartOutlinedIcon },
];

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
  color: $active
    ? theme.vars.palette.primary.main
    : theme.vars.palette.text.secondary,
  // alpha() can't operate on CSS-var color strings reliably (memory
  // feedback_color_bug.md pattern b). Use the static brand-red token + a
  // theme.vars action color for hover so both schemes look right.
  backgroundColor: $active ? alpha(COLORS.red, 0.12) : 'transparent',
  fontWeight: $active ? 600 : 500,
  fontSize: '0.875rem',
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

const SettingsAnchorAccordion = ({ activeId, onSelect }: SettingsAnchorAccordionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const activeItem = NAV_ITEMS.find((item) => item.id === activeId) ?? NAV_ITEMS[0];

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    navigate({ hash: `#${id}` }, { replace: false });
    onSelect(id);
    setExpanded(false);
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={(_event, isExpanded) => setExpanded(isExpanded)}
      disableGutters
      square
      sx={{ mb: 2, borderRadius: 1, '&::before': { display: 'none' } }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-label={t('settings.nav.aria_jumpto')}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <activeItem.Icon sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t(activeItem.labelKey)}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
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
      </AccordionDetails>
    </Accordion>
  );
};

export default SettingsAnchorAccordion;
