import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KeywordGroupCard } from './KeywordGroupCard';
import type { NicheKeyword, NicheKeywordGroup } from '../types';

interface SortableGroupCardProps {
  group: NicheKeywordGroup;
  keywords: NicheKeyword[];
  nicheId: string;
  onDeleteKeyword: (id: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onAssignDesignTemplate: (keywordId: string, designTemplateId: string | null) => void;
}

export const SortableGroupCard = ({
  group,
  keywords,
  nicheId,
  onDeleteKeyword,
  onRenameGroup,
  onDeleteGroup,
  onAssignDesignTemplate,
}: SortableGroupCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <KeywordGroupCard
        group={group}
        keywords={keywords}
        nicheId={nicheId}
        onDeleteKeyword={onDeleteKeyword}
        onRenameGroup={onRenameGroup}
        onDeleteGroup={onDeleteGroup}
        onAssignDesignTemplate={onAssignDesignTemplate}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
};
