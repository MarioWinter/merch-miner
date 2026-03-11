import { useEffect, useState } from 'react';
import { Menu, MenuItem, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchWorkspaces, setActiveWorkspace } from '../../store/workspaceSlice';

const WorkspaceSelectorButton = styled(Button)(({ theme }) => ({
  borderRadius: '999px',
  color: theme.vars?.palette.text.secondary ?? theme.palette.text.secondary,
  textTransform: 'none',
  borderColor: theme.vars?.palette.text.secondary ?? theme.palette.text.secondary,
  fontWeight: 500,
  paddingLeft: 16,
  paddingRight: 16,
  height: 32,
  whiteSpace: 'nowrap',
  maxWidth: 300,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  '&:hover': {
  backgroundColor: theme.vars?.palette.action.hover ?? theme.palette.action.hover,
  color: theme.vars?.palette.text.primary ?? theme.palette.text.primary,
},
}));

const WorkspaceSelector = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { workspaces, activeWorkspaceId, loading } = useAppSelector(
    (state) => state.workspace
  );

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  useEffect(() => {
    if (workspaces.length === 0 && !loading) {
      dispatch(fetchWorkspaces());
    }
  }, [dispatch, workspaces.length, loading]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (id: string) => {
    dispatch(setActiveWorkspace(id));
    handleClose();
  };

  if (loading) {
    return (
      <Skeleton
        variant="rounded"
        width={140}
        height={32}
        sx={{ borderRadius: '999px' }}
      />
    );
  }

  return (
    <>
      <WorkspaceSelectorButton
        variant="outlined"
        size="small"
        endIcon={<KeyboardArrowDownIcon />}
        onClick={handleOpen}
        aria-controls={open ? 'workspace-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        {activeWorkspace?.name ?? t('topbar.workspace.selector')}
      </WorkspaceSelectorButton>

      <Menu
        id="workspace-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: { minWidth: 180, mt: 0.5 },
          },
        }}
      >
        {workspaces.length === 0 ? (
          <MenuItem disabled>{t('topbar.workspace.noWorkspaces')}</MenuItem>
        ) : (
          workspaces.map((workspace) => (
            <MenuItem
              key={workspace.id}
              selected={workspace.id === activeWorkspaceId}
              onClick={() => handleSelect(workspace.id)}
              sx={{ gap: 1 }}
            >
              <CheckIcon
                fontSize="small"
                sx={{
                  visibility:
                    workspace.id === activeWorkspaceId ? 'visible' : 'hidden',
                  color: 'primary.main',
                }}
              />
              {workspace.name}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
};

export default WorkspaceSelector;
