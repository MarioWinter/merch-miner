import { useState, useCallback } from 'react';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListNichesQuery } from '@/store/nicheSlice';
import { useUpdateProjectMutation } from '@/store/designSlice';

interface NicheOption {
  id: string;
  name: string;
}

interface NicheBindingSelectorProps {
  projectId: string;
  currentNicheId: string | null;
  currentNicheName: string | null;
}

const SelectorRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const NicheChip = styled(Chip)(({ theme }) => ({
  maxWidth: 180,
  backgroundColor: alpha(theme.palette.secondary.main, 0.12),
  color: theme.vars.palette.secondary.main,
  borderRadius: 6,
  '& .MuiChip-deleteIcon': {
    color: theme.vars.palette.secondary.main,
    '&:hover': {
      color: theme.vars.palette.secondary.dark,
    },
  },
}));

const DropdownBox = styled(Box)(({ theme }) => ({
  minWidth: 220,
  '& .MuiOutlinedInput-root': {
    height: 32,
    fontSize: '0.8125rem',
    borderRadius: 8,
    backgroundColor: alpha(theme.palette.background.default, 0.5),
  },
}));

const NicheBindingSelector = ({
  projectId,
  currentNicheId,
  currentNicheName,
}: NicheBindingSelectorProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [editing, setEditing] = useState(false);

  const { data: nicheData, isLoading: nichesLoading } = useListNichesQuery(
    { page_size: 200 },
    { skip: !editing },
  );

  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();

  const nicheOptions: NicheOption[] =
    nicheData?.results.map((n) => ({ id: n.id, name: n.name })) ?? [];

  const currentOption: NicheOption | null =
    currentNicheId && currentNicheName
      ? { id: currentNicheId, name: currentNicheName }
      : null;

  const handleLink = useCallback(
    async (nicheId: string | null) => {
      try {
        await updateProject({
          projectId,
          body: { niche: nicheId },
        }).unwrap();
        enqueueSnackbar(
          nicheId
            ? t('design.projects.nicheBinding.linkSuccess')
            : t('design.projects.nicheBinding.unlinkSuccess'),
          { variant: 'success' },
        );
        setEditing(false);
      } catch {
        enqueueSnackbar(t('design.projects.nicheBinding.linkError'), {
          variant: 'error',
        });
      }
    },
    [projectId, updateProject, enqueueSnackbar, t],
  );

  const handleUnlink = useCallback(() => {
    void handleLink(null);
  }, [handleLink]);

  // Show chip when linked and not editing
  if (currentNicheId && !editing) {
    return (
      <SelectorRoot>
        <LinkIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
        <NicheChip
          label={currentNicheName}
          size="small"
          onDelete={isUpdating ? undefined : handleUnlink}
          deleteIcon={
            isUpdating ? (
              <CircularProgress size={14} />
            ) : (
              <Tooltip title={t('design.projects.nicheBinding.unlink')}>
                <LinkOffIcon sx={{ fontSize: 16 }} />
              </Tooltip>
            )
          }
        />
      </SelectorRoot>
    );
  }

  // Show link button when not linked and not editing
  if (!editing) {
    return (
      <Tooltip title={t('design.projects.nicheBinding.label')}>
        <IconButton
          size="small"
          onClick={() => setEditing(true)}
          aria-label={t('design.projects.nicheBinding.label')}
          sx={{ borderRadius: '8px' }}
        >
          <LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
        </IconButton>
      </Tooltip>
    );
  }

  // Show autocomplete dropdown when editing
  return (
    <DropdownBox>
      <Autocomplete
        open
        size="small"
        options={nicheOptions}
        getOptionLabel={(option) => option.name}
        value={currentOption}
        onChange={(_e, value) => {
          if (value) {
            void handleLink(value.id);
          } else {
            void handleLink(null);
          }
        }}
        loading={nichesLoading}
        disabled={isUpdating}
        onClose={() => setEditing(false)}
        isOptionEqualToValue={(opt, val) => opt.id === val.id}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={t('design.projects.nicheBinding.placeholder')}
            autoFocus
            slotProps={{
              input: {
                ...params.InputProps,
                endAdornment: (
                  <>
                    {(nichesLoading || isUpdating) && (
                      <CircularProgress size={16} />
                    )}
                    {params.InputProps.endAdornment}
                  </>
                ),
              },
            }}
          />
        )}
      />
    </DropdownBox>
  );
};

export default NicheBindingSelector;
