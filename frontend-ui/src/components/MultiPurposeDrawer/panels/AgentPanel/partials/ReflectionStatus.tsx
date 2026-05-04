/**
 * PROJ-18 Phase 14.6 — AC-80
 *
 * Tiny inline component to render in AgentHeader showing the last reflection
 * timestamp + sessions-until-next (when cadence > 1).
 *
 * Click → invokes onOpenMemory (parent typically navigates to the Memory tab
 * in AgentSettingsPage).
 */
import { useMemo } from 'react';
import { Chip, Tooltip, Box } from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import { useTranslation } from 'react-i18next';
import {
  useGetMemoryQuery,
  useGetWorkspaceConfigQuery,
  useListSessionsQuery,
} from '@/store/agentSlice';

const formatTimeAgo = (iso: string | null): string => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

interface ReflectionStatusProps {
  /** Optional click handler — typically navigates to the Memory tab. */
  onOpenMemory?: () => void;
}

const ReflectionStatus = ({ onOpenMemory }: ReflectionStatusProps) => {
  const { t } = useTranslation();
  // Polling: refetch memory every 30s — picks up reflections completed in
  // the background (frontend test 14.8 covers this contract).
  const { data: memory } = useGetMemoryQuery(undefined, {
    pollingInterval: 30_000,
  });
  const { data: config } = useGetWorkspaceConfigQuery();
  // Cheap session count for "sessions until next" math. We pull only the
  // first page; the count field is what we need.
  const { data: sessions } = useListSessionsQuery({ page: 1, page_size: 1 });

  const cadence = config?.reflection_cadence_sessions ?? 1;
  const totalSessions = sessions?.count ?? 0;

  const sessionsUntilNext = useMemo(() => {
    if (cadence <= 1) return null;
    // Count sessions completed since last consolidation; the backend tracks
    // last_consolidated_session but we don't have a direct counter from the
    // API. As an approximation, use modulo: when (totalSessions % cadence)
    // === 0, we just reflected; otherwise that's the gap to the next.
    const remainder = totalSessions % cadence;
    return remainder === 0 ? cadence : cadence - remainder;
  }, [cadence, totalSessions]);

  const lastWhen = formatTimeAgo(memory?.last_consolidated_at ?? null);
  const lastLabel = memory?.last_consolidated_at
    ? t('agent.reflection.lastReflection', { when: lastWhen })
    : t('agent.reflection.lastReflectionNever');

  const tooltipTitle =
    sessionsUntilNext !== null
      ? `${lastLabel} · ${t('agent.reflection.untilNext', { count: sessionsUntilNext })}`
      : lastLabel;

  return (
    <Tooltip title={tooltipTitle}>
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <Chip
          icon={<PsychologyIcon sx={{ fontSize: 14 }} />}
          label={lastWhen || t('agent.reflection.lastReflectionNever')}
          size="small"
          variant="outlined"
          onClick={onOpenMemory}
          aria-label={t('agent.reflection.viewMemory')}
          sx={{ maxWidth: 160 }}
        />
      </Box>
    </Tooltip>
  );
};

export default ReflectionStatus;
