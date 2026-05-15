/**
 * PROJ-31 — `<Gate feature="...">` wrapper.
 *
 * Renders `children` only when the current user has the given feature key.
 * Renders `fallback` otherwise (default: nothing).
 *
 * Frontend hide is UX-only — backend `HasFeature` permission class is the
 * security boundary. A later phase will add an optional `paywall` prop for
 * "Upgrade to unlock" CTAs on selected paywalled features (non-breaking).
 */
import type { ReactNode } from 'react';
import { useCan } from '@/hooks/useCan';

interface GateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

const Gate = ({ feature, children, fallback = null }: GateProps) => {
  const allowed = useCan(feature);
  return <>{allowed ? children : fallback}</>;
};

export default Gate;
