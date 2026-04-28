import { useState, type ReactNode } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { registerLanguages } from './registerHighlightLanguages';

// Register a curated set of languages once (tree-shakeable subset).
registerLanguages();

interface CodeBlockProps {
  /** Children from react-markdown — usually a string. */
  children: ReactNode;
  /** Optional className like `language-python` injected by react-markdown. */
  className?: string;
  /** Whether this is an inline `code` (not a fenced code block). */
  inline?: boolean;
}

const PreWrapper = styled(Box)(({ theme }) => ({
  position: 'relative',
  margin: `${theme.spacing(0.75)} 0`,
  borderRadius: 8,
  overflow: 'hidden',
  backgroundColor: '#1e1e1e', // vsc-dark-plus base; intentionally fixed across themes (AC-36)
  border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
}));

const HeaderBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(0.25)} ${theme.spacing(1)}`,
  backgroundColor: alpha(theme.palette.common.black, 0.4),
  borderBottom: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
}));

const InlineCode = styled('code')(({ theme }) => ({
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '0.8125rem',
  backgroundColor: alpha(theme.palette.common.black, 0.18),
  padding: '2px 5px',
  borderRadius: 4,
}));

const detectLanguage = (className: string | undefined): string | null => {
  if (!className) return null;
  const m = /language-([\w-]+)/.exec(className);
  return m ? m[1] : null;
};

const CodeBlock = ({ children, className, inline }: CodeBlockProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const language = detectLanguage(className);
  const codeText = String(children ?? '').replace(/\n$/, '');

  // Inline code (single backticks) → simple `<code>` styling.
  if (inline || (!language && !codeText.includes('\n'))) {
    return <InlineCode className={className}>{children}</InlineCode>;
  }

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeText);
      } else {
        // Fallback for older browsers / non-secure contexts.
        const ta = document.createElement('textarea');
        ta.value = codeText;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Swallow — UI just stays in non-copied state.
    }
  };

  return (
    <PreWrapper>
      <HeaderBar>
        <Typography
          variant="caption"
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.6875rem',
            color: alpha('#fff', 0.6),
            textTransform: 'lowercase',
          }}
        >
          {language ?? t('search.codeBlock.plain')}
        </Typography>
        <Tooltip
          title={copied ? t('search.codeBlock.copied') : t('search.codeBlock.copy')}
          placement="left"
        >
          <IconButton
            size="small"
            onClick={handleCopy}
            aria-label={t('search.codeBlock.copy')}
            sx={{
              p: 0.25,
              color: alpha('#fff', 0.7),
              '&:hover': { color: '#fff' },
            }}
          >
            {copied ? (
              <CheckIcon sx={{ fontSize: 14 }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Tooltip>
      </HeaderBar>
      <SyntaxHighlighter
        language={language ?? 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: 12,
          fontSize: '0.75rem',
          lineHeight: 1.5,
          background: 'transparent',
        }}
        codeTagProps={{
          style: { fontFamily: '"JetBrains Mono", monospace' },
        }}
      >
        {codeText}
      </SyntaxHighlighter>
    </PreWrapper>
  );
};

export default CodeBlock;
