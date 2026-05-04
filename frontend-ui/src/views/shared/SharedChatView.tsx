import {
  Alert,
  Avatar,
  Box,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import LanguageIcon from '@mui/icons-material/Language';
import { Link } from '@mui/material';
import { useGetPublicSessionQuery } from '@/store/searchSlice';
import MarkdownAnswer from '@/components/MultiPurposeDrawer/panels/partials/MarkdownAnswer';
import UserAttachments from '@/components/MultiPurposeDrawer/panels/partials/UserAttachments';
import type { SourceItem } from '@/types/search';

/**
 * PROJ-20 Phase 5.6 — read-only public share viewer.
 * Route `/shared/chat/:token`. No auth required.
 *
 * Renders the same MarkdownAnswer + citations as the authenticated chat
 * but without the action toolbar, save-selection toolbar, or input bar.
 */

const Layout = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: theme.vars.palette.background.default,
  paddingBlock: theme.spacing(4),
}));

const HeaderCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const MessagePaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const UserBubble = styled(Box)(({ theme }) => ({
  alignSelf: 'flex-end',
  maxWidth: '85%',
  padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
  borderRadius: '14px 14px 4px 14px',
  backgroundColor: theme.vars.palette.primary.main,
  color: theme.vars.palette.primary.contrastText,
  fontSize: '0.875rem',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}));

const AssistantAvatar = styled(Avatar)(({ theme }) => ({
  width: 28,
  height: 28,
  flexShrink: 0,
  backgroundColor: alpha(theme.palette.secondary.main, 0.15),
  color: theme.vars.palette.secondary.main,
  border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
  marginTop: 2,
}));

const ReadOnlySourceCard = styled(Box)(({ theme }) => ({
  padding: `${theme.spacing(0.75)} ${theme.spacing(1.25)}`,
  borderRadius: 10,
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: alpha(theme.palette.common.black, 0.25),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.25),
  transition:
    'border-color 1000ms ease, box-shadow 1000ms ease, background-color 120ms ease',
  '&.citation-flash': {
    borderColor: theme.vars.palette.primary.main,
    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.4)}`,
    transition: 'border-color 80ms ease, box-shadow 80ms ease',
  },
}));

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

interface SharedSourceRowProps {
  source: SourceItem;
  messageId: string;
  sourceIndex: number;
}

const SharedSourceRow = ({ source, messageId, sourceIndex }: SharedSourceRowProps) => (
  <ReadOnlySourceCard
    data-source-url={source.url}
    data-message-id={messageId}
    data-source-index={sourceIndex}
  >
    <Stack direction="row" alignItems="center" gap={1}>
      <LanguageIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
      <Stack flex={1} minWidth={0}>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.6875rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {getDomain(source.url)}
        </Typography>
        <Link
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          title={source.title || source.url}
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'text.primary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {source.title || source.url}
        </Link>
      </Stack>
    </Stack>
    {source.snippet && (
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.75rem', lineHeight: 1.4 }}
      >
        {source.snippet}
      </Typography>
    )}
  </ReadOnlySourceCard>
);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const SharedChatView = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useGetPublicSessionQuery(token ?? '', {
    skip: !token,
  });

  if (isLoading) {
    return (
      <Layout>
        <Container maxWidth="md">
          <Stack alignItems="center" gap={2} sx={{ pt: 8 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              {t('search.shared.loading')}
            </Typography>
          </Stack>
        </Container>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <Container maxWidth="md">
          <Stack gap={1.5} sx={{ pt: 4 }}>
            <Typography variant="h5" fontWeight={600}>
              {t('search.shared.notFound')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('search.shared.notFoundDetail')}
            </Typography>
          </Stack>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="md">
        <HeaderCard elevation={0}>
          <Stack gap={0.5}>
            <Typography variant="overline" color="text.disabled">
              {t('search.shared.pageTitle')}
            </Typography>
            <Typography variant="h6" fontWeight={600}>
              {data.title}
            </Typography>
            {data.niche_context_name && (
              <Typography variant="caption" color="text.secondary">
                {data.niche_context_name}
              </Typography>
            )}
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
              {formatDate(data.created_at)}
            </Typography>
          </Stack>
        </HeaderCard>

        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          {t('search.shared.sharedNotice')}
        </Alert>

        {data.messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            {t('search.shared.emptyMessage')}
          </Typography>
        ) : (
          <Stack gap={2}>
            {data.messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <Stack key={msg.id} alignItems="flex-end" gap={0.5}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <UserAttachments attachments={msg.attachments} />
                    )}
                    <UserBubble>{msg.content}</UserBubble>
                  </Stack>
                );
              }
              return (
                <Stack key={msg.id} direction="row" gap={1} alignItems="flex-start">
                  <AssistantAvatar aria-hidden="true">
                    <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                  </AssistantAvatar>
                  <Stack flex={1} minWidth={0} gap={0.75}>
                    <MessagePaper elevation={0}>
                      <MarkdownAnswer
                        content={msg.content}
                        sources={msg.sources}
                        messageId={msg.id}
                      />
                    </MessagePaper>
                    {msg.sources.length > 0 && (
                      <Stack gap={0.5}>
                        {msg.sources.map((src, idx) => (
                          <SharedSourceRow
                            key={`${msg.id}-${src.url}-${idx}`}
                            source={src}
                            messageId={msg.id}
                            sourceIndex={idx}
                          />
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Container>
    </Layout>
  );
};

export default SharedChatView;
