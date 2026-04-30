import { useState, useCallback } from 'react';
import {
  Stack,
  Typography,
  IconButton,
  TextField,
  Button,
  Card,
  CardContent,
  Skeleton,
  Box,
  Tooltip,
  Collapse,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import ReactMarkdown from 'react-markdown';
import {
  useListKnowledgeQuery,
  useCreateKnowledgeMutation,
  useUpdateKnowledgeMutation,
  useDeleteKnowledgeMutation,
} from '@/store/agentSlice';
import type { KnowledgeDoc } from '../types';

const MarkdownPreview = styled(Box)(({ theme }) => ({
  fontSize: '0.8125rem',
  color: theme.vars.palette.text.secondary,
  '& p': { margin: theme.spacing(0.25, 0) },
  '& ul, & ol': { paddingLeft: theme.spacing(2.5), margin: theme.spacing(0.25, 0) },
  '& code': {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '0.75rem',
    padding: '1px 4px',
    borderRadius: 3,
    backgroundColor: theme.vars.palette.action.hover,
  },
  '& h1, & h2, & h3, & h4': {
    fontSize: '0.875rem',
    fontWeight: 600,
    margin: theme.spacing(0.5, 0, 0.25),
  },
  '& a': { color: theme.vars.palette.primary.main },
}));

const KnowledgeDocList = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data: docs, isLoading } = useListKnowledgeQuery();
  const [createDoc] = useCreateKnowledgeMutation();
  const [updateDoc] = useUpdateKnowledgeMutation();
  const [deleteDoc] = useDeleteKnowledgeMutation();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [previewIds, setPreviewIds] = useState<Set<string>>(new Set());

  const togglePreview = useCallback((id: string) => {
    setPreviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleStartEdit = useCallback((doc: KnowledgeDoc) => {
    setEditingId(doc.id);
    setEditTitle(doc.title);
    setEditContent(doc.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    try {
      await updateDoc({
        id: editingId,
        body: { title: editTitle, content: editContent },
      }).unwrap();
      enqueueSnackbar(t('agent.knowledge.saved'), { variant: 'success' });
      setEditingId(null);
    } catch {
      enqueueSnackbar(t('agent.knowledge.saveError'), { variant: 'error' });
    }
  }, [editingId, editTitle, editContent, updateDoc, enqueueSnackbar, t]);

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) return;
    try {
      await createDoc({ title: newTitle, content: newContent }).unwrap();
      enqueueSnackbar(t('agent.knowledge.saved'), { variant: 'success' });
      setNewTitle('');
      setNewContent('');
      setCreating(false);
    } catch {
      enqueueSnackbar(t('agent.knowledge.saveError'), { variant: 'error' });
    }
  }, [newTitle, newContent, createDoc, enqueueSnackbar, t]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteDoc(id).unwrap();
        enqueueSnackbar(t('agent.knowledge.deleted'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('agent.knowledge.deleteError'), { variant: 'error' });
      }
    },
    [deleteDoc, enqueueSnackbar, t],
  );

  if (isLoading) {
    return (
      <Stack gap={1} sx={{ p: 2 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={64} />
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={1.5} sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">
          {t('agent.knowledge.title')}
        </Typography>
        <IconButton size="small" onClick={() => setCreating(true)}>
          <AddIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Stack>

      {creating && (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack gap={1}>
              <TextField
                size="small"
                placeholder={t('agent.knowledge.titlePlaceholder')}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                fullWidth
              />
              <TextField
                size="small"
                placeholder={t('agent.knowledge.contentPlaceholder')}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
              <Stack direction="row" gap={0.5} justifyContent="flex-end">
                <Button size="small" onClick={() => setCreating(false)}>
                  {t('agent.knowledge.cancel')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleCreate}
                  disabled={!newTitle.trim()}
                >
                  {t('agent.knowledge.save')}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {(docs ?? []).length === 0 && !creating && (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('agent.knowledge.empty')}
          </Typography>
        </Box>
      )}

      {(docs ?? []).map((doc) =>
        editingId === doc.id ? (
          <Card key={doc.id} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack gap={1}>
                <TextField
                  size="small"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />
                <Stack direction="row" gap={0.5} justifyContent="flex-end">
                  <IconButton size="small" onClick={() => setEditingId(null)}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton size="small" onClick={handleSaveEdit}>
                    <SaveIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <Card key={doc.id} variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {doc.title}
                  </Typography>
                  {!previewIds.has(doc.id) && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {doc.content}
                    </Typography>
                  )}
                  <Collapse in={previewIds.has(doc.id)} unmountOnExit>
                    <MarkdownPreview sx={{ mt: 0.5 }}>
                      <ReactMarkdown>{doc.content}</ReactMarkdown>
                    </MarkdownPreview>
                  </Collapse>
                </Box>
                <Stack direction="row" gap={0.25}>
                  <Tooltip
                    title={
                      previewIds.has(doc.id)
                        ? t('agent.knowledge.hidePreview')
                        : t('agent.knowledge.preview')
                    }
                  >
                    <IconButton
                      size="small"
                      onClick={() => togglePreview(doc.id)}
                      aria-label={t('agent.knowledge.preview')}
                    >
                      <VisibilityIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('agent.knowledge.edit')}>
                    <IconButton size="small" onClick={() => handleStartEdit(doc)}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('agent.knowledge.delete')}>
                    <IconButton size="small" onClick={() => handleDelete(doc.id)}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        ),
      )}
    </Stack>
  );
};

export default KnowledgeDocList;
