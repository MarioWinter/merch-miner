import { useCallback, useMemo } from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { SortableGroupCard } from './SortableGroupCard';
import { KeywordChipRow } from './KeywordChipRow';
import type { NicheKeyword, NicheKeywordGroup } from '../types';

interface KeywordGroupListProps {
  groups: NicheKeywordGroup[];
  keywords: NicheKeyword[];
  nicheId: string;
  isLoading: boolean;
  onDeleteKeyword: (id: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onReorderGroup: (groupId: string, newPosition: number) => void;
  onAssignDesignTemplate: (keywordId: string, designTemplateId: string | null) => void;
}

export const KeywordGroupList = ({
  groups,
  keywords,
  nicheId,
  isLoading,
  onDeleteKeyword,
  onRenameGroup,
  onDeleteGroup,
  onReorderGroup,
  onAssignDesignTemplate,
}: KeywordGroupListProps) => {
  const { t } = useTranslation();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.position - b.position),
    [groups],
  );

  const groupIds = useMemo(() => sortedGroups.map((g) => g.id), [sortedGroups]);

  // Group keywords by group_id
  const { grouped, ungrouped } = useMemo(() => {
    const map = new Map<string, NicheKeyword[]>();
    const ungrp: NicheKeyword[] = [];

    for (const kw of keywords) {
      if (kw.group) {
        const existing = map.get(kw.group.id) ?? [];
        existing.push(kw);
        map.set(kw.group.id, existing);
      } else {
        ungrp.push(kw);
      }
    }
    return { grouped: map, ungrouped: ungrp };
  }, [keywords]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedGroups.findIndex((g) => g.id === active.id);
      const newIndex = sortedGroups.findIndex((g) => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      onReorderGroup(String(active.id), newIndex);
    },
    [sortedGroups, onReorderGroup],
  );

  if (isLoading) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
        ))}
      </Stack>
    );
  }

  if (keywords.length === 0 && groups.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
        {t('keywords.drawer.noKeywords')}
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {/* Grouped keywords with drag-to-reorder */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
          {sortedGroups.map((group) => (
            <SortableGroupCard
              key={group.id}
              group={group}
              keywords={grouped.get(group.id) ?? []}
              nicheId={nicheId}
              onDeleteKeyword={onDeleteKeyword}
              onRenameGroup={onRenameGroup}
              onDeleteGroup={onDeleteGroup}
              onAssignDesignTemplate={onAssignDesignTemplate}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Ungrouped keywords */}
      {ungrouped.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ px: 1, mb: 0.5, display: 'block' }}>
            {t('keywords.drawer.ungrouped')}
          </Typography>
          {ungrouped.map((kw) => (
            <KeywordChipRow
              key={kw.id}
              keyword={kw}
              onDelete={onDeleteKeyword}
            />
          ))}
        </Box>
      )}
    </Stack>
  );
};
