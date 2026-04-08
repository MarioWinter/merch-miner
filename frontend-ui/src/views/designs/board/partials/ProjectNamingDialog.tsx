import { useState, useEffect } from 'react';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useListProjectsQuery,
  useCreateProjectMutation,
  useAddIdeasToProjectMutation,
} from '../../../../store/designSlice';
import type { DesignProjectListItem } from '../../gallery/types';

type NamingOption = 'niche' | 'slogan' | 'custom' | 'existing';

interface ProjectNamingDialogProps {
  open: boolean;
  onClose: () => void;
  onProjectSelected: (projectId: string) => void;
  nicheName?: string;
  sloganText?: string;
  nicheId?: string | null;
  /** Idea IDs to attach to the project on create/add */
  ideaIds?: string[];
}

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  minWidth: 400,
  paddingTop: `${theme.spacing(2)} !important`,
}));

export const ProjectNamingDialog = ({
  open,
  onClose,
  onProjectSelected,
  nicheName,
  sloganText,
  nicheId,
  ideaIds,
}: ProjectNamingDialogProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [option, setOption] = useState<NamingOption>('niche');
  const [customName, setCustomName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: projectsData } = useListProjectsQuery();
  const [createProject] = useCreateProjectMutation();
  const [addIdeas] = useAddIdeasToProjectMutation();

  const projects = projectsData?.results ?? [];
  const hasProjects = projects.length > 0;

  // Set default option based on available data
  useEffect(() => {
    if (nicheName) {
      setOption('niche');
    } else if (sloganText) {
      setOption('slogan');
    } else {
      setOption('custom');
    }
  }, [nicheName, sloganText]);

  const getProjectName = (): string => {
    switch (option) {
      case 'niche':
        return nicheName ?? '';
      case 'slogan':
        return (sloganText ?? '').slice(0, 200);
      case 'custom':
        return customName.trim();
      default:
        return '';
    }
  };

  const handleConfirm = async () => {
    if (option === 'existing' && selectedProjectId) {
      // Add ideas to existing project if provided
      if (ideaIds?.length) {
        try {
          await addIdeas({
            projectId: selectedProjectId,
            body: { idea_ids: ideaIds },
          }).unwrap();
        } catch {
          // Error handled by RTK Query
        }
      }
      onProjectSelected(selectedProjectId);
      navigate(`/designs/${selectedProjectId}`);
      onClose();
      return;
    }

    const name = getProjectName();
    if (!name) return;

    setIsCreating(true);
    try {
      const result = await createProject({
        name,
        niche: nicheId ?? undefined,
        idea_ids: ideaIds?.length ? ideaIds : undefined,
      }).unwrap();
      onProjectSelected(result.id);
      navigate(`/designs/${result.id}`);
      onClose();
    } catch {
      // Error handled by RTK Query
    } finally {
      setIsCreating(false);
    }
  };

  const isDisabled =
    isCreating ||
    (option === 'niche' && !nicheName) ||
    (option === 'slogan' && !sloganText) ||
    (option === 'custom' && !customName.trim()) ||
    (option === 'existing' && !selectedProjectId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('design.projects.namingDialog.title')}</DialogTitle>
      <StyledDialogContent>
        <RadioGroup
          value={option}
          onChange={(_, val) => setOption(val as NamingOption)}
        >
          <Stack spacing={1.5}>
            {nicheName && (
              <FormControlLabel
                value="niche"
                control={<Radio size="small" />}
                label={`${t('design.projects.namingDialog.nicheOption')}: "${nicheName}"`}
              />
            )}
            {sloganText && (
              <FormControlLabel
                value="slogan"
                control={<Radio size="small" />}
                label={`${t('design.projects.namingDialog.sloganOption')}: "${sloganText.slice(0, 60)}${sloganText.length > 60 ? '...' : ''}"`}
              />
            )}
            <FormControlLabel
              value="custom"
              control={<Radio size="small" />}
              label={t('design.projects.namingDialog.customOption')}
            />
            {option === 'custom' && (
              <TextField
                size="small"
                placeholder={t('design.projects.namingDialog.placeholder')}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                slotProps={{ input: { sx: { ml: 3.5 } } }}
                autoFocus
              />
            )}
            {hasProjects && (
              <>
                <FormControlLabel
                  value="existing"
                  control={<Radio size="small" />}
                  label={t('design.projects.namingDialog.existingProjectOption')}
                />
                {option === 'existing' && (
                  <Autocomplete
                    size="small"
                    options={projects}
                    getOptionLabel={(p: DesignProjectListItem) => p.name}
                    onChange={(_, val) => setSelectedProjectId(val?.id ?? null)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={t('design.projects.namingDialog.placeholder')}
                      />
                    )}
                    sx={{ ml: 3.5 }}
                  />
                )}
              </>
            )}
          </Stack>
        </RadioGroup>
      </StyledDialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('design.projects.namingDialog.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleConfirm()}
          disabled={isDisabled}
        >
          {option === 'existing'
            ? t('design.projects.namingDialog.confirm').replace('Create', 'Open')
            : t('design.projects.namingDialog.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
