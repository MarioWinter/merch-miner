import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Stack } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { styled, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import ProfileSection from './profile/ProfileSection';
import BillingSection from './billing/BillingSection';
import WorkspaceSection from './workspace/WorkspaceSection';
import UsageSection from './usage/UsageSection';
import SettingsAnchorNav from './partials/SettingsAnchorNav';
import SettingsAnchorAccordion from './partials/SettingsAnchorAccordion';
import { useActiveSection } from './hooks/useActiveSection';

// Section ids must match the order users see and the anchor-nav target list.
const SECTION_IDS = ['profile', 'billing', 'workspace', 'usage'] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTIONS: { id: SectionId; Component: React.ComponentType }[] = [
  { id: 'profile', Component: ProfileSection },
  { id: 'billing', Component: BillingSection },
  { id: 'workspace', Component: WorkspaceSection },
  { id: 'usage', Component: UsageSection },
];

// Each section gets scroll-margin-top so anchor jumps land below the 56px
// topbar (plus a comfort offset). Sections render in a column with vertical
// rhythm; the column max-width keeps form fields readable.
const SectionAnchor = styled('section')(({ theme }) => ({
  scrollMarginTop: 80,
  marginBottom: theme.spacing(6),
}));

const ContentColumn = styled(Box)({
  flex: 1,
  minWidth: 0,
  maxWidth: 720,
});

const SettingsLayout = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const theme = useTheme();
  // Below md → mobile accordion. Above md → sticky vertical nav.
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const sectionIds = useMemo(() => SECTION_IDS.slice(), []);
  const activeId = useActiveSection(sectionIds);

  // Set the singular page title per AC-6-7.
  useEffect(() => {
    const previous = document.title;
    document.title = `${t('settings.title')} — Merch Miner`;
    return () => {
      document.title = previous;
    };
  }, [t]);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) {
      return;
    }
    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    el.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    });
  }, []);

  // Initial deep-link handling — if the URL arrives with `#workspace` etc,
  // wait one frame so all sections have mounted, then scroll into view.
  const initialHashHandled = useRef(false);
  useEffect(() => {
    if (initialHashHandled.current) {
      return;
    }
    const raw = location.hash.replace(/^#/, '');
    if (raw && SECTION_IDS.includes(raw as SectionId)) {
      initialHashHandled.current = true;
      // Two RAFs to let MUI layout settle (some sections render skeletons
      // first, which would otherwise be the scroll target before they grow).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToSection(raw));
      });
    }
  }, [location.hash, scrollToSection]);

  return (
    <Box sx={{ width: '100%', maxWidth: 1080, mx: 'auto' }}>
      {isMobile && (
        <SettingsAnchorAccordion activeId={activeId} onSelect={scrollToSection} />
      )}

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 0, md: 4 }}
        alignItems="flex-start"
      >
        {!isMobile && (
          <SettingsAnchorNav activeId={activeId} onSelect={scrollToSection} />
        )}
        <ContentColumn>
          {SECTIONS.map(({ id, Component }) => (
            <SectionAnchor key={id} id={id} aria-labelledby={`${id}-heading`}>
              <Component />
            </SectionAnchor>
          ))}
        </ContentColumn>
      </Stack>
    </Box>
  );
};

export default SettingsLayout;
