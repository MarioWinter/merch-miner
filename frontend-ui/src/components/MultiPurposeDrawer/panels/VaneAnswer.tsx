import { Box, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import type { SourceItem } from '@/types/search';
import MarkdownAnswer from './partials/MarkdownAnswer';

interface VaneAnswerProps {
  content: string;
  modelUsed: string;
  /** Sources for citation `[N]` linking. Defaults to []. */
  sources?: SourceItem[];
  /** Stable id used to scope citation -> SourceCard lookup per-message. */
  messageId: string;
}

const AnswerRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.background.paper, 0.6),
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const VaneAnswer = ({
  content,
  modelUsed,
  sources = [],
  messageId,
}: VaneAnswerProps) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <AutoAwesomeIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
        <Typography variant="subtitle2" color="text.secondary">
          {t('search.results.aiAnswer')}
        </Typography>
        {modelUsed && (
          <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
            {modelUsed}
          </Typography>
        )}
      </Box>
      <AnswerRoot>
        <MarkdownAnswer
          content={content}
          sources={sources}
          messageId={messageId}
        />
      </AnswerRoot>
    </Box>
  );
};

export default VaneAnswer;
