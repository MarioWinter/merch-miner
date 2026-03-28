import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Grid,
  Skeleton,
  Pagination,
  Alert,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
import type { DesignAsset } from '../types';
import type { useDesignGallery } from '../hooks/useDesignGallery';
import DesignCard from './DesignCard';
import EmptyState from './EmptyState';

interface DesignGallerySectionProps {
  gallery: ReturnType<typeof useDesignGallery>;
  onDesignClick: (design: DesignAsset) => void;
  onImportCloud: () => void;
}

const DesignGallerySection = ({
  gallery,
  onDesignClick,
  onImportCloud,
}: DesignGallerySectionProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await gallery.handleUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalPages = Math.ceil(gallery.totalCount / (gallery.params.page_size ?? 24));

  if (gallery.isLoading) {
    return (
      <Box component="section" aria-label={t('publish.gallery.title')}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          {t('publish.gallery.title')}
        </Typography>
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
              <Skeleton variant="rounded" height={200} sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (gallery.error) {
    return (
      <Box component="section" aria-label={t('publish.gallery.title')}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          {t('publish.gallery.title')}
        </Typography>
        <Alert severity="error">{t('publish.gallery.loadError')}</Alert>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label={t('publish.gallery.title')}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">{t('publish.gallery.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<SelectAllIcon />}
            onClick={gallery.selectAll}
          >
            {t('publish.gallery.selectAll')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloudOutlinedIcon />}
            onClick={onImportCloud}
          >
            {t('publish.gallery.importCloud')}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<CloudUploadOutlinedIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t('publish.gallery.upload')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={handleFileChange}
            aria-label={t('publish.gallery.upload')}
          />
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          size="small"
          placeholder={t('publish.gallery.search')}
          value={gallery.params.search ?? ''}
          onChange={(e) => gallery.updateFilter({ search: e.target.value })}
          sx={{ minWidth: 200 }}
        />
        <TextField
          select
          size="small"
          label={t('publish.gallery.sortBy')}
          value={gallery.params.sort_by ?? 'newest'}
          onChange={(e) =>
            gallery.updateFilter({
              sort_by: e.target.value as 'newest' | 'recently_edited',
            })
          }
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="newest">{t('publish.gallery.sortNewest')}</MenuItem>
          <MenuItem value="recently_edited">{t('publish.gallery.sortEdited')}</MenuItem>
        </TextField>
      </Box>

      {gallery.designs.length === 0 ? (
        <EmptyState
          onImport={onImportCloud}
          onUpload={() => fileInputRef.current?.click()}
        />
      ) : (
        <>
          <Grid container spacing={2}>
            {gallery.designs.map((design) => (
              <Grid key={design.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                <DesignCard
                  design={design}
                  selected={gallery.selectedIds.has(design.id)}
                  onToggleSelect={gallery.toggleSelect}
                  onDelete={gallery.handleDelete}
                  onClick={onDesignClick}
                />
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
                count={totalPages}
                page={gallery.params.page ?? 1}
                onChange={(_, page) => gallery.updateFilter({ page })}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default DesignGallerySection;
