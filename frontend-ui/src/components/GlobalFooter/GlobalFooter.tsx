import { Link as RouterLink } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

// Styled components

const FooterRoot = styled('footer')(({ theme }) => ({
  width: '100%',
  minHeight: 48,
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
  paddingLeft: theme.spacing(3),
  paddingRight: theme.spacing(3),
  display: 'flex',
  alignItems: 'center',
  background: theme.vars.palette.background.paper,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  boxSizing: 'border-box',
  flexShrink: 0,
  [theme.breakpoints.down('sm')]: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
}));

const FooterRow = styled(Stack)(({ theme }) => ({
  width: '100%',
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    flexDirection: 'column',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
}));

const LeftZone = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  [theme.breakpoints.down('sm')]: {
    display: 'none',
  },
}));

// `component="nav"` directly via styled('nav') — keeps semantic HTML without
// fighting MUI v7's stricter Stack typing where the `component` prop is no
// longer surfaced via styled() wrappers.
const CenterZone = styled('nav')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(3),
  flexShrink: 0,
  flexWrap: 'wrap',
  justifyContent: 'center',
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(2),
  },
}));

const RightZone = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  [theme.breakpoints.down('sm')]: {
    flex: 'unset',
    justifyContent: 'center',
  },
}));

// Wrap RouterLink directly so we keep `to` typing without going through
// MUI Link's `component` prop (which loses the override-component type
// information once it travels through styled()).
const FooterLink = styled(RouterLink)(({ theme }) => ({
  color: theme.vars.palette.text.secondary,
  fontSize: '0.8125rem',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'color 150ms ease',
  '&:hover': {
    color: theme.vars.palette.primary.main,
    textDecoration: 'none',
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.vars.palette.primary.main}`,
    outlineOffset: 2,
    borderRadius: 4,
  },
}));

const CopyrightText = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.secondary,
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
}));

// Component

const GlobalFooter = () => {
  const { t } = useTranslation();

  return (
    <FooterRoot role="contentinfo" aria-label={t('footer.aria', 'Site footer')}>
      <FooterRow>
        <LeftZone aria-hidden="true" />

        <CenterZone aria-label={t('footer.legalNavLabel', 'Legal')}>
          <FooterLink to="/legal/imprint">
            {t('footer.imprint', 'Imprint')}
          </FooterLink>
          <FooterLink to="/legal/privacy">
            {t('footer.privacy', 'Privacy')}
          </FooterLink>
        </CenterZone>

        <RightZone>
          <CopyrightText variant="caption">
            {t('footer.copyright', '© 2026 - Merch Miner')}
          </CopyrightText>
        </RightZone>
      </FooterRow>
    </FooterRoot>
  );
};

export default GlobalFooter;
