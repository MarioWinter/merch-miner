/**
 * PROJ-20 Phase 3.5 — HelpCommandsPopup
 *
 * Modal Dialog rendered when `/help` is executed. Lists all commands as a
 * `react-markdown`-rendered table with description + example, per AC-24.
 *
 * The markdown is built in-memory from the registry so we don't have to
 * keep a separate i18n string in sync with the registry shape — only the
 * row descriptions are i18n-driven.
 */
import { useMemo } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { useTranslation } from 'react-i18next';
import { COMMANDS } from '../utils/commandRegistry';

export interface HelpCommandsPopupProps {
  open: boolean;
  onClose: () => void;
}

const TableWrapper = styled(Box)(({ theme }) => ({
  '& table': {
    borderCollapse: 'collapse',
    width: '100%',
    margin: 0,
    '& th, & td': {
      border: `1px solid ${theme.vars.palette.divider}`,
      padding: theme.spacing(0.75, 1),
      fontSize: '0.8125rem',
      textAlign: 'left',
      verticalAlign: 'top',
    },
    '& th': {
      fontWeight: 600,
      backgroundColor: alpha(theme.palette.common.black, 0.08),
    },
    '& code': {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: '0.78rem',
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
      color: theme.vars.palette.primary.main,
      padding: '1px 6px',
      borderRadius: 4,
    },
  },
}));

const HelpCommandsPopup = ({ open, onClose }: HelpCommandsPopupProps) => {
  const { t } = useTranslation();

  const markdown = useMemo(() => {
    const cmdHeader = t('search.commands.help.commandHeader');
    const descHeader = t('search.commands.help.descriptionHeader');
    const exampleHeader = t('search.commands.help.exampleHeader');
    const rows = COMMANDS.map((cmd) => {
      const desc = t(cmd.descriptionKey);
      const example = cmd.example ?? cmd.trigger;
      return `| \`${cmd.trigger}\` | ${desc} | \`${example}\` |`;
    });
    return [
      `| ${cmdHeader} | ${descHeader} | ${exampleHeader} |`,
      `| --- | --- | --- |`,
      ...rows,
    ].join('\n');
  }, [t]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      data-testid="help-commands-popup"
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { 'aria-label': t('search.commands.help.title') } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pr: 1,
        }}
      >
        <Typography variant="h6" component="span">
          {t('search.commands.help.title')}
        </Typography>
        <IconButton
          aria-label={t('common.close')}
          onClick={onClose}
          size="small"
          data-testid="help-commands-popup-close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TableWrapper>
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
          >
            {markdown}
          </Markdown>
        </TableWrapper>
      </DialogContent>
    </Dialog>
  );
};

export default HelpCommandsPopup;
