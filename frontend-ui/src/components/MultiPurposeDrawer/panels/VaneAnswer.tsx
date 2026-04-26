import { Box, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';

interface VaneAnswerProps {
  content: string;
  modelUsed: string;
}

const AnswerRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.background.paper, 0.6),
  border: `1px solid ${theme.vars.palette.divider}`,
  fontSize: '0.8125rem',
  lineHeight: 1.6,
  // Markdown styling
  '& p': { margin: `${theme.spacing(0.5)} 0` },
  '& a': { color: theme.vars.palette.secondary.main, textDecoration: 'underline' },
  '& code': {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '0.75rem',
    backgroundColor: alpha(theme.palette.common.black, 0.2),
    padding: '2px 4px',
    borderRadius: 4,
  },
  '& pre': {
    backgroundColor: alpha(theme.palette.common.black, 0.2),
    padding: theme.spacing(1),
    borderRadius: 8,
    overflowX: 'auto',
    '& code': { backgroundColor: 'transparent', padding: 0 },
  },
  '& h1, & h2, & h3, & h4': { marginTop: theme.spacing(1.5), marginBottom: theme.spacing(0.5) },
  '& ul, & ol': { paddingLeft: theme.spacing(2.5), margin: `${theme.spacing(0.5)} 0` },
  '& li': { marginBottom: theme.spacing(0.25) },
  '& table': {
    borderCollapse: 'collapse',
    width: '100%',
    margin: `${theme.spacing(1)} 0`,
    '& th, & td': {
      border: `1px solid ${theme.vars.palette.divider}`,
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      fontSize: '0.75rem',
    },
    '& th': { fontWeight: 600, backgroundColor: alpha(theme.palette.common.black, 0.1) },
  },
}));

const VaneAnswer = ({ content, modelUsed }: VaneAnswerProps) => {
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
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {content}
        </Markdown>
      </AnswerRoot>
    </Box>
  );
};

export default VaneAnswer;
