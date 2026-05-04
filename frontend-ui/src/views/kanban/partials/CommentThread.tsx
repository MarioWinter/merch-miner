import {
  Avatar,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import { useComments } from '../hooks/useComments';
import CommentInput from './CommentInput';
import type { NicheComment } from '../types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const CommentBubble = styled(Box, {
  shouldForwardProp: (p) => p !== '$isAgent',
})<{ $isAgent: boolean }>(({ theme, $isAgent }) => ({
  padding: theme.spacing(1, 1.5),
  borderRadius: 8,
  background: $isAgent
    ? alpha(theme.palette.secondary.main, 0.08)
    : theme.vars.palette.action.hover,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString();
};

// ---------------------------------------------------------------------------
// Single comment
// ---------------------------------------------------------------------------

interface SingleCommentProps {
  comment: NicheComment;
  currentUserId: number | null;
  onDelete: (id: string) => void;
}

const SingleComment = ({ comment, currentUserId, onDelete }: SingleCommentProps) => {
  const isAgent = Boolean(comment.agent_type);
  const authorName = isAgent
    ? comment.agent_type
    : comment.author
      ? `${comment.author.first_name} ${comment.author.last_name}`.trim() ||
        comment.author.email
      : 'Unknown';

  const canDelete = comment.author?.id === currentUserId;

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      {isAgent ? (
        <Avatar sx={{ width: 28, height: 28, bgcolor: 'secondary.main' }}>
          <SmartToyOutlinedIcon sx={{ fontSize: 16 }} />
        </Avatar>
      ) : (
        <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
          {authorName.charAt(0).toUpperCase()}
        </Avatar>
      )}

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {isAgent ? `Agent: ${authorName}` : authorName}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {formatTime(comment.created_at)}
          </Typography>
        </Box>

        <CommentBubble $isAgent={isAgent}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {comment.content}
          </Typography>
        </CommentBubble>
      </Box>

      {canDelete && (
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={() => onDelete(comment.id)}
            sx={{ mt: 0.5 }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------

interface CommentThreadProps {
  nicheId: string;
  designId?: string;
  title?: string;
}

const CommentThread = ({ nicheId, designId, title }: CommentThreadProps) => {
  const { t } = useTranslation();
  const currentUser = useAppSelector((s) => s.auth.user);

  const {
    comments,
    isLoading,
    draft,
    setDraft,
    isSubmitting,
    handleSubmit,
    handleDelete,
  } = useComments({ nicheId, designId });

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {title ?? t('kanban.comments.title')}
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : comments.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
          {t('kanban.empty.comments')}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2, maxHeight: 300, overflowY: 'auto' }}>
          {comments.map((c) => (
            <SingleComment
              key={c.id}
              comment={c}
              currentUserId={currentUser?.id ?? null}
              onDelete={handleDelete}
            />
          ))}
        </Box>
      )}

      <CommentInput
        value={draft}
        onChange={setDraft}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </Box>
  );
};

export default CommentThread;
