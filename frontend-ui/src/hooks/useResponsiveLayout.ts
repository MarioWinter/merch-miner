/**
 * PROJ-30 T1.5 — viewport-tier hook for responsive primitives.
 *
 * Returns four mutually exclusive (well: `isPhoneTiny` overlaps with
 * `isMobile`) booleans derived from the MUI theme breakpoints:
 *   - isPhoneTiny  width < 400  (xxs)
 *   - isMobile     width < 600  (sm)
 *   - isTablet     600 ≤ width < 900
 *   - isDesktop    width ≥ 900  (md+)
 *
 * Consumers must never call `window.innerWidth` directly (AC-24) —
 * always use this hook so SSR / test environments stay deterministic.
 */
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export interface ResponsiveLayout {
  isPhoneTiny: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export const useResponsiveLayout = (): ResponsiveLayout => {
  const theme = useTheme();
  const isPhoneTiny = useMediaQuery(theme.breakpoints.down('xxs'));
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  return { isPhoneTiny, isMobile, isTablet, isDesktop };
};
