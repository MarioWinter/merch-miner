import { useRef, useEffect, useState } from 'react';
import {
  CircularProgress,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { UseInlineAddReturn } from '../hooks/useInlineAdd';

interface InlineAddRowProps {
  inlineAdd: UseInlineAddReturn;
}

const AddRow = styled(TableRow)(({ theme }) => ({
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '& td': {
    borderBottom: `1px solid ${theme.vars.palette.divider}`,
    padding: '0 12px',
    height: 44,
  },
  '&:hover': {
    backgroundColor: alpha(COLORS.white, 0.02),
    ...theme.applyStyles('light', {
      backgroundColor: alpha(COLORS.ink, 0.02),
    }),
  },
}));

const ActiveAddRow = styled(TableRow)(({ theme }) => ({
  '& td': {
    borderBottom: `1px solid ${theme.vars.palette.divider}`,
    padding: '0 12px',
    height: 44,
  },
  backgroundColor: alpha(COLORS.red, 0.04),
}));

const PlaceholderCell = styled(TableCell)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
}));

// Isolated input component — mounts fresh each time isActive flips to true
const AddInput = ({
  error,
  isCreating,
  onSubmit,
  onCancel,
}: {
  error: string | null;
  isCreating: boolean;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(value);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleBlur = () => {
    if (value.trim()) {
      onSubmit(value);
    } else {
      onCancel();
    }
  };

  return (
    <TextField
      inputRef={inputRef}
      size="small"
      fullWidth
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={t('niches.inlineAdd.placeholder')}
      error={Boolean(error)}
      helperText={error ?? undefined}
      disabled={isCreating}
      slotProps={{
        input: {
          'aria-label': t('niches.inlineAdd.addNiche'),
          endAdornment: isCreating ? (
            <CircularProgress size={14} sx={{ mr: 0.5 }} />
          ) : undefined,
        },
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          height: 32,
          fontSize: '0.875rem',
        },
      }}
    />
  );
};

export const InlineAddRow = ({ inlineAdd }: InlineAddRowProps) => {
  const { t } = useTranslation();
  const { isActive, isCreating, error, activate, cancel, submit } = inlineAdd;

  if (!isActive) {
    return (
      <AddRow onClick={activate} aria-label={t('niches.inlineAdd.addNiche')}>
        <TableCell padding="checkbox" sx={{ width: 44 }} />
        <PlaceholderCell colSpan={7}>
          <AddIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.disabled">
            {t('niches.inlineAdd.addNiche')}
          </Typography>
        </PlaceholderCell>
      </AddRow>
    );
  }

  return (
    <ActiveAddRow aria-label={t('niches.inlineAdd.addNiche')}>
      <TableCell padding="checkbox" sx={{ width: 44 }} />
      <TableCell colSpan={6}>
        <AddInput
          key="add-input"
          error={error}
          isCreating={isCreating}
          onSubmit={(name) => void submit(name)}
          onCancel={cancel}
        />
      </TableCell>
      <TableCell sx={{ width: 44 }} />
    </ActiveAddRow>
  );
};
