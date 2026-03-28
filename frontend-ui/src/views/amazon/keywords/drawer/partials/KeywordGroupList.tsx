import { useMemo } from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { KeywordGroupCard } from './KeywordGroupCard';
import { KeywordChipRow } from './KeywordChipRow';
import type { NicheKeyword, NicheKeywordGroup } from '../types';

interface KeywordGroupListProps {
  groups: NicheKeywordGroup[];
  keywords: NicheKeyword[];
  isLoading: boolean;
  onDeleteKeyword: (id: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

export const KeywordGroupList = ({
  groups,
  keywords,
  isLoading,
  onDeleteKeyword,
  onRenameGroup,
  onDeleteGroup,
}: KeywordGroupListProps) => {
  const { t } = useTranslation();

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
      {/* Grouped keywords */}
      {groups
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((group) => (
          <KeywordGroupCard
            key={group.id}
            group={group}
            keywords={grouped.get(group.id) ?? []}
            onDeleteKeyword={onDeleteKeyword}
            onRenameGroup={onRenameGroup}
            onDeleteGroup={onDeleteGroup}
          />
        ))}

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
