import { Box, Checkbox, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

interface SelectionToolbarProps {
  availableCount: number;
  selectedCount: number;
  pageItemCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

const ToolbarRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  paddingTop: theme.spacing(0.5),
  paddingBottom: theme.spacing(1),
}));

const Separator = styled('span')(({ theme }) => ({
  color: theme.vars.palette.text.disabled,
}));

export const SelectionToolbar = ({
  availableCount,
  selectedCount,
  pageItemCount,
  onSelectAll,
  onClearSelection,
}: SelectionToolbarProps) => {
  const { t } = useTranslation();

  const allOnPageSelected =
    pageItemCount > 0 && selectedCount >= pageItemCount;
  const someSelected = selectedCount > 0 && !allOnPageSelected;

  const handleToggleSelectAll = () => {
    if (allOnPageSelected) {
      onClearSelection();
    } else {
      onSelectAll();
    }
  };

  return (
    <ToolbarRoot>
      <Checkbox
        size="small"
        checked={allOnPageSelected}
        indeterminate={someSelected}
        onChange={handleToggleSelectAll}
        disabled={pageItemCount === 0}
        aria-label={t('ideas.bulk.selectAll')}
        sx={{ p: 0.5 }}
      />
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {t('ideas.bulk.available', { count: availableCount })}
        </Typography>
        <Separator>·</Separator>
        <Typography variant="body2" color="text.secondary">
          {t('ideas.bulk.selected', { count: selectedCount })}
        </Typography>
      </Stack>
    </ToolbarRoot>
  );
};
