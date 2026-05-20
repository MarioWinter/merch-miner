// PROJ-34 Phase 13t-m — Step 1 (source picker) for CustomTypographyCreator.
// Mirrors CustomSpatialCreator.Step1.tsx 1:1 — Upload / Reference / Design
// sub-tabs. The parent owns state + RTK mutation orchestration.

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
import { useTranslation } from 'react-i18next';
import type { ProjectReference } from '@/views/designs/gallery/types';
import type { Design } from '@/views/designs/board/types';
import { PreviewBox, type SourceSelection } from './CustomTypographyCreator.shared';

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
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<SubTab>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(t('designForge.builder.typography.createNew.errorTooLarge'));
      return;
    }
    if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number])) {
      setUploadError(t('designForge.builder.typography.createNew.errorWrongMime'));
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
        aria-label={t('designForge.builder.typography.createNew.sourceTypeAria')}
      >
        <ToggleButton value="upload">
          {t('designForge.builder.typography.createNew.subTabUpload')}
        </ToggleButton>
        <ToggleButton value="reference">
          {t('designForge.builder.typography.createNew.subTabReference')}
        </ToggleButton>
        <ToggleButton value="design">
          {t('designForge.builder.typography.createNew.subTabDesign')}
        </ToggleButton>
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
            aria-label={t('designForge.builder.typography.createNew.dropZoneAria')}
          >
            <Typography variant="body2" color="text.secondary">
              {t('designForge.builder.typography.createNew.dropZoneText')}
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
              <img
                src={value.previewUrl}
                alt={t('designForge.builder.typography.createNew.previewAlt')}
              />
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
          emptyText={t('designForge.builder.typography.createNew.emptyReferences')}
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
          emptyText={t('designForge.builder.typography.createNew.emptyDesigns')}
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
