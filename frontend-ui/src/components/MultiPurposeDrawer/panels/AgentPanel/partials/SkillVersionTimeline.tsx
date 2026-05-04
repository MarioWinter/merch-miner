/**
 * PROJ-18 Phase 14.6 — Skill version history (collapsible per-version diff).
 *
 * Used by SkillDetail to render the audit trail of patches.
 */
import { useState } from 'react';
import {
  Stack,
  Typography,
  Collapse,
  IconButton,
  Box,
  Card,
  CardContent,
  Skeleton,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useGetSkillVersionsQuery } from '@/store/agentSlice';

const VersionBody = styled(Box)(({ theme }) => ({
  fontSize: '0.8125rem',
  color: theme.vars.palette.text.primary,
  '& p': { margin: theme.spacing(0.25, 0) },
  '& ul, & ol': { paddingLeft: theme.spacing(2.5) },
  '& code': {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.75rem',
    padding: '1px 4px',
    borderRadius: 3,
    backgroundColor: theme.vars.palette.action.hover,
  },
}));

interface SkillVersionTimelineProps {
  skillId: string;
}

const SkillVersionTimeline = ({ skillId }: SkillVersionTimelineProps) => {
  const { t } = useTranslation();
  const { data, isLoading } = useGetSkillVersionsQuery(skillId);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <Stack gap={1}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={48} />
        ))}
      </Stack>
    );
  }

  const versions = data?.results ?? [];
  if (versions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        {t('agent.skills.empty')}
      </Typography>
    );
  }

  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">{t('agent.skills.versionHistory')}</Typography>
      {versions.map((v) => {
        const isOpen = openIds.has(v.id);
        const created = new Date(v.created_at).toLocaleString();
        return (
          <Card key={v.id} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                onClick={() => toggle(v.id)}
                sx={{ cursor: 'pointer' }}
                role="button"
                aria-expanded={isOpen}
              >
                <Stack direction="row" gap={1} alignItems="center" sx={{ minWidth: 0 }}>
                  <Chip
                    label={t('agent.skills.version', { version: v.version })}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v.patch_summary || '—'}
                  </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    {created}
                  </Typography>
                  <IconButton size="small" aria-label={t('agent.skills.viewVersions')}>
                    {isOpen ? (
                      <ExpandLessIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <ExpandMoreIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Stack>
              </Stack>
              <Collapse in={isOpen} unmountOnExit>
                <VersionBody sx={{ mt: 1 }}>
                  <ReactMarkdown>{v.content_md || ''}</ReactMarkdown>
                </VersionBody>
              </Collapse>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
};

export default SkillVersionTimeline;
