/**
 * NotesMarkdownEditor — Edit/Preview shell for the niche-notes markdown editor.
 *
 * Phase 3: Tabs + auto-grow textarea + manual resize. Preview is a placeholder
 *          that Phase 5 will replace with a `NotesMarkdownRenderer`.
 *
 * Public API stays stable across phases — `value` / `onChange` are the only
 * required props, so `react-hook-form` `Controller` can consume it as-is.
 */
import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import { useTranslation } from 'react-i18next';
import EditTextarea from './partials/EditTextarea';

export interface NotesMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  maxRows?: number;
  ariaLabel?: string;
  onBlur?: () => void;
  error?: boolean;
  helperText?: React.ReactNode;
  disabled?: boolean;
}

const NotesMarkdownEditor = (props: NotesMarkdownEditorProps) => {
  const {
    value,
    onChange,
    placeholder,
    minRows = 3,
    maxRows = 20,
    ariaLabel,
    onBlur,
    error,
    helperText,
    disabled,
  } = props;
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, v: number) => setActiveTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
      >
        <Tab label={t('notesEditor.tab.edit')} />
        <Tab label={t('notesEditor.tab.preview')} />
      </Tabs>

      {activeTab === 0 ? (
        <EditTextarea
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          minRows={minRows}
          maxRows={maxRows}
          ariaLabel={ariaLabel}
          error={error}
          helperText={helperText}
          disabled={disabled}
        />
      ) : (
        // Phase 5: replace with <NotesMarkdownRenderer value={value} onChange={onChange} />
        <Box
          sx={{
            p: 1.5,
            minHeight: 80,
            color: 'text.secondary',
            fontStyle: 'italic',
          }}
        >
          {t('notesEditor.preview.phase3Placeholder')}
        </Box>
      )}
    </Box>
  );
};

export default NotesMarkdownEditor;
