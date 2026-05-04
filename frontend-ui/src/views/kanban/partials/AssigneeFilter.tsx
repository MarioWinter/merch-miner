import { Box, MenuItem, Select, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/store/hooks';

interface AssigneeFilterProps {
  value: number | null;
  onChange: (assigneeId: number | null) => void;
}

const AssigneeFilter = ({ value, onChange }: AssigneeFilterProps) => {
  const { t } = useTranslation();
  const activeWsId = useAppSelector((s) => s.workspace.activeWorkspaceId);
  const workspace = useAppSelector((s) =>
    s.workspace.workspaces.find((w) => w.id === activeWsId),
  );
  const members = workspace?.members ?? [];

  const handleChange = (e: SelectChangeEvent<string>) => {
    const v = e.target.value;
    onChange(v === '' ? null : Number(v));
  };

  return (
    <Select
      size="small"
      displayEmpty
      value={value === null ? '' : String(value)}
      onChange={handleChange}
      renderValue={(selected) => {
        if (!selected) {
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PersonOutlineIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2">{t('kanban.filter.allMembers')}</Typography>
            </Box>
          );
        }
        const m = members.find((m) => m.id === Number(selected));
        return (
          <Typography variant="body2">
            {m ? `${m.first_name} ${m.last_name}`.trim() || m.email : selected}
          </Typography>
        );
      }}
      sx={{ minWidth: 160 }}
    >
      <MenuItem value="">
        <em>{t('kanban.filter.allMembers')}</em>
      </MenuItem>
      {members.map((m) => (
        <MenuItem key={m.id} value={String(m.id)}>
          {`${m.first_name} ${m.last_name}`.trim() || m.email}
        </MenuItem>
      ))}
    </Select>
  );
};

export default AssigneeFilter;
