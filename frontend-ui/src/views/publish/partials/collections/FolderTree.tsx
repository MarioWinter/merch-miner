import { Box, Typography, Collapse, Skeleton } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { CollectionTreeNode } from '../../types';

interface FolderTreeProps {
  tree: CollectionTreeNode[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isLoading?: boolean;
}

const TreeContainer = styled(Box)(({ theme }) => ({
  width: 240,
  minWidth: 240,
  backgroundColor: alpha(COLORS.ink, 0.3),
  borderRight: `1px solid ${theme.vars.palette.divider}`,
  overflow: 'auto',
  padding: theme.spacing(1, 0),
}));

const TreeItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isSelected' && prop !== 'depth',
})<{ isSelected: boolean; depth: number }>(({ theme, isSelected, depth }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  padding: theme.spacing(0.75, 1.5),
  paddingLeft: theme.spacing(1.5 + depth * 2),
  cursor: 'pointer',
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  position: 'relative',
  ...(isSelected && {
    backgroundColor: alpha(COLORS.cyan, 0.06),
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: COLORS.cyan,
    },
  }),
  '&:hover': {
    backgroundColor: isSelected
      ? alpha(COLORS.cyan, 0.08)
      : alpha('#fff', 0.04),
  },
}));

const ExpandIcon = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  width: 20,
  flexShrink: 0,
});

interface TreeNodeProps {
  node: CollectionTreeNode;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  depth: number;
}

const TreeNode = ({ node, selectedId, onSelect, depth }: TreeNodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpanded((prev) => !prev);
    },
    [],
  );

  return (
    <>
      <TreeItem
        isSelected={isSelected}
        depth={depth}
        onClick={() => onSelect(node.id)}
      >
        <ExpandIcon onClick={hasChildren ? handleToggle : undefined}>
          {hasChildren ? (
            expanded ? (
              <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            )
          ) : null}
        </ExpandIcon>
        <FolderOutlinedIcon sx={{ fontSize: 18, color: isSelected ? COLORS.cyan : 'text.secondary' }} />
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? COLORS.cyan : 'text.primary',
          }}
        >
          {node.name}
        </Typography>
        {node.asset_count > 0 && (
          <Typography variant="caption" color="text.disabled">
            {node.asset_count}
          </Typography>
        )}
      </TreeItem>
      {hasChildren && (
        <Collapse in={expanded}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </Collapse>
      )}
    </>
  );
};

const FolderTree = ({ tree, selectedId, onSelect, isLoading }: FolderTreeProps) => {
  const { t } = useTranslation();

  return (
    <TreeContainer>
      {/* Recently Used */}
      <TreeItem
        isSelected={false}
        depth={0}
        sx={{ opacity: 0.6, cursor: 'default', mb: 0.5 }}
      >
        <ExpandIcon />
        <HistoryOutlinedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.disabled">
          {t('publish.collections.recentlyUsed', { defaultValue: 'Recently Used' })}
        </Typography>
      </TreeItem>

      {/* Home (root) */}
      <TreeItem
        isSelected={selectedId === null}
        depth={0}
        onClick={() => onSelect(null)}
      >
        <ExpandIcon />
        <FolderOutlinedIcon
          sx={{ fontSize: 18, color: selectedId === null ? COLORS.cyan : 'text.secondary' }}
        />
        <Typography
          variant="body2"
          noWrap
          sx={{
            fontWeight: selectedId === null ? 600 : 400,
            color: selectedId === null ? COLORS.cyan : 'text.primary',
          }}
        >
          {t('publish.collections.home', { defaultValue: 'Home' })}
        </Typography>
      </TreeItem>

      {isLoading ? (
        <Box sx={{ px: 2, py: 1 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={28} sx={{ mb: 0.5 }} />
          ))}
        </Box>
      ) : (
        tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            selectedId={selectedId}
            onSelect={onSelect}
            depth={1}
          />
        ))
      )}
    </TreeContainer>
  );
};

export default FolderTree;
