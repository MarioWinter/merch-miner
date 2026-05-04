import { useEffect, type ReactNode } from 'react';
import { Alert, Box, Container } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GlobalFooter from '../GlobalFooter/GlobalFooter';
import FloatingIconButton from '../FloatingIconButton';

interface LegalLayoutProps {
  children: ReactNode;
  documentTitle: string;
}

const PageRoot = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: theme.vars.palette.background.default,
  color: theme.vars.palette.text.primary,
}));

const PageContent = styled(Box)(({ theme }) => ({
  flex: 1,
  width: '100%',
  paddingTop: theme.spacing(6),
  paddingBottom: theme.spacing(8),
  [theme.breakpoints.down('sm')]: {
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(4),
  },
}));

const ContentContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const DisclaimerAlert = styled(Alert)(({ theme }) => ({
  background: 'transparent',
  border: `1px solid ${theme.vars.palette.info.main}`,
  borderLeft: `4px solid ${theme.vars.palette.info.main}`,
  color: theme.vars.palette.text.primary,
  borderRadius: 8,
  fontSize: '0.8125rem',
  '& .MuiAlert-icon': {
    color: theme.vars.palette.info.main,
  },
}));

const LegalLayout = ({ children, documentTitle }: LegalLayoutProps) => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const isGerman = i18n.language?.toLowerCase().startsWith('de');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = documentTitle;
    return () => {
      document.title = previousTitle;
    };
  }, [documentTitle]);

  // Navigate back to the previous page; fall back to home when this entry
  // is the user's first navigation (e.g. external link / fresh tab) so the
  // button never leaves the user stranded.
  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <PageRoot>
      <FloatingIconButton
        onClick={handleBack}
        ariaLabel={t('common.back', 'Back')}
        sx={{ position: 'fixed', top: 16, left: 16 }}
      >
        <ArrowBackIcon sx={{ fontSize: 22 }} />
      </FloatingIconButton>
      <PageContent>
        <ContentContainer maxWidth="md">
          {!isGerman && (
            <DisclaimerAlert severity="info" role="note">
              {t(
                'legal.translation_disclaimer',
                'This is a translation. In case of dispute, the German version applies.',
              )}
            </DisclaimerAlert>
          )}
          {children}
        </ContentContainer>
      </PageContent>

      <GlobalFooter />
    </PageRoot>
  );
};

export default LegalLayout;
