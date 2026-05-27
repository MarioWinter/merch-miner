// PROJ-34 Phase 13f part B — Step 1 (source picker) for CustomSpatialCreator.
// Extracted from CustomSpatialCreator.steps.tsx so each file stays under the
// 250–300 line budget. Owns the Upload / Reference / Design sub-tabs.

import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  Grid,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { ProjectReference } from '@/views/designs/gallery/types';
import type { Design } from '@/views/designs/board/types';
import { PreviewBox, type SourceSelection } from './CustomSpatialCreator.shared';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Props + sub-tab type
// ---------------------------------------------------------------------------

interface Step1Props {
  value: SourceSelection | null;
  onChange: (v: SourceSelection | null) => void;
  references: ProjectReference[];
  designs: Design[];
}

type SubTab = 'upload' | 'reference' | 'design';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
          ThumbCard={ThumbCard}
          ThumbImage={ThumbImage}
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
          ThumbCard={ThumbCard}
          ThumbImage={ThumbImage}
        />
      )}
    </Stack>
  );
};

// ---------------------------------------------------------------------------
// Inline thumbnail grid for the reference + design sub-tabs.
// ---------------------------------------------------------------------------

interface ThumbGridProps {
  items: { id: string; url: string; label: string }[];
  emptyText: string;
  selectedId: string | undefined;
  onSelect: (id: string, url: string) => void;
  // Inject the styled components so this stays a plain function with no
  // duplicated styled-bits.
  ThumbCard: typeof ThumbCard;
  ThumbImage: typeof ThumbImage;
}

const ThumbGrid = ({
  items,
  emptyText,
  selectedId,
  onSelect,
  ThumbCard: Card,
  ThumbImage: Image,
}: ThumbGridProps) => {
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
          <Card data-selected={selectedId === it.id ? 'true' : 'false'}>
            <CardActionArea
              onClick={() => onSelect(it.id, it.url)}
              aria-label={`Select ${it.label}`}
              aria-pressed={selectedId === it.id}
            >
              <Image>
                <img src={it.url} alt="" loading="lazy" />
              </Image>
              <Typography variant="caption" sx={{ p: 0.5 }} noWrap>
                {it.label}
              </Typography>
            </CardActionArea>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};
