import { useMemo, useCallback } from 'react';
import {
  Box,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { styled } from '@mui/material/styles';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import { useTranslation } from 'react-i18next';
import { useListProjectsQuery } from '@/store/designSlice';
import type { DesignProjectListItem } from '@/views/designs/gallery/types';
import type { NicheKeyword } from '../types';

const AssignRow = styled(Stack)(({ theme }) => ({
  padding: `${theme.spacing(0.75)} ${theme.spacing(1)}`,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  marginTop: theme.spacing(0.5),
}));

const NONE_VALUE = '__none__';

interface DesignTemplateAssignProps {
  nicheId: string;
  keywords: NicheKeyword[];
  onAssign: (keywordId: string, designTemplateId: string | null) => void;
}

export const DesignTemplateAssign = ({
  nicheId,
  keywords,
  onAssign,
}: DesignTemplateAssignProps) => {
  const { t } = useTranslation();
  const { data: projectData } = useListProjectsQuery();

  // Get design projects for this niche
  const nicheProjects = useMemo(
    () =>
      (projectData?.results ?? []).filter(
        (p: DesignProjectListItem) => p.niche === nicheId,
      ),
    [projectData, nicheId],
  );

  // Determine current assignment (first keyword with a template wins as display)
  const currentTemplateId = useMemo(() => {
    const assigned = keywords.find((kw) => kw.design_template);
    return assigned?.design_template?.id ?? null;
  }, [keywords]);

  const handleChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const value = event.target.value;
      const designId = value === NONE_VALUE ? null : value;

      // Apply to all keywords in this group
      for (const kw of keywords) {
        onAssign(kw.id, designId);
      }
    },
    [keywords, onAssign],
  );

  // Don't show if no design projects exist for this niche
  if (nicheProjects.length === 0) return null;

  return (
    <AssignRow direction="row" alignItems="center" spacing={1}>
      <BrushOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {t('keywords.drawer.designTemplate')}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Select
          size="small"
          value={currentTemplateId ?? NONE_VALUE}
          onChange={handleChange}
          displayEmpty
          fullWidth
          aria-label={t('keywords.drawer.designTemplate')}
          sx={{ fontSize: '0.75rem', height: 28 }}
        >
          <MenuItem value={NONE_VALUE}>
            <Typography variant="caption" color="text.disabled">
              {t('keywords.drawer.noDesignTemplate')}
            </Typography>
          </MenuItem>
          {nicheProjects.map((project) => (
            <MenuItem key={project.id} value={project.id}>
              <Typography variant="caption" noWrap>
                {project.name}
                {project.design_count > 0 && ` (${project.design_count})`}
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </Box>
    </AssignRow>
  );
};
