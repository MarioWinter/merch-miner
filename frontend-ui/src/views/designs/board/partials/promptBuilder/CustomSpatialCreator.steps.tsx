// PROJ-34 Phase 13f part B — sub-renderers for the 3-step CustomSpatialCreator
// wizard, extracted to keep the container file under the 250–300 line budget.
// Each step renders the right column of inputs / preview; the parent owns
// state + RTK mutation orchestration.

import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Grid,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { ProjectReference } from '@/views/designs/gallery/types';
import type { Design } from '@/views/designs/board/types';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type SourceSelection =
  | { kind: 'upload'; file: File; previewUrl: string }
  | { kind: 'reference'; id: string; previewUrl: string }
  | { kind: 'design'; id: string; previewUrl: string };

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

// ---------------------------------------------------------------------------
// Shared styled
// ---------------------------------------------------------------------------

const PreviewBox = styled(Box)(({ theme }) => ({
  width: 200,
  height: 200,
  borderRadius: 8,
  overflow: 'hidden',
  backgroundColor: theme.vars.palette.action.disabledBackground,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
}));

const DropZone = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isOver',
})<{ isOver: boolean }>(({ theme, isOver }) => ({
  border: `2px dashed ${isOver ? theme.vars.palette.primary.main : theme.vars.palette.divider}`,
  borderRadius: 8,
  padding: theme.spacing(4),
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'border-color 150ms ease',
}));

const ThumbCard = styled(Card)<{ 'data-selected': 'true' | 'false' }>(
  ({ theme, ...props }) => ({
    border:
      props['data-selected'] === 'true'
        ? `2px solid ${theme.vars.palette.primary.main}`
        : `2px solid transparent`,
  }),
);

const ThumbImage = styled(Box)(({ theme }) => ({
  width: '100%',
  aspectRatio: '1 / 1',
  overflow: 'hidden',
  backgroundColor: theme.vars.palette.action.disabledBackground,
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
}));

// ===========================================================================
// Step 1 — Source picker
// ===========================================================================

interface Step1Props {
  value: SourceSelection | null;
  onChange: (v: SourceSelection | null) => void;
  references: ProjectReference[];
  designs: Design[];
}

type SubTab = 'upload' | 'reference' | 'design';

export const Step1Source = ({
  value,
  onChange,
  references,
  designs,
}: Step1Props) => {
  const [subTab, setSubTab] = useState<SubTab>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('File too large (max 10 MB).');
      return;
    }
    if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
      setUploadError('Use JPG, PNG, or WebP.');
      return;
    }
    setUploadError(null);
    const previewUrl = URL.createObjectURL(file);
    onChange({ kind: 'upload', file, previewUrl });
  };

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        exclusive
        value={subTab}
        onChange={(_, v: SubTab | null) => v && setSubTab(v)}
        size="small"
        aria-label="Source type"
      >
        <ToggleButton value="upload">Upload</ToggleButton>
        <ToggleButton value="reference">From References</ToggleButton>
        <ToggleButton value="design">From Designs</ToggleButton>
      </ToggleButtonGroup>

      {subTab === 'upload' && (
        <Stack spacing={2}>
          <DropZone
            isOver={dragOver}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload image drop zone"
          >
            <Typography variant="body2" color="text.secondary">
              Drop a JPG, PNG, or WebP here (max 10 MB) or click to browse
            </Typography>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
            />
          </DropZone>
          {uploadError && (
            <Alert severity="error" role="alert">
              {uploadError}
            </Alert>
          )}
          {value?.kind === 'upload' && (
            <PreviewBox>
              <img src={value.previewUrl} alt="Selected upload preview" />
            </PreviewBox>
          )}
        </Stack>
      )}

      {subTab === 'reference' && (
        <ThumbGrid
          items={references.map((r) => ({
            id: r.id,
            url: r.image_url,
            label: r.title,
          }))}
          emptyText="No references in this project. Add one from the right panel first."
          selectedId={value?.kind === 'reference' ? value.id : undefined}
          onSelect={(id, url) =>
            onChange({ kind: 'reference', id, previewUrl: url })
          }
        />
      )}

      {subTab === 'design' && (
        <ThumbGrid
          items={designs.map((d) => ({
            id: d.id,
            url: d.image_file,
            label: d.idea_summary?.slogan_text ?? 'Design',
          }))}
          emptyText="No designs yet. Generate one first."
          selectedId={value?.kind === 'design' ? value.id : undefined}
          onSelect={(id, url) =>
            onChange({ kind: 'design', id, previewUrl: url })
          }
        />
      )}
    </Stack>
  );
};

// Small inline helper — thumbnail-grid for reference + design sub-tabs.
interface ThumbGridProps {
  items: { id: string; url: string; label: string }[];
  emptyText: string;
  selectedId: string | undefined;
  onSelect: (id: string, url: string) => void;
}

const ThumbGrid = ({ items, emptyText, selectedId, onSelect }: ThumbGridProps) => {
  if (items.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyText}</Typography>
      </Box>
    );
  }
  return (
    <Grid container spacing={2}>
      {items.map((it) => (
        <Grid key={it.id} size={{ xs: 6, sm: 4, md: 3 }}>
          <ThumbCard
            data-selected={selectedId === it.id ? 'true' : 'false'}
          >
            <CardActionArea
              onClick={() => onSelect(it.id, it.url)}
              aria-label={`Select ${it.label}`}
              aria-pressed={selectedId === it.id}
            >
              <ThumbImage>
                <img src={it.url} alt="" loading="lazy" />
              </ThumbImage>
              <Typography variant="caption" sx={{ p: 0.5 }} noWrap>
                {it.label}
              </Typography>
            </CardActionArea>
          </ThumbCard>
        </Grid>
      ))}
    </Grid>
  );
};

// ===========================================================================
// Step 2 — Analyze
// ===========================================================================

interface AnalyzeErrorBody {
  error?: string;
  forbidden_terms?: string[];
}

interface Step2Props {
  source: SourceSelection;
  promptText: string;
  onPromptChange: (v: string) => void;
  isLoading: boolean;
  error: unknown;
  onTryAnother: () => void;
  onRetry: () => void;
}

export const Step2Analyze = ({
  source,
  promptText,
  onPromptChange,
  isLoading,
  error,
  onTryAnother,
  onRetry,
}: Step2Props) => {
  const err = error as { status?: number; data?: AnalyzeErrorBody } | undefined;
  const errCode = err?.data?.error;
  const forbidden = err?.data?.forbidden_terms ?? [];

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <PreviewBox sx={{ flex: '0 0 auto' }}>
        <img src={source.previewUrl} alt="Selected source preview" />
      </PreviewBox>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        {isLoading && (
          <Skeleton variant="rectangular" height={120} role="progressbar" />
        )}

        {!isLoading && errCode === 'spatial_unclear' && (
          <Stack spacing={1}>
            <Alert severity="warning" role="alert">
              The image couldn&apos;t be clearly analyzed. Try a different image.
            </Alert>
            <Button variant="outlined" onClick={onTryAnother}>
              Try another
            </Button>
          </Stack>
        )}

        {!isLoading && errCode === 'spatial_analysis_failed' && (
          <Stack spacing={1}>
            <Alert severity="error" role="alert">
              Forbidden terms detected: {forbidden.join(', ')}
            </Alert>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={onTryAnother}>
                Try another image
              </Button>
              {/* Backend currently does NOT return a partial prompt_text on
                  this 422; "Use anyway" is gated until that contract is
                  extended. See report. */}
              <Button
                variant="text"
                disabled
                title="Backend returned no usable text — try another image"
              >
                Use raw text anyway
              </Button>
            </Stack>
          </Stack>
        )}

        {!isLoading && err && !errCode && (
          <Stack spacing={1}>
            <Alert severity="error" role="alert">
              {err.status === 502
                ? 'Analyzer unavailable, please try again later.'
                : 'Analysis failed. Please retry.'}
            </Alert>
            <Button variant="outlined" onClick={onRetry}>
              Retry
            </Button>
          </Stack>
        )}

        {!isLoading && !err && (
          <TextField
            label="Spatial prompt"
            value={promptText}
            onChange={(e) => onPromptChange(e.target.value)}
            multiline
            rows={6}
            fullWidth
            inputProps={{ 'aria-label': 'Spatial prompt text' }}
            helperText={`${promptText.trim().length} / 500 chars (min 50)`}
          />
        )}
      </Box>
    </Stack>
  );
};

// ===========================================================================
// Step 3 — Name & Save
// ===========================================================================

interface Step3Props {
  name: string;
  onNameChange: (v: string) => void;
  nameError: string | null;
  promptText: string;
}

export const Step3Save = ({
  name,
  onNameChange,
  nameError,
  promptText,
}: Step3Props) => (
  <Stack spacing={2}>
    <TextField
      label="Name"
      value={name}
      onChange={(e) => onNameChange(e.target.value)}
      slotProps={{ htmlInput: { maxLength: 80, 'aria-label': 'Name' } }}
      error={!!nameError}
      helperText={nameError ?? 'Max 80 characters.'}
      autoFocus
      fullWidth
    />
    <TextField
      label="Prompt"
      value={promptText}
      multiline
      rows={6}
      fullWidth
      slotProps={{ input: { readOnly: true } }}
    />
  </Stack>
);
