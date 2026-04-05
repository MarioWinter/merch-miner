import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  IconButton,
  Tooltip,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ImageIcon from '@mui/icons-material/Image';
import { useTranslation } from 'react-i18next';
import type { CloudFile } from '../hooks/useGoogleDrive';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ThumbBox = styled(Box)({
  width: 48,
  height: 48,
  borderRadius: 4,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

const ThumbImg = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface CloudFileTableProps {
  files: CloudFile[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onUseForAi: (file: CloudFile) => void;
  onDownload: (file: CloudFile) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const CloudFileTable = ({
  files,
  selected,
  onToggleSelect,
  onUseForAi,
  onDownload,
}: CloudFileTableProps) => {
  const { t } = useTranslation();

  return (
    <TableContainer sx={{ maxHeight: 360 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" />
            <TableCell>{t('design.cloud.fileName')}</TableCell>
            <TableCell>{t('design.cloud.folderPath')}</TableCell>
            <TableCell>{t('design.cloud.fileSize')}</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {files.map((file) => (
            <TableRow
              key={file.id}
              hover
              selected={selected.has(file.id)}
              onClick={() => onToggleSelect(file.id)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={selected.has(file.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleSelect(file.id)}
                />
              </TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <ThumbBox>
                    {file.thumbnailUrl ? (
                      <ThumbImg src={file.thumbnailUrl} alt={file.name} loading="lazy" />
                    ) : (
                      <ImageIcon color="disabled" />
                    )}
                  </ThumbBox>
                  {file.name}
                </Box>
              </TableCell>
              <TableCell>{file.folderPath}</TableCell>
              <TableCell>{formatSize(file.size)}</TableCell>
              <TableCell align="right">
                <Tooltip title={t('design.cloud.download')}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onDownload(file); }}
                  >
                    <DownloadIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('design.cloud.useForAi')}>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onUseForAi(file); }}
                  >
                    <AutoFixHighIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
