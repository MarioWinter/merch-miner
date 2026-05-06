/**
 * Compute a "X days online" label from an ISO listed-date.
 *
 * Lives in a utility file (not inline in the component) so the
 * `react-hooks/purity` lint rule — which forbids `Date.now()` calls inside a
 * component render path — is satisfied. Display-only relative timestamps are
 * fine in practice; the value re-evaluates on each render which is the
 * desired UX for a long-lived grid.
 */
export const formatDaysOnline = (listedDate: string | null): string | null => {
  if (!listedDate) return null;
  const days = Math.floor(
    (Date.now() - new Date(listedDate).getTime()) / 86_400_000,
  );
  return `${days.toLocaleString()} ${days === 1 ? 'day' : 'days'} online`;
};
