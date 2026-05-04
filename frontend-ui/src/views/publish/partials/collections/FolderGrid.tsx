import { Box, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { DesignCollection } from '../../types';
import { FolderCard, AddFolderCard } from './FolderCard';

interface FolderGridProps {
  folders: DesignCollection[];
  selectedFolderId: string | null;
  onFolderClick: (id: string) => void;
  onFolderDoubleClick: (id: string) => void;
  onAddFolder: (name: string) => void;
  isLoading?: boolean;
}

const GridContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  flex: 1,
  overflow: 'auto',
  alignContent: 'start',
}));

const FolderGrid = ({
  folders,
  selectedFolderId,
  onFolderClick,
  onFolderDoubleClick,
  onAddFolder,
  isLoading,
}: FolderGridProps) => {
  if (isLoading) {
    return (
      <GridContainer>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            sx={{
              aspectRatio: '1 / 1',
              minHeight: 120,
              borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 1.5}px`,
            }}
          />
        ))}
      </GridContainer>
    );
  }

  return (
    <GridContainer>
      <AddFolderCard onAdd={onAddFolder} />
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          id={folder.id}
          name={folder.name}
          assetCount={folder.asset_count}
          childCount={folder.child_count}
          isSelected={selectedFolderId === folder.id}
          onClick={onFolderClick}
          onDoubleClick={onFolderDoubleClick}
        />
      ))}
    </GridContainer>
  );
};

export default FolderGrid;
