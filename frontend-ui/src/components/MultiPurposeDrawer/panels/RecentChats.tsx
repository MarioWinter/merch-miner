import {
  Box,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import { useTranslation } from 'react-i18next';
import { useListSessionsQuery } from '@/store/searchSlice';
import type { ChatSession } from '@/types/search';

interface RecentChatsProps {
  onSelect: (session: ChatSession) => void;
  activeSessionId: string | null;
}

const SessionItem = styled(ListItemButton)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
  marginBottom: theme.spacing(0.5),
  '&.Mui-selected': {
    backgroundColor: 'rgba(255, 90, 79, 0.08)',
  },
}));

const TagChipRow = styled(Stack)({
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 4,
});

const RecentChats = ({ onSelect, activeSessionId }: RecentChatsProps) => {
  const { t } = useTranslation();
  const { data, isLoading } = useListSessionsQuery({ page_size: 10 });

  if (isLoading) {
    return (
      <Box sx={{ px: 1, py: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 0.5, borderRadius: 2 }} />
        ))}
      </Box>
    );
  }

  const sessions = data?.results ?? [];

  if (sessions.length === 0) {
    return (
      <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {t('search.empty.noSessions')}
        </Typography>
      </Box>
    );
  }

  return (
    <List dense disablePadding>
      {sessions.map((session) => (
        <SessionItem
          key={session.id}
          selected={session.id === activeSessionId}
          onClick={() => onSelect(session)}
        >
          <ListItemText
            primary={
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1 }}>
                  {session.title || t('search.sessions.untitled')}
                </Typography>
                {session.is_shared && (
                  <IconButton size="small" tabIndex={-1} sx={{ p: 0 }}>
                    <ShareOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  </IconButton>
                )}
              </Stack>
            }
            secondary={
              <Stack gap={0.25}>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  {session.niche_context && (
                    <Chip
                      label={session.niche_context.name}
                      size="small"
                      variant="outlined"
                      color="secondary"
                      sx={{ fontSize: '0.6875rem', height: 20 }}
                    />
                  )}
                  <Typography variant="caption" color="text.disabled">
                    {new Date(session.updated_at).toLocaleDateString()}
                  </Typography>
                </Stack>
                {session.tags.length > 0 && (
                  <TagChipRow>
                    {session.tags.map((tag) => (
                      <Chip
                        key={tag.id}
                        label={tag.name}
                        size="small"
                        sx={{
                          fontSize: '0.625rem',
                          height: 18,
                          bgcolor: tag.color,
                          color: '#fff',
                        }}
                      />
                    ))}
                  </TagChipRow>
                )}
                {session.shared_by && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {t('search.sessions.sharedBy', { name: session.shared_by })}
                  </Typography>
                )}
              </Stack>
            }
            slotProps={{ primary: { noWrap: true } }}
          />
        </SessionItem>
      ))}
    </List>
  );
};

export default RecentChats;
