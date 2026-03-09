import { styled } from '@mui/material/styles';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';

export const StyledAvatar = styled(Avatar)({
  width: 32,
  height: 32,
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  '&:hover': {
    opacity: 0.85,
  },
});

export const ProfileMenuPaper = styled(Paper)(({ theme }) => ({
  marginTop: theme.spacing(1),
  minWidth: 200,
  borderRadius: 12,
  border: '1px solid',
  borderColor: theme.palette.divider,
  overflow: 'visible',
  '&::before': {
    content: '""',
    display: 'block',
    position: 'absolute',
    top: -6,
    right: 14,
    width: 12,
    height: 12,
    backgroundColor: theme.palette.background.paper,
    border: '1px solid',
    borderColor: theme.palette.divider,
    borderBottom: 'none',
    borderRight: 'none',
    transform: 'rotate(45deg)',
    zIndex: 0,
  },
}));
