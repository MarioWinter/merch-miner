/**
 * PROJ-18 Phase 14.6 — AC-76 + Phase 14.7 EC-22
 *
 * Workspace skill catalog. Click a row → SkillDetail. EC-22: filters out
 * soft-deleted skills by default; admin toggle "Show deleted" shows them
 * grayed-out.
 */
import { useState, useMemo } from 'react';
import {
  Stack,
  Typography,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Box,
  Switch,
  FormControlLabel,
  IconButton,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';
import { useTranslation } from 'react-i18next';
import { useListSkillsQuery } from '@/store/agentSlice';
import type { Skill, SkillTriggerType } from '@/types/agent';
import SkillDetail from './SkillDetail';

const SkillRow = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'deleted',
})<{ deleted?: boolean }>(({ theme, deleted }) => ({
  borderRadius: Number(theme.shape.borderRadius) * 0.5,
  cursor: 'pointer',
  transition: 'background-color 120ms ease',
  opacity: deleted ? 0.55 : 1,
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
  },
}));

const truncate = (text: string, n: number): string =>
  text.length <= n ? text : text.slice(0, n - 1).trimEnd() + '…';

const triggerColor = (
  trigger: SkillTriggerType,
): 'primary' | 'warning' | 'success' | 'default' => {
  switch (trigger) {
    case 'auto_complex_task':
      return 'primary';
    case 'auto_error_recovery':
      return 'warning';
    case 'user_correction':
      return 'success';
    case 'manual':
    default:
      return 'default';
  }
};

const SkillList = () => {
  const { t } = useTranslation();
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useListSkillsQuery({
    include_deleted: showDeleted,
  });

  const skills = useMemo(() => data?.results ?? [], [data]);

  if (selectedId) {
    return <SkillDetail skillId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  if (isLoading) {
    return (
      <Stack gap={1} sx={{ p: 2 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={72} />
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={1.5} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">{t('agent.skills.title')}</Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              inputProps={{
                'aria-label': t('agent.skills.showDeleted'),
              }}
            />
          }
          label={
            <Typography variant="caption">{t('agent.skills.showDeleted')}</Typography>
          }
        />
      </Stack>

      {skills.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {t('agent.skills.empty')}
          </Typography>
        </Box>
      ) : (
        <Stack gap={1}>
          {skills.map((skill: Skill) => {
            const lastUsed = skill.last_used_at
              ? new Date(skill.last_used_at).toLocaleDateString()
              : t('agent.skills.lastUsedNever');
            const isDeleted = skill.deleted_at !== null;
            return (
              <SkillRow
                key={skill.id}
                variant="outlined"
                deleted={isDeleted}
                onClick={() => setSelectedId(skill.id)}
                role="button"
                aria-label={skill.name}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedId(skill.id);
                  }
                }}
              >
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack gap={0.75}>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            textDecoration: isDeleted ? 'line-through' : 'none',
                          }}
                        >
                          {skill.name}
                        </Typography>
                        {skill.description && (
                          <Typography variant="caption" color="text.secondary">
                            {truncate(skill.description, 80)}
                          </Typography>
                        )}
                      </Box>
                      <Tooltip title={t('agent.skills.viewVersions')}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(skill.id);
                          }}
                          aria-label={t('agent.skills.viewVersions')}
                        >
                          <HistoryIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>

                    <Stack direction="row" gap={0.5} flexWrap="wrap" alignItems="center">
                      <Chip
                        size="small"
                        label={t(`agent.skills.trigger_${skill.trigger_type}`)}
                        color={triggerColor(skill.trigger_type)}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={t('agent.skills.version', { version: skill.version })}
                        variant="outlined"
                      />
                      {skill.applicable_agent_types.slice(0, 3).map((at) => (
                        <Chip
                          key={at}
                          size="small"
                          label={at}
                          variant="outlined"
                        />
                      ))}
                      {skill.applicable_agent_types.length > 3 && (
                        <Chip
                          size="small"
                          label={`+${skill.applicable_agent_types.length - 3}`}
                          variant="outlined"
                        />
                      )}
                    </Stack>

                    <Stack
                      direction="row"
                      gap={2}
                      alignItems="center"
                      sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
                    >
                      <Typography variant="caption" color="success.main">
                        ✓ {skill.success_count}
                      </Typography>
                      <Typography variant="caption" color="error.main">
                        ✗ {skill.error_count}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('agent.skills.lastUsed')}: {lastUsed}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </SkillRow>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};

export default SkillList;
