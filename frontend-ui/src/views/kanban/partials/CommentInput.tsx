import { useCallback, useMemo, useRef, useState } from 'react';
import { Autocomplete, Box, IconButton, TextField, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';
import type { WorkspaceMember } from '@/services/workspaceService';

interface CommentInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (mentions?: number[]) => void;
  isSubmitting: boolean;
}

const CommentInput = ({ value, onChange, onSubmit, isSubmitting }: CommentInputProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<number[]>([]);

  const activeWsId = useAppSelector((s) => s.workspace.activeWorkspaceId);
  const workspace = useAppSelector((s) =>
    s.workspace.workspaces.find((w) => w.id === activeWsId),
  );
  const members = workspace?.members;

  const filteredMembers = useMemo(
    () =>
      (members ?? []).filter((m) => {
        const name = `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase();
        return name.includes(mentionQuery.toLowerCase());
      }),
    [members, mentionQuery],
  );

  const handleInputChange = useCallback(
    (text: string) => {
      onChange(text);
      // Check for @mention trigger
      const lastAt = text.lastIndexOf('@');
      if (lastAt >= 0) {
        const afterAt = text.slice(lastAt + 1);
        // Only open if no space after @ (still typing mention)
        if (!afterAt.includes(' ') && afterAt.length < 30) {
          setMentionOpen(true);
          setMentionQuery(afterAt);
          return;
        }
      }
      setMentionOpen(false);
    },
    [onChange],
  );

  const handleMemberSelect = useCallback(
    (_: unknown, member: WorkspaceMember | null) => {
      if (!member) return;
      // Replace the @query with @name
      const lastAt = value.lastIndexOf('@');
      const displayName =
        `${member.first_name} ${member.last_name}`.trim() || member.email;
      const newValue = value.slice(0, lastAt) + `@${displayName} `;
      onChange(newValue);
      setSelectedMentions((prev) =>
        prev.includes(member.id) ? prev : [...prev, member.id],
      );
      setMentionOpen(false);
      inputRef.current?.focus();
    },
    [value, onChange],
  );

  const handleSubmit = useCallback(() => {
    onSubmit(selectedMentions.length > 0 ? selectedMentions : undefined);
    setSelectedMentions([]);
  }, [onSubmit, selectedMentions]);

  return (
    <Box sx={{ position: 'relative' }}>
      {mentionOpen && filteredMembers.length > 0 && (
        <Autocomplete
          open
          options={filteredMembers}
          getOptionLabel={(m) =>
            `${m.first_name} ${m.last_name}`.trim() || m.email
          }
          renderOption={(props, m) => (
            <li {...props} key={m.id}>
              <Typography variant="body2">
                {`${m.first_name} ${m.last_name}`.trim() || m.email}
              </Typography>
            </li>
          )}
          onChange={handleMemberSelect}
          onClose={() => setMentionOpen(false)}
          disablePortal
          size="small"
          sx={{ position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 10 }}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={t('kanban.comments.mentionHint')}
              autoFocus
            />
          )}
        />
      )}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          multiline
          maxRows={4}
          placeholder={t('kanban.comments.placeholder')}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          slotProps={{ input: { sx: { fontSize: 13 } } }}
        />
        <IconButton
          color="primary"
          size="small"
          onClick={handleSubmit}
          disabled={!value.trim() || isSubmitting}
          aria-label={t('kanban.comments.send')}
        >
          <SendIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default CommentInput;
