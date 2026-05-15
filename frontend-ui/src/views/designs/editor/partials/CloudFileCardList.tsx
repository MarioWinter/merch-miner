/**
 * PROJ-30 T3.13 — vertical card list mirroring CloudFileTable rows for
 * `<744px` viewports. Bulk-select retained.
 */
import { useState } from 'react';
import {
  Box,
  Chip,
  Menu,
  MenuItem,
  Stack,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useTranslation } from 'react-i18next';
import { MobileCard } from '@/components/MobileCard';
import type { CloudFile } from '@/components/CloudStorage';

interface CloudFileCardListProps {
  files: CloudFile[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onUseForAi: (file: CloudFile) => void;
  onDownload: (file: CloudFile) => void;
}

const ThumbBox = styled(Box)(({ theme }) => ({
  width: 48,
  height: 48,
  borderRadius: 6,
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const ThumbImg = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

const TitleCluster = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  flex: 1,
});

const NameText = styled(Box)({
  fontWeight: 600,
  fontSize: '0.9375rem',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return 'FILE';
  return name.slice(dot + 1).toUpperCase();
};

interface FileMenuState {
  anchor: HTMLElement | null;
  file: CloudFile | null;
}

export const CloudFileCardList = ({
  files,
  selected,
  onToggleSelect,
  onUseForAi,
  onDownload,
}: CloudFileCardListProps) => {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<FileMenuState>({ anchor: null, file: null });

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, f: CloudFile) => {
    setMenu({ anchor: e.currentTarget, file: f });
  };

  const closeMenu = () => setMenu({ anchor: null, file: null });

  const handleDownload = () => {
    if (menu.file) onDownload(menu.file);
    closeMenu();
  };

  const handleAi = () => {
    if (menu.file) onUseForAi(menu.file);
    closeMenu();
  };

  return (
    <>
      <Stack spacing={1} role="list" aria-label={t('design.cloud.fileName')}>
        {files.map((file) => {
          const isChecked = selected.has(file.id);
          return (
            <MobileCard
              key={file.id}
              title={
                <TitleCluster>
                  <ThumbBox>
                    {file.thumbnailUrl ? (
                      <ThumbImg src={file.thumbnailUrl} alt={file.name} loading="lazy" />
                    ) : (
                      <ImageOutlinedIcon sx={{ fontSize: 22, color: 'text.disabled' }} />
                    )}
                  </ThumbBox>
                  <NameText>{file.name}</NameText>
                </TitleCluster>
              }
              primaryMeta={t('responsive.cardList.file.meta', {
                size: formatSize(file.size),
                type: getExtension(file.name),
              })}
              secondaryMeta={file.folderPath}
              chips={
                file.folderPath ? (
                  <Chip label={file.folderPath} size="small" variant="outlined" />
                ) : undefined
              }
              selectable
              selected={isChecked}
              onToggleSelect={() => onToggleSelect(file.id)}
              selectAriaLabel={t('responsive.cardList.selectAria', { title: file.name })}
              onActivate={() => onToggleSelect(file.id)}
              onMenuOpen={(e) => openMenu(e, file)}
              menuAriaLabel={t('responsive.cardList.actionsAria', { title: file.name })}
            />
          );
        })}
      </Stack>

      <Menu
        anchorEl={menu.anchor}
        open={Boolean(menu.anchor)}
        onClose={closeMenu}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
      >
        <MenuItem onClick={handleDownload}>
          <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
          {t('design.cloud.download')}
        </MenuItem>
        <MenuItem onClick={handleAi}>
          <AutoFixHighIcon fontSize="small" sx={{ mr: 1 }} />
          {t('design.cloud.useForAi')}
        </MenuItem>
      </Menu>
    </>
  );
};

export default CloudFileCardList;
