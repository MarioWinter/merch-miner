/**
 * PROJ-18 Phase 14.6 — AC-77
 *
 * Detail view for a single skill: read-only Markdown render, edit toggle to
 * SkillEditor, and version history via SkillVersionTimeline.
 */
import { useState } from 'react';
import {
  Stack,
  Typography,
  IconButton,
  Box,
  Chip,
  Skeleton,
  Button,
  Divider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import ReactMarkdown from 'react-markdown';
import {
  useGetSkillQuery,
  useDeleteSkillMutation,
} from '@/store/agentSlice';
import SkillEditor from './SkillEditor';
import SkillVersionTimeline from './SkillVersionTimeline';

const ContentBody = styled(Box)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.vars.palette.text.primary,
  '& p': { margin: theme.spacing(0.5, 0) },
  '& ul, & ol': { paddingLeft: theme.spacing(2.5) },
  '& h1, & h2, & h3, & h4': {
    fontSize: '1rem',
    fontWeight: 600,
    margin: theme.spacing(0.75, 0, 0.25),
  },
  '& code': {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.75rem',
    padding: '1px 4px',
    borderRadius: 3,
    backgroundColor: theme.vars.palette.action.hover,
  },
}));

interface SkillDetailProps {
  skillId: string;
  onBack: () => void;
}

const SkillDetail = ({ skillId, onBack }: SkillDetailProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data: skill, isLoading } = useGetSkillQuery(skillId);
  const [deleteSkill] = useDeleteSkillMutation();
  const [editing, setEditing] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteSkill(skillId).unwrap();
      enqueueSnackbar(t('agent.skills.deleted'), { variant: 'success' });
      onBack();
    } catch {
      enqueueSnackbar(t('agent.skills.deleteError'), { variant: 'error' });
    }
  };

  if (isLoading || !skill) {
    return (
      <Stack gap={1} sx={{ p: 2 }}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="rounded" height={200} />
      </Stack>
    );
  }

  return (
    <Stack gap={1.5} sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" gap={1}>
          <IconButton size="small" onClick={onBack} aria-label={t('agent.skills.back')}>
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {skill.name}
          </Typography>
        </Stack>
        {!editing && (
          <Stack direction="row" gap={0.5}>
            <Button
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 16 }} />}
              onClick={() => setEditing(true)}
            >
              {t('agent.skills.edit')}
            </Button>
            <IconButton
              size="small"
              color="error"
              onClick={handleDelete}
              aria-label={t('agent.skills.delete')}
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Stack>
        )}
      </Stack>

      <Stack direction="row" gap={0.5} flexWrap="wrap">
        <Chip
          size="small"
          label={t('agent.skills.version', { version: skill.version })}
          color="primary"
          variant="outlined"
        />
        <Chip
          size="small"
          label={t(`agent.skills.trigger_${skill.trigger_type}`)}
          variant="outlined"
        />
        {skill.applicable_agent_types.map((at) => (
          <Chip key={at} size="small" label={at} variant="outlined" />
        ))}
      </Stack>

      {skill.description && (
        <Typography variant="body2" color="text.secondary">
          {skill.description}
        </Typography>
      )}

      <Divider />

      {editing ? (
        <SkillEditor
          skill={skill}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <ContentBody>
          {skill.content_md.trim() ? (
            <ReactMarkdown>{skill.content_md}</ReactMarkdown>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {t('agent.skills.empty')}
            </Typography>
          )}
        </ContentBody>
      )}

      <Divider />

      <SkillVersionTimeline skillId={skillId} />
    </Stack>
  );
};

export default SkillDetail;
